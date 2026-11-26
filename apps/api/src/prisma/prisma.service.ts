import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Prisma with RLS. Every tenant-scoped operation runs inside withTenant(),
 * which sets the transaction-local app.tenant_id from the verified JWT.
 * set_config(..., true) is transaction-local, so a pooled connection can
 * never leak one tenant into the next request.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'] });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async withTenant<T>(orgId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${orgId}, true)`;
      return fn(tx);
    });
  }

  /** Raw SQL with tenant set (for the atomic call-next claim). */
  async withTenantRaw<T>(orgId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.withTenant(orgId, fn);
  }
}
