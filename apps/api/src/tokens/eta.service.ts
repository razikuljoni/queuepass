import { Injectable } from '@nestjs/common';
import { estimateWaitMin, etaRange, ewma } from '@queuepass/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface QueuePosition {
  tokenId: string;
  position: number; // 1-based among waiting, in fair order
  peopleAhead: number;
  etaMin: number;
  etaLow: number;
  etaHigh: number;
  countersOpen: number;
  avgServiceMin: number;
}

/**
 * Fair queue order: strict FIFO within priority class, with at most
 * 1 priority token per 3 regular tokens, so regulars never starve.
 * Priority DESC alone would starve regulars — this interleave is the rule.
 */
export function fairOrder<T extends { priority: string; createdAt: Date | string }>(tokens: T[]): T[] {
  const sorted = [...tokens].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const regular = sorted.filter((t) => t.priority !== 'priority');
  const vip = sorted.filter((t) => t.priority === 'priority');
  const out: T[] = [];
  let r = 0, v = 0, sinceVip = 0;
  while (r < regular.length || v < vip.length) {
    if (v < vip.length && (sinceVip >= 3 || r >= regular.length)) {
      out.push(vip[v++]); sinceVip = 0;
    } else if (r < regular.length) {
      out.push(regular[r++]); sinceVip++;
    } else {
      out.push(vip[v++]); sinceVip = 0;
    }
  }
  return out;
}

@Injectable()
export class EtaService {
  constructor(private prisma: PrismaService) {}

  /** Position + ETA for one token, computed live from the DB. */
  async positionFor(tokenId: string, orgId: string): Promise<QueuePosition | null> {
    return this.prisma.withTenant(orgId, async (tx) => {
    const token = await tx.token.findUnique({
      where: { id: tokenId },
      include: { service: true },
    });
    if (!token) return null;
    const waiting = await tx.token.findMany({
      where: { serviceId: token.serviceId, status: 'waiting' },
      select: { id: true, priority: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const ordered = fairOrder(waiting);
    const idx = ordered.findIndex((t) => t.id === tokenId);
    const peopleAhead = idx < 0 ? 0 : idx;
    const countersOpen = await tx.counter.count({
      where: { branchId: token.branchId, status: 'open', services: { some: { id: token.serviceId } } },
    });
    const etaMin = estimateWaitMin({ peopleAhead, avgServiceMin: token.service.avgServiceMin, countersOpen });
    const range = etaRange(etaMin);
    return {
      tokenId, position: idx < 0 ? 0 : idx + 1, peopleAhead, etaMin,
      etaLow: range.low, etaHigh: range.high, countersOpen, avgServiceMin: token.service.avgServiceMin,
    };
    });
  }

  /** Record a measured service time (called -> completed) with EWMA. */
  async recordServiceTime(serviceId: string, minutes: number, orgId: string): Promise<void> {
    return this.prisma.withTenant(orgId, async (tx) => {
      const s = await tx.service.findUnique({ where: { id: serviceId }, select: { avgServiceMin: true, serviceSamples: true, configuredServiceMin: true } });
      if (!s) return;
      const base = s.serviceSamples === 0 ? s.configuredServiceMin : s.avgServiceMin;
      const next = s.serviceSamples === 0 ? Math.round(minutes * 10) / 10 : ewma(base, minutes);
      await tx.service.update({
        where: { id: serviceId },
        data: { avgServiceMin: next, serviceSamples: { increment: 1 } },
      });
    });
  }
}
