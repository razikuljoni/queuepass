import { Body, Controller, Get, Param, Post, Query, Sse, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { Observable, map, merge } from 'rxjs';
import { TokensService, JoinDto } from './tokens.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser, JwtUser } from '../common/decorators';
import { EventsService } from '../common/events.service';
import { EtaService } from './eta.service';

class JoinBody {
  @IsString() branchId!: string;
  @IsString() serviceId!: string;
  @IsString() phone!: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() priority?: 'normal' | 'priority';
  @IsOptional() source?: JoinDto['source'];
  @IsOptional() @IsString() locale?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
}

@Controller()
export class TokensController {
  constructor(
    private tokens: TokensService,
    private events: EventsService,
    private eta: EtaService,
  ) {}

  // ---- Public (no auth) ----
  @Post('public/join') join(@Body() dto: JoinBody) {
    return this.tokens.join({ ...dto, locale: (dto.locale as 'bn' | 'en') ?? 'bn' });
  }

  @Get('public/branches/:branchId/now-serving')
  publicNowServing(@Param('branchId') branchId: string) {
    return this.tokens.nowServingPublic(branchId);
  }

  @Get('public/t/:code') getToken(@Param('code') code: string) {
    return this.tokens.getPublic(code);
  }

  @Post('public/t/:code/leave') leave(@Param('code') code: string, @Body() dto: { reason?: string }) {
    return this.tokens.leave(code, dto.reason);
  }

  /** Public SSE stream for one branch (token page + TV). Re-syncs on reconnect. */
  @Sse('public/stream/:branchId')
  stream(@Param('branchId') branchId: string): Observable<{ data: unknown }> {
    const subject = this.events.subscribe(branchId);
    const live$ = subject.asObservable();
    // Heartbeat keeps proxies from closing idle SSE connections.
    const heartbeat$ = new Observable<unknown>((sub) => {
      const id = setInterval(() => sub.next({ type: 'heartbeat', at: new Date().toISOString() }), 25000);
      return () => clearInterval(id);
    });
    return merge(live$, heartbeat$).pipe(map((data) => ({ data })));
  }

  // ---- Staff (auth) ----
  @Get('queue')
  @UseGuards(JwtAuthGuard)
  listQueue(@CurrentUser() u: JwtUser, @Query('branchId') branchId: string, @Query('serviceId') serviceId?: string) {
    return this.tokens.listQueue(u.orgId, branchId, serviceId);
  }

  @Get('now-serving')
  @UseGuards(JwtAuthGuard)
  nowServing(@CurrentUser() u: JwtUser, @Query('branchId') branchId: string) {
    return this.tokens.nowServing(u.orgId, branchId);
  }

  @Post('counters/:counterId/call-next')
  @UseGuards(JwtAuthGuard, RolesGuard)
  callNext(@CurrentUser() u: JwtUser, @Param('counterId') counterId: string) {
    return this.tokens.callNext(u.orgId, counterId, u.sub);
  }

  @Post('counters/:counterId/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  complete(@CurrentUser() u: JwtUser, @Param('counterId') counterId: string) {
    return this.tokens.complete(u.orgId, counterId, u.sub);
  }

  @Post('counters/:counterId/recall')
  @UseGuards(JwtAuthGuard, RolesGuard)
  recall(@CurrentUser() u: JwtUser, @Param('counterId') counterId: string) {
    return this.tokens.recall(u.orgId, counterId, u.sub);
  }

  @Post('counters/:counterId/no-show')
  @UseGuards(JwtAuthGuard, RolesGuard)
  noShow(@CurrentUser() u: JwtUser, @Param('counterId') counterId: string) {
    return this.tokens.noShow(u.orgId, counterId, u.sub);
  }

  @Post('tokens/:id/requeue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  requeue(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.tokens.requeue(u.orgId, id, u.sub);
  }

  @Post('tokens/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  cancel(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: { reason?: string }) {
    return this.tokens.cancel(u.orgId, id, u.sub, dto.reason);
  }

  @Post('tokens/:id/transfer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  transfer(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: { serviceId: string; reason?: string }) {
    return this.tokens.transfer(u.orgId, id, u.sub, dto.serviceId, dto.reason);
  }

  @Post('branches/:branchId/sweep')
  @UseGuards(JwtAuthGuard, RolesGuard)
  sweep(@CurrentUser() u: JwtUser, @Param('branchId') branchId: string) {
    return this.tokens.sweep(u.orgId, branchId, u.sub);
  }
}
