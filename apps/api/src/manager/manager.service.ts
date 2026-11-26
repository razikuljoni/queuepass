import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ManagerService {
  constructor(private prisma: PrismaService) {}

  async liveStats(orgId: string, branchId: string) {
    return this.prisma.withTenant(orgId, async (tx) => {
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const [waiting, served, noShow, issued, countersOpen, countersTotal] = await Promise.all([
      tx.token.count({ where: { orgId, branchId, status: 'waiting' } }),
      tx.token.count({ where: { orgId, branchId, status: 'completed', completedAt: { gte: today } } }),
      tx.token.count({ where: { orgId, branchId, status: 'no_show', createdAt: { gte: today } } }),
      tx.token.count({ where: { orgId, branchId, createdAt: { gte: today } } }),
      tx.counter.count({ where: { orgId, branchId, status: 'open' } }),
      tx.counter.count({ where: { orgId, branchId } }),
    ]);
    const completed = await tx.token.findMany({
      where: { orgId, branchId, status: 'completed', completedAt: { gte: today } },
      select: { joinedAt: true, calledAt: true, completedAt: true },
    });
    const waits = completed.filter((t) => t.calledAt).map((t) => (+t.calledAt! - +t.joinedAt) / 60000);
    const services = completed.filter((t) => t.calledAt && t.completedAt).map((t) => (+t.completedAt! - +t.calledAt!) / 60000);
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
    return {
      waiting, served, noShow, issued, countersOpen, countersTotal,
      avgWaitMin: avg(waits), avgServiceMin: avg(services),
      noShowRate: issued ? Math.round((noShow / issued) * 100) : 0,
    };
    });
  }

  async peakHours(orgId: string, branchId: string, days = 7) {
    return this.prisma.withTenant(orgId, async (tx) => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const rows = await tx.$queryRaw<Array<{ hour: number; count: bigint }>>`
        SELECT EXTRACT(HOUR FROM "createdAt")::int AS hour, COUNT(*)::bigint AS count
        FROM tokens WHERE "orgId" = ${orgId} AND "branchId" = ${branchId} AND "createdAt" >= ${since}
        GROUP BY hour ORDER BY hour`;
      const byHour = new Map<number, number>(rows.map((r) => [r.hour, Number(r.count)]));
      return Array.from({ length: 24 }, (_, h) => ({ hour: h, visits: byHour.get(h) ?? 0 }));
    });
  }

  async byService(orgId: string, branchId: string) {
    return this.prisma.withTenant(orgId, async (tx) => {
      const services = await tx.service.findMany({ where: { orgId, branchId }, select: { id: true, name: true, nameBn: true, codePrefix: true, avgServiceMin: true } });
      const today = new Date(new Date().setHours(0, 0, 0, 0));
      return Promise.all(services.map(async (s) => {
        const [waiting, served, noShow] = await Promise.all([
          tx.token.count({ where: { serviceId: s.id, status: 'waiting' } }),
          tx.token.count({ where: { serviceId: s.id, status: 'completed', completedAt: { gte: today } } }),
          tx.token.count({ where: { serviceId: s.id, status: 'no_show', createdAt: { gte: today } } }),
        ]);
        return { ...s, waiting, served, noShow };
      }));
    });
  }

  async auditLog(orgId: string, branchId?: string, limit = 100) {
    return this.prisma.withTenant(orgId, (tx) =>
      tx.auditLog.findMany({
        where: { orgId, ...(branchId ? { branchId } : {}) },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { actor: { select: { name: true, email: true } }, token: { select: { number: true } } },
      }),
    );
  }

  async exportDailyCsv(orgId: string, branchId: string, date?: string) {
    const day = date ? new Date(date) : new Date();
    const start = new Date(day.setHours(0, 0, 0, 0));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const tokens = await this.prisma.withTenant(orgId, (tx) =>
      tx.token.findMany({
        where: { orgId, branchId, createdAt: { gte: start, lt: end } },
        include: { service: { select: { name: true } }, counter: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    );
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'token,service,counter,phone,priority,status,joined_at,called_at,completed_at,actual_wait_min';
    const lines = tokens.map((t) => [t.number, t.service.name, t.counter?.name ?? '', t.phone, t.priority, t.status, t.joinedAt.toISOString(), t.calledAt?.toISOString() ?? '', t.completedAt?.toISOString() ?? '', t.actualWaitMin ?? ''].map(esc).join(','));
    return [header, ...lines].join('\n');
  }
}
