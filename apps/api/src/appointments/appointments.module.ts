import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { TokensModule } from '../tokens/tokens.module';

@Module({ imports: [TokensModule], providers: [AppointmentsService], controllers: [AppointmentsController] })
export class AppointmentsModule {}
