import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { audit } from '../tenancy/audit';

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService, private tokens: TokensService) {}

  async book(orgId: string, dto: { branchId: string; serviceId: string; phone: string; name?: string; slotAt: string }) {
    const slotAt = new Date(dto.slotAt);
    if (slotAt < new Date()) throw new BadRequestException('Slot must be in the future');
    const service = await this.prisma.withTenant(orgId, (tx) =>
      tx.service.findFirst({ where: { id: dto.serviceId, branchId: dto.branchId, orgId } }),
    );
    if (!service) throw new NotFoundException('Service not found');
    return this.prisma.withTenant(orgId, async (tx) => {
      const a = await tx.appointment.create({ data: { orgId, branchId: dto.branchId, serviceId: dto.serviceId, phone: dto.phone, name: dto.name, slotAt } });
      await audit(tx, { orgId, branchId: dto.branchId, action: 'appointment_booked', details: { serviceId: dto.serviceId, slotAt: dto.slotAt } });
      return a;
    });
  }

  async list(orgId: string, branchId: string, date?: string) {
    const day = date ? new Date(date) : new Date();
    const start = new Date(day.setHours(0, 0, 0, 0));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.appointment.findMany({
        where: { orgId, branchId, slotAt: { gte: start, lt: end } },
        include: { service: { select: { name: true, nameBn: true, codePrefix: true } } },
        orderBy: { slotAt: 'asc' },
      }),
    );
  }

  /** Check-in: an appointment joins the live queue as a token (fair order). Counts as "ahead" only after this. */
  async checkIn(orgId: string, appointmentId: string, actorId?: string) {
    const appt = await this.prisma.withTenant(orgId, (tx) =>
      tx.appointment.findFirst({ where: { id: appointmentId, orgId } }),
    );
    if (!appt) throw new NotFoundException('Appointment not found');
    if (appt.status !== 'booked') throw new BadRequestException(`Appointment is ${appt.status}`);
    const windowStart = new Date(appt.slotAt.getTime() - 15 * 60 * 1000);
    if (new Date() < windowStart) throw new BadRequestException('Check-in opens 15 minutes before the slot');
    const token = await this.tokens.join({
      branchId: appt.branchId, serviceId: appt.serviceId, phone: appt.phone, name: appt.name ?? undefined,
      source: 'appointment', locale: 'bn',
    });
    await this.prisma.withTenant(orgId, async (tx) => {
      await tx.appointment.update({ where: { id: appt.id }, data: { status: 'checked_in', tokenId: (token as { id: string }).id } });
      await audit(tx, { orgId, branchId: appt.branchId, actorId, action: 'appointment_checked_in', tokenId: (token as { id: string }).id, details: { appointmentId } });
    });
    return token;
  }

  async cancel(orgId: string, appointmentId: string) {
    return this.prisma.withTenant(orgId, async (tx) => {
      const a = await tx.appointment.findFirst({ where: { id: appointmentId, orgId } });
      if (!a || a.status !== 'booked') throw new BadRequestException('Only a booked appointment can be cancelled');
      const updated = await tx.appointment.update({ where: { id: appointmentId }, data: { status: 'cancelled' } });
      await audit(tx, { orgId, branchId: a.branchId, action: 'appointment_cancelled', details: { appointmentId } });
      return updated;
    });
  }
}
