import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Idempotency-Key store: same key + org returns the stored result. */
@Injectable()
export class IdempotencyService {
  constructor(private prisma: PrismaService) {}

  async get<T>(orgId: string, key: string): Promise<T | null> {
    const row = await this.prisma.withTenant(orgId, (tx) =>
      tx.idempotencyKey.findUnique({ where: { orgId_key: { orgId, key } } }),
    );
    return row ? (row.result as T) : null;
  }

  async put(orgId: string, key: string, result: unknown): Promise<void> {
    await this.prisma.withTenant(orgId, (tx) =>
      tx.idempotencyKey.upsert({
        where: { orgId_key: { orgId, key } },
        create: { orgId, key, result: result as never },
        update: {},
      }),
    );
  }
}
