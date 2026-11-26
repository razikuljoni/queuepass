import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Privileged client (role queuepass_public, BYPASSRLS, SELECT only).
 * Used ONLY for pre-authentication reads (register/login/PIN login) and
 * public token lookups by unguessable code — flows where no tenant exists
 * yet. It must never be used for tenant-scoped reads/writes; those go
 * through PrismaService.withTenant() + RLS.
 */
@Injectable()
export class PublicPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: { db: { url: process.env.PUBLIC_DATABASE_URL || process.env.DATABASE_URL } },
      log: ['error'],
    });
  }
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
