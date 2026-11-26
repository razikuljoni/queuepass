import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PublicPrismaService } from '../prisma/public-prisma.service';

/**
 * Public directory: the join page, kiosk and TV need to discover branches
 * and open services without signing in. Only public-safe fields are
 * returned (names, address, open state) — never phones, emails or IDs
 * that leak tenancy internals.
 */
@Controller('public')
export class PublicDirectoryController {
  constructor(private pub: PublicPrismaService) {}

  @Get('branches')
  async branches() {
    const branches = await this.pub.branch.findMany({
      where: { isOpen: true },
      select: { id: true, name: true, nameBn: true, address: true, organisation: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    return branches.map((b) => ({ id: b.id, name: b.name, nameBn: b.nameBn, address: b.address, orgName: b.organisation.name }));
  }

  @Get('branches/:branchId/services')
  async services(@Param('branchId') branchId: string) {
    const branch = await this.pub.branch.findUnique({ where: { id: branchId }, select: { id: true, isOpen: true } });
    if (!branch) throw new NotFoundException('Branch not found');
    return this.pub.service.findMany({
      where: { branchId, isOpen: true },
      select: { id: true, name: true, nameBn: true, codePrefix: true, avgServiceMin: true },
      orderBy: { codePrefix: 'asc' },
    });
  }

  @Get('branches/:branchId/queue')
  async queue(@Param('branchId') branchId: string) {
    // Public-safe: token numbers + service names only, no phones or names.
    const rows = await this.pub.token.findMany({
      where: { branchId, status: 'waiting' },
      select: { id: true, number: true, service: { select: { name: true, nameBn: true } }, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    return rows.map((r) => ({ id: r.id, number: r.number, serviceName: r.service.name, serviceNameBn: r.service.nameBn }));
  }

  @Get('branches/:branchId')
  async branch(@Param('branchId') branchId: string) {
    const b = await this.pub.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, nameBn: true, address: true, isOpen: true, organisation: { select: { name: true } } },
    });
    if (!b) throw new NotFoundException('Branch not found');
    return { id: b.id, name: b.name, nameBn: b.nameBn, address: b.address, isOpen: b.isOpen, orgName: b.organisation.name };
  }
}
