/**
 * Standalone BullMQ worker process (optional). The API process also runs
 * the SmsWorker; run this separately to keep SMS off the API instances:
 *   pnpm start:worker
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  console.log('QueuePass SMS worker running');
  await new Promise(() => undefined);
}
void bootstrap();
