import { Module } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { TokensController } from './tokens.controller';
import { EtaService } from './eta.service';
import { EventsService } from '../common/events.service';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [SmsModule],
  providers: [TokensService, EtaService, EventsService],
  controllers: [TokensController],
  exports: [TokensService, EtaService],
})
export class TokensModule {}
