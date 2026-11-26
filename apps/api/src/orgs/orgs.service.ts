import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { audit } from '../tenancy/audit';

@Injectable()
export class OrgsService {
  constructor(private prisma: PrismaService) {}

  // ---- Branches ----
  listBranches(orgId: string) {
    return this.prisma.withTenant(orgId, (tx) =>
      tx.branch.findMany({ where: { orgId }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { services: true, counters: true } } } }),
    );
  }

  async createBranch(orgId: string, actorId: string, dto: { name: string; nameBn?: string; address?: string; workingHours?: Record<string, unknown>; holidays?: unknown[] }) {
    const branch = await this.prisma.withTenant(orgId, async (tx) => {
        const b = await tx.branch.create({ data: { orgId, name: dto.name, nameBn: dto.nameBn, address: dto.address, workingHours: (dto.workingHours ?? {}) as never, holidays: (dto.holidays ?? []) as never } });
        await audit(tx, { orgId, branchId: b.id, actorId, action: 'branch_created', details: { name: dto.name } });
        return b;
    });
    return branch;
  }

  async updateBranch(orgId: string, actorId: string, id: string, dto: Partial<{ name: string; nameBn: string; address: string; isOpen: boolean; workingHours: Record<string, unknown>; holidays: unknown[] }>) {
    return this.prisma.withTenant(orgId, async (tx) => {
        const b = await tx.branch.update({ where: { id }, data: { ...dto, workingHours: dto.workingHours as never, holidays: dto.holidays as never } });
        await audit(tx, { orgId, branchId: id, actorId, action: 'branch_updated', details: dto });
        return b;
    });
  }

  // ---- Services ----
  listServices(orgId: string, branchId: string) {
    return this.prisma.withTenant(orgId, (tx) =>
      tx.service.findMany({ where: { orgId, branchId }, orderBy: { codePrefix: 'asc' } }),
    );
  }

  async createService(orgId: string, actorId: string, dto: { branchId: string; name: string; nameBn?: string; codePrefix: string; configuredServiceMin?: number; capacityPerDay?: number; priorityRules?: Record<string, unknown> }) {
    return this.prisma.withTenant(orgId, async (tx) => {
        const s = await tx.service.create({
          data: { orgId, branchId: dto.branchId, name: dto.name, nameBn: dto.nameBn, codePrefix: dto.codePrefix.toUpperCase(), configuredServiceMin: dto.configuredServiceMin ?? 5, avgServiceMin: dto.configuredServiceMin ?? 5, capacityPerDay: dto.capacityPerDay ?? 100, priorityRules: (dto.priorityRules ?? {}) as never },
        });
        await audit(tx, { orgId, branchId: dto.branchId, actorId, action: 'service_created', details: { name: dto.name, codePrefix: dto.codePrefix } });
        return s;
    });
  }

  async setServiceOpen(orgId: string, actorId: string, id: string, isOpen: boolean) {
    return this.prisma.withTenant(orgId, async (tx) => {
        const s = await tx.service.update({ where: { id }, data: { isOpen } });
        await audit(tx, { orgId, branchId: s.branchId, actorId, action: isOpen ? 'service_opened' : 'service_paused', details: { serviceId: id } });
        return s;
    });
  }

  // ---- Counters ----
  listCounters(orgId: string, branchId: string) {
    return this.prisma.withTenant(orgId, (tx) =>
      tx.counter.findMany({ where: { orgId, branchId }, orderBy: { name: 'asc' }, include: { services: { select: { id: true, name: true, codePrefix: true } } } }),
    );
  }

  async createCounter(orgId: string, actorId: string, dto: { branchId: string; name: string; serviceIds: string[] }) {
    return this.prisma.withTenant(orgId, async (tx) => {
        const c = await tx.counter.create({ data: { orgId, branchId: dto.branchId, name: dto.name, services: { connect: dto.serviceIds.map((id) => ({ id })) } }, include: { services: true } });
        await audit(tx, { orgId, branchId: dto.branchId, actorId, action: 'counter_created', details: { name: dto.name } });
        return c;
    });
  }

  async setCounterStatus(orgId: string, actorId: string, id: string, status: 'open' | 'break' | 'closed', staffId?: string) {
    return this.prisma.withTenant(orgId, async (tx) => {
        const c = await tx.counter.update({ where: { id }, data: { status, ...(staffId !== undefined ? { staffId } : {}) } });
        await audit(tx, { orgId, branchId: c.branchId, actorId, action: `counter_${status}`, details: { counterId: id } });
        return c;
    });
  }

  async getBranchOrThrow(orgId: string, branchId: string) {
    const b = await this.prisma.withTenant(orgId, (tx) => tx.branch.findFirst({ where: { id: branchId, orgId } }));
    if (!b) throw new NotFoundException('Branch not found');
    return b;
  }
}
