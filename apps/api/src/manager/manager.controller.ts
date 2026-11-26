import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { ManagerService } from './manager.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators';
import type { Response } from 'express';

@Controller('manager')
@UseGuards(JwtAuthGuard)
export class ManagerController {
  constructor(private manager: ManagerService) {}

  @Get('stats') stats(@CurrentUser() u: JwtUser, @Query('branchId') branchId: string) {
    return this.manager.liveStats(u.orgId, branchId);
  }

  @Get('peak-hours') peakHours(@CurrentUser() u: JwtUser, @Query('branchId') branchId: string, @Query('days') days?: string) {
    return this.manager.peakHours(u.orgId, branchId, days ? Number(days) : 7);
  }

  @Get('by-service') byService(@CurrentUser() u: JwtUser, @Query('branchId') branchId: string) {
    return this.manager.byService(u.orgId, branchId);
  }

  @Get('audit-log') auditLog(@CurrentUser() u: JwtUser, @Query('branchId') branchId?: string, @Query('limit') limit?: string) {
    return this.manager.auditLog(u.orgId, branchId, limit ? Number(limit) : 100);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv')
  async exportCsv(@CurrentUser() u: JwtUser, @Query('branchId') branchId: string, @Query('date') date: string | undefined, @Res() res: Response) {
    const csv = await this.manager.exportDailyCsv(u.orgId, branchId, date);
    res.setHeader('Content-Disposition', `attachment; filename="queuepass-${branchId}-${date ?? 'today'}.csv"`);
    res.send(csv);
  }
}
