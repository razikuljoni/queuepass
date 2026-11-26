import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { renderSms, SmsEvent } from '@queuepass/shared';

/**
 * SMS outbox. Notification rows are written in the SAME transaction as the
 * token event, so a crash can never lose an SMS or send one without a
 * record. The BullMQ worker sends pending rows; (tokenId, event) is unique,
 * so a retried job can never send the same event twice.
 */
@Injectable()
export class OutboxService {
  async enqueue(
    tx: Prisma.TransactionClient,
    token: { id: string; branchId: string; orgId: string; phone: string; number: string; publicCode: string },
    event: string,
    locale: 'bn' | 'en' = 'bn',
    vars: Record<string, string | number> = {},
  ): Promise<void> {
    const base = event.split(':')[0] as SmsEvent;
    const link = `${process.env.PUBLIC_WEB_URL || 'http://localhost:3000'}/t/${token.publicCode}`;
    const body = renderSms(base, locale, { ...vars, token: token.number, link });
    try {
      await tx.notification.upsert({
        where: { tokenId_event: { tokenId: token.id, event } },
        create: {
          orgId: token.orgId, branchId: token.branchId, tokenId: token.id,
          event, channel: 'sms', locale, status: 'pending', provider: process.env.SMS_PROVIDER || 'dev',
          body, costBdt: 0,
        },
        update: {},
      });
    } catch (err) {
      // Race: a concurrent transaction enqueued the same (tokenId, event)
      // first. The SMS is already recorded; never fail the token flow.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }
  }
}
