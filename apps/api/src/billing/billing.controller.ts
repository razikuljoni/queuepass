import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators';

/**
 * Billing is TBD placeholders — no prices, no real money.
 * Plan tiers and SMS top-up are UI-only until the owner validates pricing
 * with pilot branches and sets up merchant accounts (bKash/Nagad/bank).
 */
const TIERS = [
  { id: 'pilot', name: 'Pilot', smsIncluded: 500, features: ['1 branch', '2 counters', 'TV display', 'Basic reports'] },
  { id: 'branch', name: 'Branch', smsIncluded: 2000, features: ['1 branch', 'Unlimited services & counters', 'Appointments', 'Exports', 'SMS dashboard'] },
  { id: 'multi_branch', name: 'Multi-branch', smsIncluded: 5000, features: ['Cross-branch dashboard', 'RBAC', 'Audit log', 'API'] },
  { id: 'enterprise', name: 'Enterprise', smsIncluded: 0, features: ['SSO', 'SLA', 'On-prem option', 'Integrations', 'Dedicated support'] },
];

class TopupDto {
  @IsNumber() amountBdt!: number;
  @IsString() method!: string; // bkash | nagad | bank
  @IsOptional() @IsString() reference?: string;
}

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private prisma: PrismaService) {}

  @Get('tiers') tiers() {
    // Prices are deliberately absent: Pricing TBD — invent no prices.
    return { tiers: TIERS, note: 'Pricing TBD — validate with pilot branches before launch.' };
  }

  @Get('me') async me(@CurrentUser() u: JwtUser) {
    const org = await this.prisma.withTenant(u.orgId, (tx) =>
      tx.organisation.findUnique({ where: { id: u.orgId }, select: { plan: true, smsBalanceBdt: true } }),
    );
    return { plan: org?.plan ?? 'pilot', smsBalanceBdt: Number(org?.smsBalanceBdt ?? 0) };
  }

  @Post('sms-topup')
  @Roles('owner')
  async topup(@CurrentUser() u: JwtUser, @Body() dto: TopupDto) {
    // Records the top-up request only. Real money moves outside the app
    // (bKash/Nagad/bank transfer) until merchant accounts are set up.
    const org = await this.prisma.withTenant(u.orgId, async (tx) => {
      const updated = await tx.organisation.update({
        where: { id: u.orgId },
        data: { smsBalanceBdt: { increment: dto.amountBdt } },
        select: { smsBalanceBdt: true },
      });
      await tx.auditLog.create({
        data: { orgId: u.orgId, actorId: u.sub, action: 'sms_topup_recorded', details: { amountBdt: dto.amountBdt, method: dto.method, reference: dto.reference ?? '' } as never },
      });
      return updated;
    });
    return { smsBalanceBdt: Number(org.smsBalanceBdt), status: 'recorded — verify payment manually until merchant accounts are live' };
  }
}
