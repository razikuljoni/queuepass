// QueuePass seed — LOCAL DEV ONLY. Demo data for CityCare Hospital, Mirpur 10.
// Login: owner@citycare.example / Owner123!   Counter PIN login: counter@citycare.example / PIN 1234
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clean slate (dev only)
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.token.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.counter.deleteMany();
  await prisma.service.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();
  await prisma.dailyStats.deleteMany();

  const org = await prisma.organisation.create({
    data: { name: 'CityCare Hospital', smsBalanceBdt: 2500, plan: 'branch' },
  });

  const owner = await prisma.user.create({
    data: {
      orgId: org.id, email: 'owner@citycare.example', name: 'Dr. Ayesha Rahman',
      passwordHash: await bcrypt.hash('Owner123!', 10), role: 'owner', phone: '01710000001',
    },
  });
  const manager = await prisma.user.create({
    data: {
      orgId: org.id, email: 'manager@citycare.example', name: 'Rahim Uddin',
      passwordHash: await bcrypt.hash('Manager123!', 10), role: 'branch_manager', phone: '01710000002',
    },
  });
  const counterUser = await prisma.user.create({
    data: {
      orgId: org.id, email: 'counter@citycare.example', name: 'Counter Staff',
      passwordHash: await bcrypt.hash('Counter123!', 10), pinHash: await bcrypt.hash('1234', 10),
      role: 'counter', phone: '01710000003',
    },
  });

  const branch = await prisma.branch.create({
    data: {
      orgId: org.id, name: 'CityCare Hospital — Mirpur 10', nameBn: 'সিটি কেয়ার হাসপাতাল — মিরপুর ১০',
      address: 'Mirpur 10, Dhaka', timezone: 'Asia/Dhaka',
      workingHours: { sat: ['09:00', '17:00'], sun: ['09:00', '17:00'], mon: ['09:00', '17:00'], tue: ['09:00', '17:00'], wed: ['09:00', '17:00'], thu: ['09:00', '17:00'], fri: null },
      holidays: ['2026-12-16', '2027-02-21'],
    },
  });
  await prisma.user.update({ where: { id: manager.id }, data: { branchIds: [branch.id] } });
  await prisma.user.update({ where: { id: counterUser.id }, data: { branchIds: [branch.id] } });

  const services = await Promise.all([
    prisma.service.create({ data: { orgId: org.id, branchId: branch.id, name: 'Doctor Consultation', nameBn: 'ডাক্তারের পরামর্শ', codePrefix: 'A', configuredServiceMin: 8, avgServiceMin: 8, capacityPerDay: 40 } }),
    prisma.service.create({ data: { orgId: org.id, branchId: branch.id, name: 'Lab Test', nameBn: 'ল্যাব টেস্ট', codePrefix: 'B', configuredServiceMin: 6, avgServiceMin: 6, capacityPerDay: 30 } }),
    prisma.service.create({ data: { orgId: org.id, branchId: branch.id, name: 'Report Collection', nameBn: 'রিপোর্ট সংগ্রহ', codePrefix: 'C', configuredServiceMin: 3, avgServiceMin: 3, capacityPerDay: 50 } }),
    prisma.service.create({ data: { orgId: org.id, branchId: branch.id, name: 'Pharmacy', nameBn: 'ফার্মেসি', codePrefix: 'D', configuredServiceMin: 4, avgServiceMin: 4, capacityPerDay: 60 } }),
  ]);
  const [svcA, svcB, svcC, svcD] = services;

  const counters = await Promise.all([
    prisma.counter.create({ data: { orgId: org.id, branchId: branch.id, name: 'Counter 1', services: { connect: [{ id: svcA.id }] } } }),
    prisma.counter.create({ data: { orgId: org.id, branchId: branch.id, name: 'Counter 2', services: { connect: [{ id: svcA.id }, { id: svcB.id }] } } }),
    prisma.counter.create({ data: { orgId: org.id, branchId: branch.id, name: 'Counter 3', services: { connect: [{ id: svcB.id }] }, status: 'break' } }),
    prisma.counter.create({ data: { orgId: org.id, branchId: branch.id, name: 'Counter 4', services: { connect: [{ id: svcC.id }] } } }),
    prisma.counter.create({ data: { orgId: org.id, branchId: branch.id, name: 'Counter 5', services: { connect: [{ id: svcD.id }] } } }),
  ]);

  // Demo tokens: 3 waiting (A), 1 called (A), 2 completed, 1 waiting (B)
  const now = Date.now();
  const mk = (seq: number, svc: typeof svcA, status: string, minsAgo: number, phone: string, name: string) => ({
    orgId: org.id, branchId: branch.id, serviceId: svc.id,
    number: `${svc.codePrefix}-${String(seq).padStart(3, '0')}`, seqNo: seq,
    phone, name, status: status as never, priority: 'normal' as never, source: 'qr' as never,
    publicCode: `demo${svc.codePrefix.toLowerCase()}${seq}${Math.random().toString(36).slice(2, 6)}`,
    joinedAt: new Date(now - minsAgo * 60000),
    calledAt: status === 'completed' || status === 'called' ? new Date(now - (minsAgo - 5) * 60000) : null,
    completedAt: status === 'completed' ? new Date(now - (minsAgo - 12) * 60000) : null,
  });
  const t1 = await prisma.token.create({ data: mk(24, svcA, 'completed', 60, '01711111111', 'Karim') });
  const t2 = await prisma.token.create({ data: mk(25, svcA, 'completed', 45, '01711111112', 'Salma') });
  const t3 = await prisma.token.create({ data: mk(26, svcA, 'called', 20, '01711111113', 'Rahim') });
  await prisma.token.create({ data: mk(27, svcA, 'waiting', 12, '01711111114', 'Nusrat') });
  await prisma.token.create({ data: mk(28, svcA, 'waiting', 8, '01711111115', 'Tanvir') });
  await prisma.token.create({ data: mk(29, svcA, 'waiting', 3, '01711111116', 'Mitu') });
  await prisma.token.create({ data: mk(11, svcB, 'waiting', 6, '01711111117', 'Hasan') });
  await prisma.counter.update({ where: { id: counters[1].id }, data: { currentTokenId: t3.id } });

  await prisma.auditLog.create({
    data: { orgId: org.id, branchId: branch.id, actorId: owner.id, action: 'seed', details: { note: 'CityCare demo data' } },
  });

  // Second org (RLS test tenant — never visible to the first org)
  const org2 = await prisma.organisation.create({ data: { name: 'Other Clinic' } });
  await prisma.user.create({
    data: { orgId: org2.id, email: 'other@example.com', name: 'Other Owner', passwordHash: await bcrypt.hash('Other123!', 10), role: 'owner' },
  });
  const branch2 = await prisma.branch.create({ data: { orgId: org2.id, name: 'Other Clinic — Branch', timezone: 'Asia/Dhaka' } });
  const svc2 = await prisma.service.create({ data: { orgId: org2.id, branchId: branch2.id, name: 'General', codePrefix: 'X', capacityPerDay: 10 } });
  await prisma.token.create({
    data: { orgId: org2.id, branchId: branch2.id, serviceId: svc2.id, number: 'X-001', seqNo: 1, phone: '01719999999', status: 'waiting', publicCode: 'otherdemo00001' },
  });

  console.log('Seed done.');
  console.log(`org=${org.id} branch=${branch.id}`);
  console.log(`services: A=${svcA.id} B=${svcB.id} C=${svcC.id} D=${svcD.id}`);
  console.log(`counters: ${counters.map((c) => `${c.name}=${c.id}`).join(' ')}`);
  console.log(`demo token A-026 publicCode: see DB (t3)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
