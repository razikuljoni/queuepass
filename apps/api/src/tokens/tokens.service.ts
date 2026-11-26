import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { NO_SHOW, RATE_LIMIT } from '@queuepass/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { EtaService, fairOrder } from './eta.service';
import { EventsService } from '../common/events.service';
import { OutboxService } from '../sms/outbox.service';
import { audit } from '../tenancy/audit';

export interface JoinDto {
  branchId: string;
  serviceId: string;
  phone: string;
  name?: string;
  priority?: 'normal' | 'priority';
  source?: 'qr' | 'sms' | 'kiosk' | 'staff' | 'appointment';
  locale?: 'bn' | 'en';
  idempotencyKey?: string;
}

@Injectable()
export class TokensService {
  constructor(
    private prisma: PrismaService,
    private pub: PublicPrismaService,
    private eta: EtaService,
    private events: EventsService,
    private outbox: OutboxService,
  ) {}

  private publicCode(): string {
    return randomBytes(6).toString('hex');
  }

  /** Resolve the owning org of a public branch (no auth on the public join). */
  private async orgOfBranch(branchId: string): Promise<string> {
    const b = await this.pub.branch.findUnique({ where: { id: branchId }, select: { orgId: true } });
    if (!b) throw new NotFoundException('Branch not found');
    return b.orgId;
  }

