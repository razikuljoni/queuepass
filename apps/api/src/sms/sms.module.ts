import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OutboxService } from './outbox.service';
import { SmsWorker } from './sms.worker';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'sms',
      connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 100 },
    }),
  ],
  providers: [OutboxService, SmsWorker, SmsService],
  controllers: [SmsController],
  exports: [OutboxService, SmsService],
})
export class SmsModule {}
