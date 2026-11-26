import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SmsService {
  constructor(private prisma: PrismaService) {}

  /** Per-branch SMS usage + cost (WaitWell-style billable-texts report). */
  async usage(orgId: string, branchId: string) {
    return this.prisma.withTenant(orgId, async (tx) => {
    const [sent, delivered, failed, pending, cost] = await Promise.all([
      tx.notification.count({ where: { orgId, branchId, status: 'sent' } }),
      tx.notification.count({ where: { orgId, branchId, status: 'sent', providerMsgId: { not: null } } }),
      tx.notification.count({ where: { orgId, branchId, status: 'failed' } }),
      tx.notification.count({ where: { orgId, branchId, status: 'pending' } }),
      tx.notification.aggregate({ _sum: { costBdt: true }, where: { orgId, branchId, status: 'sent' } }),
    ]);
    const org = await tx.organisation.findUnique({ where: { id: orgId }, select: { smsBalanceBdt: true } });
    const totalCost = Number(cost._sum.costBdt ?? 0);
    return {
      sent, delivered, failed, pending,
      totalCostBdt: Math.round(totalCost * 100) / 100,
      balanceBdt: Number(org?.smsBalanceBdt ?? 0),
      lowBalance: Number(org?.smsBalanceBdt ?? 0) < 500,
    };
    });
  }

  async failedList(orgId: string, branchId: string) {
    return this.prisma.withTenant(orgId, (tx) =>
      tx.notification.findMany({
        where: { orgId, branchId, status: 'failed' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { token: { select: { number: true, phone: true } } },
      }),
    );
  }
}
