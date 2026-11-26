import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { OrgsService } from './orgs.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators';

class BranchDto { @IsString() name!: string; @IsOptional() @IsString() nameBn?: string; @IsOptional() @IsString() address?: string; workingHours?: Record<string, unknown>; holidays?: unknown[]; }
class ServiceDto { @IsString() branchId!: string; @IsString() name!: string; @IsOptional() @IsString() nameBn?: string; @IsString() codePrefix!: string; configuredServiceMin?: number; capacityPerDay?: number; priorityRules?: Record<string, unknown>; }
class CounterDto { @IsString() branchId!: string; @IsString() name!: string; @IsArray() serviceIds!: string[]; }

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrgsController {
  constructor(private orgs: OrgsService) {}

  @Get('branches') listBranches(@CurrentUser() u: JwtUser) { return this.orgs.listBranches(u.orgId); }
  @Post('branches') @Roles('owner', 'branch_manager') createBranch(@CurrentUser() u: JwtUser, @Body() dto: BranchDto) { return this.orgs.createBranch(u.orgId, u.sub, dto); }
  @Patch('branches/:id') @Roles('owner', 'branch_manager') updateBranch(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: Partial<BranchDto> & { isOpen?: boolean }) { return this.orgs.updateBranch(u.orgId, u.sub, id, dto); }

  @Get('services') listServices(@CurrentUser() u: JwtUser, @Query('branchId') branchId: string) { return this.orgs.listServices(u.orgId, branchId); }
  @Post('services') @Roles('owner', 'branch_manager') createService(@CurrentUser() u: JwtUser, @Body() dto: ServiceDto) { return this.orgs.createService(u.orgId, u.sub, dto); }
  @Patch('services/:id/open') @Roles('owner', 'branch_manager') setServiceOpen(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: { isOpen: boolean }) { return this.orgs.setServiceOpen(u.orgId, u.sub, id, dto.isOpen); }

  @Get('counters') listCounters(@CurrentUser() u: JwtUser, @Query('branchId') branchId: string) { return this.orgs.listCounters(u.orgId, branchId); }
  @Post('counters') @Roles('owner', 'branch_manager') createCounter(@CurrentUser() u: JwtUser, @Body() dto: CounterDto) { return this.orgs.createCounter(u.orgId, u.sub, dto); }
  @Patch('counters/:id/status') setCounterStatus(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: { status: 'open' | 'break' | 'closed'; staffId?: string }) { return this.orgs.setCounterStatus(u.orgId, u.sub, id, dto.status, dto.staffId); }
}