  async join(dto: JoinDto) {
    const orgId = await this.orgOfBranch(dto.branchId);
    const phone = dto.phone.replace(/[^0-9+]/g, '');
    if (phone.length < 11) throw new BadRequestException('Valid phone number required');

    // Idempotency: same key returns the same token.
    if (dto.idempotencyKey) {
      const existing = await this.pub.token.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
      if (existing) return this.toPublic(existing);
    }

    const token = await this.prisma.withTenant(orgId, async (tx) => {
        // Rate limit: max 3 tokens/phone/day/branch.
        const today = await tx.token.count({
          where: { branchId: dto.branchId, phone, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        });
        if (today >= RATE_LIMIT.maxTokensPerPhonePerDayPerBranch) {
          throw new BadRequestException('Daily token limit reached for this phone number');
        }
        const service = await tx.service.findFirst({ where: { id: dto.serviceId, branchId: dto.branchId } });
        if (!service) throw new NotFoundException('Service not found');
        if (!service.isOpen) throw new BadRequestException('Service is currently closed');
        const issuedToday = await tx.token.count({
          where: { serviceId: dto.serviceId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        });
        if (issuedToday >= service.capacityPerDay) throw new BadRequestException('Daily capacity reached for this service');

        // Serialize sequence allocation on the service row lock.
        await tx.$queryRaw`SELECT id FROM services WHERE id = ${dto.serviceId} FOR UPDATE`;
        const maxSeq = await tx.token.aggregate({
          _max: { seqNo: true },
          where: { serviceId: dto.serviceId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        });
        const seqNo = (maxSeq._max.seqNo ?? 0) + 1;
        const number = `${service.codePrefix}-${String(seqNo).padStart(3, '0')}`;
        const created = await tx.token.create({
          data: {
            orgId, branchId: dto.branchId, serviceId: dto.serviceId,
            number, seqNo, phone, name: dto.name,
            priority: dto.priority ?? 'normal', source: dto.source ?? 'qr',
            publicCode: this.publicCode(),
            idempotencyKey: dto.idempotencyKey ?? null,
          },
        });
        await this.outbox.enqueue(tx, created, 'joined', dto.locale ?? 'bn');
        await audit(tx, { orgId, branchId: dto.branchId, action: 'token_joined', tokenId: created.id, details: { number, source: dto.source ?? 'qr' } });
        return created;
    });
    const pos = await this.eta.positionFor(token.id, orgId);
    await this.events.publish(dto.branchId, { type: 'token_joined', token: token.number, serviceId: dto.serviceId });
    return { ...this.toPublic(token), position: pos };
  }

  async getPublic(code: string) {
    const token = await this.pub.token.findUnique({
      where: { publicCode: code },
      include: { service: true, branch: true, counter: true },
    });
    if (!token) throw new NotFoundException('Token not found');
    const pos = await this.eta.positionFor(token.id, token.orgId);
    return { ...this.toPublic(token), serviceName: token.service.name, serviceNameBn: token.service.nameBn, branchName: token.branch.name, branchNameBn: token.branch.nameBn, counterName: token.counter?.name ?? null, position: pos };
  }

  async leave(code: string, reason?: string) {
    const token = await this.pub.token.findUnique({ where: { publicCode: code } });
    if (!token) throw new NotFoundException('Token not found');
    if (token.status !== 'waiting') throw new BadRequestException('Only a waiting token can leave');
    const updated = await this.prisma.withTenant(token.orgId, async (tx) => {
      const u = await tx.token.update({ where: { id: token.id, version: token.version }, data: { status: 'cancelled', cancelReason: reason ?? 'left', version: { increment: 1 } } });
      await audit(tx, { orgId: token.orgId, branchId: token.branchId, action: 'token_cancelled', tokenId: token.id, details: { reason: reason ?? 'left', by: 'visitor' } });
      return u;
    });
    await this.events.publish(token.branchId, { type: 'token_cancelled', token: token.number, serviceId: token.serviceId });
    return this.toPublic(updated);
  }

  /**
   * Atomic call-next. One transaction holds FOR UPDATE SKIP LOCKED locks on
   * the waiting rows of the service; the fair-order pick is made over the
   * locked set, then a single UPDATE claims it. A concurrent caller skips
   * the locked rows and claims a different token — two counters can never
   * call the same token.
   */
  async callNext(orgId: string, counterId: string, actorId: string) {
    const result = await this.prisma.withTenant(orgId, async (tx) => {
        const counter = await tx.counter.findFirst({ where: { id: counterId, orgId }, include: { services: { select: { id: true } } } });
        if (!counter) throw new NotFoundException('Counter not found');
        if (counter.status !== 'open') throw new BadRequestException('Counter is not open');
        if (counter.currentTokenId) throw new BadRequestException('Finish or no-show the current token first');
        const serviceIds = counter.services.map((s) => s.id);
        if (serviceIds.length === 0) throw new BadRequestException('Counter serves no services');

        // Fair order is computed from the waiting list, but only ONE row is
        // locked at a time: locking the whole list (FOR UPDATE SKIP LOCKED
        // on the select) starved concurrent counters — the first call-next
        // locked every waiting token and the rest returned null. So: pick
        // the fair-order winner, try to lock just that row (SKIP LOCKED);
        // if another counter holds it, move to the next candidate.
        const waiting = await tx.$queryRaw<Array<{ id: string; priority: string; createdAt: Date; serviceId: string }>>`
          SELECT id, priority, "createdAt", "serviceId" FROM tokens
          WHERE "orgId" = ${orgId} AND "branchId" = ${counter.branchId}
            AND "serviceId" = ANY(${serviceIds}::text[]) AND status = 'waiting'
          ORDER BY "createdAt" ASC`;
        if (waiting.length === 0) return null;
        const candidates = fairOrder(waiting);
        let token: { id: string; number: string; serviceId: string; branchId: string; phone: string; priority: string; publicCode: string } | null = null;
        for (const next of candidates) {
          const locked = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM tokens WHERE id = ${next.id} AND status = 'waiting' FOR UPDATE SKIP LOCKED`;
          if (locked.length === 0) continue; // another counter holds it; try the next candidate
          const claimed = await tx.$queryRaw<Array<{ id: string; number: string; serviceId: string; branchId: string; phone: string; priority: string; publicCode: string }>>`
            UPDATE tokens SET status = 'called', "counterId" = ${counterId}, "calledAt" = now(), version = version + 1
            WHERE id = ${next.id} AND status = 'waiting'
            RETURNING id, number, "serviceId", "branchId", phone, priority, "publicCode"`;
          if (claimed.length > 0) { token = claimed[0]; break; }
        }
        if (!token) return null; // every candidate was claimed mid-flight; caller retries
        await tx.counter.update({ where: { id: counterId }, data: { currentTokenId: token.id } });
        await this.outbox.enqueue(tx, { id: token.id, branchId: token.branchId, orgId, phone: token.phone, number: token.number, publicCode: token.publicCode }, 'your_turn', 'bn', { counter: counter.name });
        await audit(tx, { orgId, branchId: token.branchId, actorId, action: 'call_next', tokenId: token.id, details: { counterId, number: token.number } });
        return { ...token, counterName: counter.name };
    });
    if (result) {
      await this.events.publish(result.branchId, { type: 'token_called', token: result.number, counter: result.counterName, serviceId: result.serviceId });
      // 3-away: the token that is now 3rd in line gets its alert.
      await this.maybeSendThreeAway(result.branchId, result.serviceId);
    }
    return result;
  }

  private async maybeSendThreeAway(branchId: string, serviceId: string) {
    try {
    const orgId = await this.orgOfBranch(branchId);
    await this.prisma.withTenant(orgId, async (tx) => {
      const waiting = await tx.token.findMany({
        where: { branchId, serviceId, status: 'waiting' },
        select: { id: true, priority: true, createdAt: true, phone: true, orgId: true },
        orderBy: { createdAt: 'asc' },
      });
      const ordered = fairOrder(waiting);
      const third = ordered[2];
      if (!third) return;
      const existing = await tx.notification.findUnique({ where: { tokenId_event: { tokenId: third.id, event: 'three_away' } } });
      if (existing) return;
      const token = await tx.token.findUnique({ where: { id: third.id } });
      if (!token) return;
      await this.outbox.enqueue(tx, token, 'three_away', 'bn');
    });
    } catch (err) {
      // Best-effort alert: the token was already called; a failed SMS
      // must never turn a successful call-next into a 500.
      console.error('[three-away] failed (non-fatal):', (err as Error).message);
    }
  }

  async complete(orgId: string, counterId: string, actorId: string) {
    const done = await this.prisma.withTenant(orgId, async (tx) => {
        const counter = await tx.counter.findFirst({ where: { id: counterId, orgId } });
        if (!counter?.currentTokenId) throw new BadRequestException('No token in service at this counter');
        const token = await tx.token.findUnique({ where: { id: counter.currentTokenId } });
        if (!token || (token.status !== 'called' && token.status !== 'serving')) throw new BadRequestException('Token is not in service');
        const completedAt = new Date();
        const actualWait = token.calledAt ? Math.round((+token.calledAt - +token.joinedAt) / 60000) : null;
        const updated = await tx.token.update({
          where: { id: token.id, version: token.version },
          data: { status: 'completed', completedAt, actualWaitMin: actualWait, version: { increment: 1 } },
        });
        await tx.counter.update({ where: { id: counterId }, data: { currentTokenId: null } });
        await audit(tx, { orgId, branchId: token.branchId, actorId, action: 'token_completed', tokenId: token.id, details: { number: token.number } });
        return { token: updated, counter };
    });
    if (done.token.calledAt && done.token.completedAt) {
      const mins = Math.max(1, Math.round((+done.token.completedAt - +done.token.calledAt) / 60000));
      await this.eta.recordServiceTime(done.token.serviceId, mins, done.token.orgId);
    }
    await this.events.publish(done.token.branchId, { type: 'token_completed', token: done.token.number, serviceId: done.token.serviceId });
    return this.toPublic(done.token);
  }

  async recall(orgId: string, counterId: string, actorId: string) {
    const out = await this.prisma.withTenant(orgId, async (tx) => {
        const counter = await tx.counter.findFirst({ where: { id: counterId, orgId } });
        if (!counter?.currentTokenId) throw new BadRequestException('No token in service at this counter');
        const token = await tx.token.findUnique({ where: { id: counter.currentTokenId } });
        if (!token || token.status !== 'called') throw new BadRequestException('Token is not in called state');
        if (token.recallCount >= NO_SHOW.maxRecalls) throw new BadRequestException('Recall limit reached — mark no-show instead');
        const updated = await tx.token.update({ where: { id: token.id, version: token.version }, data: { recallCount: { increment: 1 }, version: { increment: 1 } } });
        await this.outbox.enqueue(tx, token, `recalled:${updated.recallCount}`, 'bn', { counter: counter.name });
        await audit(tx, { orgId, branchId: token.branchId, actorId, action: 'token_recalled', tokenId: token.id, details: { count: updated.recallCount } });
        return { token: updated, counterName: counter.name };
    });
    await this.events.publish(out.token.branchId, { type: 'token_recalled', token: out.token.number, counter: out.counterName, serviceId: out.token.serviceId });
    return this.toPublic(out.token);
  }

  async noShow(orgId: string, counterId: string, actorId: string) {
    const out = await this.prisma.withTenant(orgId, async (tx) => {
        const counter = await tx.counter.findFirst({ where: { id: counterId, orgId } });
        if (!counter?.currentTokenId) throw new BadRequestException('No token in service at this counter');
        const token = await tx.token.findUnique({ where: { id: counter.currentTokenId } });
        if (!token) throw new BadRequestException('Token not found');
        const updated = await tx.token.update({ where: { id: token.id, version: token.version }, data: { status: 'no_show', noShowCount: { increment: 1 }, version: { increment: 1 } } });
        await tx.counter.update({ where: { id: counterId }, data: { currentTokenId: null } });
        await audit(tx, { orgId, branchId: token.branchId, actorId, action: 'token_no_show', tokenId: token.id, details: { number: token.number } });
        return updated;
    });
    await this.events.publish(out.branchId, { type: 'token_no_show', token: out.number, serviceId: out.serviceId });
    return this.toPublic(out);
  }

  async requeue(orgId: string, tokenId: string, actorId: string) {
    const out = await this.prisma.withTenant(orgId, async (tx) => {
        const token = await tx.token.findUnique({ where: { id: tokenId } });
        if (!token || token.status !== 'no_show') throw new BadRequestException('Only a no-show token can be requeued');
        if (token.requeueCount >= NO_SHOW.maxRequeues) throw new BadRequestException('Requeue limit reached');
        const updated = await tx.token.update({
          where: { id: token.id, version: token.version },
          data: { status: 'waiting', requeueCount: { increment: 1 }, version: { increment: 1 }, createdAt: new Date() },
        });
        await audit(tx, { orgId, branchId: token.branchId, actorId, action: 'token_requeued', tokenId: token.id, details: { number: token.number } });
        return updated;
    });
    await this.events.publish(out.branchId, { type: 'token_requeued', token: out.number, serviceId: out.serviceId });
    return this.toPublic(out);
  }

  async cancel(orgId: string, tokenId: string, actorId: string, reason?: string) {
    const out = await this.prisma.withTenant(orgId, async (tx) => {
        const token = await tx.token.findUnique({ where: { id: tokenId } });
        if (!token || token.status !== 'waiting') throw new BadRequestException('Only a waiting token can be cancelled');
        const updated = await tx.token.update({ where: { id: token.id, version: token.version }, data: { status: 'cancelled', cancelReason: reason ?? 'cancelled by staff', version: { increment: 1 } } });
        await audit(tx, { orgId, branchId: token.branchId, actorId, action: 'token_cancelled', tokenId: token.id, details: { reason: reason ?? 'cancelled by staff', by: 'staff' } });
        return updated;
    });
    await this.events.publish(out.branchId, { type: 'token_cancelled', token: out.number, serviceId: out.serviceId });
    return this.toPublic(out);
  }

  async transfer(orgId: string, tokenId: string, actorId: string, targetServiceId: string, reason?: string) {
    const out = await this.prisma.withTenant(orgId, async (tx) => {
        const token = await tx.token.findUnique({ where: { id: tokenId }, include: { service: true } });
        if (!token || token.status !== 'waiting') throw new BadRequestException('Only a waiting token can be transferred');
        const target = await tx.service.findFirst({ where: { id: targetServiceId, branchId: token.branchId } });
        if (!target) throw new NotFoundException('Target service not found');
        await tx.$queryRaw`SELECT id FROM services WHERE id = ${targetServiceId} FOR UPDATE`;
        const maxSeq = await tx.token.aggregate({ _max: { seqNo: true }, where: { serviceId: targetServiceId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } });
        const seqNo = (maxSeq._max.seqNo ?? 0) + 1;
        const updated = await tx.token.update({
          where: { id: token.id, version: token.version },
          data: { serviceId: targetServiceId, number: `${target.codePrefix}-${String(seqNo).padStart(3, '0')}`, seqNo, version: { increment: 1 }, createdAt: new Date() },
        });
        await audit(tx, { orgId, branchId: token.branchId, actorId, action: 'token_transferred', tokenId: token.id, details: { from: token.service.name, to: target.name, reason: reason ?? '' } });
        return updated;
    });
    await this.events.publish(out.branchId, { type: 'token_transferred', token: out.number, serviceId: out.serviceId });
    return this.toPublic(out);
  }

  /** End-of-day sweep: close all open tokens, materialise daily stats. */
  async sweep(orgId: string, branchId: string, actorId?: string) {
    const out = await this.prisma.withTenant(orgId, async (tx) => {
        const open = await tx.token.findMany({ where: { orgId, branchId, status: { in: ['waiting', 'called', 'serving'] } }, select: { id: true, serviceId: true, status: true, joinedAt: true, completedAt: true, calledAt: true } });
        for (const tok of open) {
          await tx.token.update({ where: { id: tok.id }, data: { status: 'expired' } });
        }
        await tx.counter.updateMany({ where: { orgId, branchId }, data: { currentTokenId: null } });
        const today = new Date(new Date().setHours(0, 0, 0, 0));
        const services = await tx.service.findMany({ where: { branchId }, select: { id: true } });
        for (const s of services) {
          const [issued, served, noShow] = await Promise.all([
            tx.token.count({ where: { serviceId: s.id, createdAt: { gte: today } } }),
            tx.token.count({ where: { serviceId: s.id, status: 'completed', completedAt: { gte: today } } }),
            tx.token.count({ where: { serviceId: s.id, status: 'no_show', createdAt: { gte: today } } }),
          ]);
          await tx.dailyStats.upsert({
            where: { branchId_serviceId_date: { branchId, serviceId: s.id, date: today } },
            create: { orgId, branchId, serviceId: s.id, date: today, tokensIssued: issued, served, noShow },
            update: { tokensIssued: issued, served, noShow },
          });
        }
        await audit(tx, { orgId, branchId, actorId, action: 'end_of_day_sweep', details: { expired: open.length } });
        return { expired: open.length };
    });
    await this.events.publish(branchId, { type: 'day_closed', expired: out.expired });
    return out;
  }

  async listQueue(orgId: string, branchId: string, serviceId?: string) {
    const tokens = await this.prisma.withTenant(orgId, (tx) =>
      tx.token.findMany({
        where: { orgId, branchId, ...(serviceId ? { serviceId } : {}), status: { in: ['waiting', 'called', 'serving'] } },
        include: { service: { select: { name: true, nameBn: true, codePrefix: true } }, counter: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    );
    const byService = new Map<string, typeof tokens>();
    for (const t of tokens) {
      const list = byService.get(t.serviceId) ?? [];
      list.push(t);
      byService.set(t.serviceId, list);
    }
    const out = tokens.map((t) => {
      const ordered = fairOrder(byService.get(t.serviceId)!);
      const idx = ordered.findIndex((x) => x.id === t.id);
      return { ...this.toPublic(t), serviceName: t.service.name, counterName: t.counter?.name ?? null, position: t.status === 'waiting' ? idx + 1 : 0 };
    });
    return out;
  }

  /** Public TV view: branch id -> org id is resolved via the read-only public client. */
  async nowServingPublic(branchId: string) {
    const branch = await this.pub.branch.findUnique({ where: { id: branchId }, select: { orgId: true } });
    if (!branch) throw new NotFoundException('Branch not found');
    return this.nowServing(branch.orgId, branchId);
  }

  async nowServing(orgId: string, branchId: string) {
    return this.prisma.withTenant(orgId, async (tx) => {
      const counters = await tx.counter.findMany({
        where: { orgId, branchId, status: 'open' },
        include: { services: { select: { id: true, name: true } } },
      });
      const currentIds = counters.map((c) => c.currentTokenId).filter(Boolean) as string[];
      const current = currentIds.length
        ? await tx.token.findMany({ where: { id: { in: currentIds } }, select: { id: true, number: true, counterId: true, serviceId: true } })
        : [];
      const byId = new Map(current.map((t) => [t.id, t]));
      return counters.map((c) => ({
        counterId: c.id, counterName: c.name, status: c.status,
        services: c.services.map((s) => s.name),
        nowServing: c.currentTokenId ? byId.get(c.currentTokenId)?.number ?? null : null,
      }));
    });
  }

  private toPublic(t: { id: string; number: string; seqNo: number; phone: string; name: string | null; status: string; priority: string; source: string; publicCode: string; branchId: string; serviceId: string; counterId: string | null; joinedAt: Date; calledAt: Date | null; completedAt: Date | null; noShowCount: number; recallCount: number; requeueCount: number; version: number }) {
    return {
      id: t.id, number: t.number, seqNo: t.seqNo, phone: t.phone, name: t.name,
      status: t.status, priority: t.priority, source: t.source, publicCode: t.publicCode,
      branchId: t.branchId, serviceId: t.serviceId, counterId: t.counterId,
      joinedAt: t.joinedAt, calledAt: t.calledAt, completedAt: t.completedAt,
      noShowCount: t.noShowCount, recallCount: t.recallCount, requeueCount: t.requeueCount, version: t.version,
    };
  }
}
