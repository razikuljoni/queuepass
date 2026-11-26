import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrgsModule } from './orgs/orgs.module';
import { TokensModule } from './tokens/tokens.module';
import { SmsModule } from './sms/sms.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ManagerModule } from './manager/manager.module';
import { BillingModule } from './billing/billing.module';
import { HealthModule } from './health/health.module';
import { EventsService } from './common/events.service';
import { IdempotencyService } from './common/idempotency.service';

@Module({
  imports: [
    BullModule.forRoot({ connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } }),
    PrismaModule, AuthModule, OrgsModule, TokensModule, SmsModule,
    AppointmentsModule, ManagerModule, BillingModule, HealthModule,
  ],
  providers: [EventsService, IdempotencyService],
  exports: [EventsService],
})
export class AppModule {}
