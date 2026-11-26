import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { smsProviderFromEnv } from './providers';

const MAX_ATTEMPTS = 5;

/**
 * SMS outbox worker. Scans pending notifications every 5s and sends each
 * one as its own BullMQ job (exponential backoff, DLQ after 5 attempts).
 * A dead gateway never blocks a call-next: the token flow already
 * completed; only the SMS retries, and the manager sees the failure.
 */
@Processor('sms')
export class SmsWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(SmsWorker.name);

  constructor(
    @InjectQueue('sms') private queue: Queue,
    private prisma: PublicPrismaService,
  ) { super(); }

  async onModuleInit() {
    await this.queue.add('scan', {}, { repeat: { every: 5000 } });
  }

  async process(job: Job) {
    if (job.name === 'scan') return this.scan();
    if (job.name === 'send') return this.sendOne(job.data.notificationId);
    return null;
  }

  private async scan() {
    const pending = await this.prisma.notification.findMany({
      where: { status: 'pending', attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { id: true },
    });
    for (const n of pending) {
      await this.queue.add('send', { notificationId: n.id }, {
        jobId: `sms-${n.id}`,
        attempts: MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      });
    }
    return { queued: pending.length };
  }

  private async sendOne(notificationId: string) {
    const n = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { token: { select: { phone: true, number: true } } },
    });
    if (!n || n.status !== 'pending') return null;
    const provider = smsProviderFromEnv();
    try {
      const result = await provider.send(n.token.phone, n.body, { masking: false });
      await this.prisma.notification.update({
        where: { id: n.id },
        data: { status: 'sent', providerMsgId: result.providerMsgId, costBdt: result.costBdt, sentAt: new Date(), attempts: { increment: 1 } },
      });
      this.logger.log(`SMS sent ${n.event} -> ${n.token.number} via ${provider.name}`);
      return { sent: true };
    } catch (err) {
      const attempts = n.attempts + 1;
      await this.prisma.notification.update({
        where: { id: n.id },
        data: { attempts, ...(attempts >= MAX_ATTEMPTS ? { status: 'failed' } : {}) },
      });
      this.logger.error(`SMS failed ${n.event} -> ${n.token.number} (attempt ${attempts}): ${(err as Error).message}`);
      throw err; // BullMQ retries with backoff; after 5 attempts it lands in the DLQ
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`SMS job ${job.id} failed permanently: ${err.message}`);
  }
}
