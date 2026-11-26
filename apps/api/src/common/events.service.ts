import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { Subject } from 'rxjs';

/** Redis Pub/Sub fan-out for live queue updates (SSE). One channel per branch. */
@Injectable()
export class EventsService implements OnModuleDestroy {
  private pub: Redis;
  private sub: Redis;
  private subjects = new Map<string, Subject<unknown>>();

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.pub = new Redis(url, { maxRetriesPerRequest: 3 });
    this.sub = new Redis(url, { maxRetriesPerRequest: 3 });
    this.sub.on('message', (channel, message) => {
      const s = this.subjects.get(channel);
      if (s) s.next(JSON.parse(message));
    });
  }

  async publish(branchId: string, event: unknown): Promise<void> {
    await this.pub.publish(`branch:${branchId}:events`, JSON.stringify(event));
  }

  subscribe(branchId: string): Subject<unknown> {
    const channel = `branch:${branchId}:events`;
    if (!this.subjects.has(channel)) {
      this.subjects.set(channel, new Subject());
      void this.sub.subscribe(channel);
    }
    return this.subjects.get(channel)!;
  }

  onModuleDestroy() {
    this.pub.disconnect();
    this.sub.disconnect();
  }
}
