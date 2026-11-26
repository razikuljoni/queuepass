import { Prisma } from '@prisma/client';

/** Append one audit row in the same transaction as the state change. */
export function audit(
  tx: Prisma.TransactionClient,
  data: { orgId: string; branchId?: string | null; actorId?: string | null; action: string; tokenId?: string | null; details?: Record<string, unknown> },
) {
  return tx.auditLog.create({
    data: {
      orgId: data.orgId,
      branchId: data.branchId ?? null,
      actorId: data.actorId ?? null,
      action: data.action,
      tokenId: data.tokenId ?? null,
      details: (data.details ?? {}) as never,
    },
  });
}
