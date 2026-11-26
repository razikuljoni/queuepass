import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private pub: PublicPrismaService, private jwt: JwtService) {}

  /** Register the first owner + organisation (used by onboarding). */
  async registerOwner(dto: { orgName: string; name: string; email: string; password: string; phone?: string }) {
    const existing = await this.pub.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already registered');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const org = await this.pub.organisation.create({
      data: {
        name: dto.orgName,
        users: { create: { email: dto.email, passwordHash, name: dto.name, phone: dto.phone, role: 'owner' } },
      },
      include: { users: true },
    });
    const user = org.users[0];
    return { orgId: org.id, user: this.toPublic(user), token: this.sign(user.id, org.id) };
  }

  async login(email: string, password: string) {
    const user = await this.pub.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { orgId: user.orgId, user: this.toPublic(user), token: this.sign(user.id, user.orgId) };
  }

  /** Counter staff sign in with email + 4-digit PIN for a shift. */
  async pinLogin(email: string, pin: string) {
    const user = await this.pub.user.findUnique({ where: { email } });
    if (!user || !user.pinHash || !(await bcrypt.compare(pin, user.pinHash))) {
      throw new UnauthorizedException('Invalid email or PIN');
    }
    if (user.role !== 'counter' && user.role !== 'branch_manager') {
      throw new UnauthorizedException('PIN login is for counter staff');
    }
    return { orgId: user.orgId, user: this.toPublic(user), token: this.sign(user.id, user.orgId) };
  }

  async createStaff(orgId: string, dto: { email: string; name: string; phone?: string; role: string; branchIds: string[]; password?: string; pin?: string }) {
    const existing = await this.pub.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already registered');
    const passwordHash = await bcrypt.hash(dto.password || 'Staff1234!', 10);
    const pinHash = dto.pin ? await bcrypt.hash(dto.pin, 10) : null;
    return this.prisma.withTenant(orgId, (tx) =>
      tx.user.create({
        data: { orgId, email: dto.email, name: dto.name, phone: dto.phone, role: dto.role as never, branchIds: dto.branchIds, passwordHash, pinHash },
        select: { id: true, email: true, name: true, role: true, branchIds: true, createdAt: true },
      }),
    );
  }

  private sign(userId: string, orgId: string) {
    return this.jwt.sign({ sub: userId, orgId });
  }

  private toPublic(u: { id: string; email: string; name: string; role: string; branchIds: string[]; orgId: string }) {
    return { id: u.id, email: u.email, name: u.name, role: u.role, branchIds: u.branchIds, orgId: u.orgId };
  }
}
