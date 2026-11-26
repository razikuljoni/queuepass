import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async health() {
    const started = Date.now();
    let db = 'down';
    try { await this.prisma.$queryRaw`SELECT 1`; db = 'ok'; } catch { db = 'down'; }
    return { status: db === 'ok' ? 'ok' : 'degraded', version: '0.1.0', db, uptimeSec: Math.round(process.uptime()), latencyMs: Date.now() - started };
  }
}
