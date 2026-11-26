import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators';

class BookDto { @IsString() branchId!: string; @IsString() serviceId!: string; @IsString() phone!: string; @IsOptional() @IsString() name?: string; @IsString() slotAt!: string; }

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private appts: AppointmentsService) {}

  @Post() book(@CurrentUser() u: JwtUser, @Body() dto: BookDto) { return this.appts.book(u.orgId, dto); }
  @Get() list(@CurrentUser() u: JwtUser, @Query('branchId') branchId: string, @Query('date') date?: string) { return this.appts.list(u.orgId, branchId, date); }
  @Post(':id/check-in') checkIn(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.appts.checkIn(u.orgId, id, u.sub); }
  @Post(':id/cancel') cancel(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.appts.cancel(u.orgId, id); }
}
