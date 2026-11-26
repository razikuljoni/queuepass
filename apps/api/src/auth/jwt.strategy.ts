import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PublicPrismaService } from '../prisma/public-prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PublicPrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'dev-only-local-secret-change-me-in-production',
    });
  }

  async validate(payload: { sub: string; orgId: string }) {
    // Re-check the user still exists and belongs to the tenant in the token.
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, orgId: payload.orgId },
      select: { id: true, orgId: true, email: true, role: true, branchIds: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return { sub: user.id, orgId: user.orgId, email: user.email, role: user.role, branchIds: user.branchIds };
  }
}
