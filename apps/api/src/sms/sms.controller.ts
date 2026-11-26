import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SmsService } from './sms.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators';

@Controller('sms')
@UseGuards(JwtAuthGuard)
export class SmsController {
  constructor(private sms: SmsService) {}

  @Get('usage') usage(@CurrentUser() u: JwtUser, @Query('branchId') branchId: string) {
    return this.sms.usage(u.orgId, branchId);
  }

  @Get('failed') failed(@CurrentUser() u: JwtUser, @Query('branchId') branchId: string) {
    return this.sms.failedList(u.orgId, branchId);
  }
}
