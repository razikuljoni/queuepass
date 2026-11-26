import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';
import { PublicPrismaService } from '../src/prisma/public-prisma.service';
import { SmsWorker } from '../src/sms/sms.worker';
import type { Job } from 'bullmq';
import * as bcrypt from 'bcryptjs';

// Env for the test DB/app is set in test/setup-env.ts (jest setupFiles),
// before any module is imported.
describe('QueuePass e2e', () => {
  let app: INestApplication;
  // Superuser client: fixture setup/cleanup only. FORCE RLS applies to the
  // owner role too, so fixtures (like the seed) run as the superuser, which
  // bypasses RLS. The public role has no DELETE, so it cannot do this.
  // CI sets TEST_SUPERUSER_URL (its postgres bootstrap user is queuepass_owner).
  const owner = new PrismaClient({ datasources: { db: { url: process.env.TEST_SUPERUSER_URL || 'postgresql://postgres:qp_pg_dev@localhost:5432/queuepass_test' } } });
  let pub: PublicPrismaService;
  let worker: SmsWorker;
  let orgA: string; let branchA: string; let svcA: string; const countersA: string[] = [];
  let orgB: string; let branchB: string; let svcB: string;
  let tokenA: string; let tokenB: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    pub = app.get(PublicPrismaService);
    worker = app.get(SmsWorker);

    // Clean slate (owner client bypasses RLS).
    await owner.notification.deleteMany();
    await owner.auditLog.deleteMany();
    await owner.token.deleteMany();
    await owner.appointment.deleteMany();
    await owner.counter.deleteMany();
    await owner.service.deleteMany();
    await owner.branch.deleteMany();
    await owner.user.deleteMany();
    await owner.organisation.deleteMany();

    const hash = await bcrypt.hash('Owner123!', 10);
    const orgArow = await owner.organisation.create({ data: { name: 'Test Clinic A', plan: 'pilot' } });
    orgA = orgArow.id;
    const orgBrow = await owner.organisation.create({ data: { name: 'Test Clinic B', plan: 'pilot' } });
    orgB = orgBrow.id;
    await owner.user.create({ data: { orgId: orgA, email: 'owner-a@test.example', name: 'Owner A', role: 'owner', passwordHash: hash } });
    await owner.user.create({ data: { orgId: orgB, email: 'owner-b@test.example', name: 'Owner B', role: 'owner', passwordHash: hash } });
    const brA = await owner.branch.create({ data: { orgId: orgA, name: 'Branch A', address: 'Dhaka', timezone: 'Asia/Dhaka' } });
    branchA = brA.id;
    const brB = await owner.branch.create({ data: { orgId: orgB, name: 'Branch B', address: 'Dhaka', timezone: 'Asia/Dhaka' } });
    branchB = brB.id;
    const sA = await owner.service.create({ data: { orgId: orgA, branchId: branchA, name: 'Consultation', nameBn: 'পরামর্শ', codePrefix: 'A', avgServiceMin: 5 } });
    svcA = sA.id;
    const sB = await owner.service.create({ data: { orgId: orgB, branchId: branchB, name: 'Consultation', nameBn: 'পরামর্শ', codePrefix: 'A', avgServiceMin: 5 } });
    svcB = sB.id;
    for (let i = 1; i <= 10; i++) {
      const c = await owner.counter.create({ data: { orgId: orgA, branchId: branchA, name: `Counter ${i}`, status: 'open' } });
      await owner.counter.update({ where: { id: c.id }, data: { services: { connect: { id: svcA } } } });
      countersA.push(c.id);
    }
    const cB = await owner.counter.create({ data: { orgId: orgB, branchId: branchB, name: 'Counter B1', status: 'open' } });
    await owner.counter.update({ where: { id: cB.id }, data: { services: { connect: { id: svcB } } } });
    const login = async (email: string) => {
      const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: 'Owner123!' });
      return res.body.token as string;
    };
    tokenA = await login('owner-a@test.example');
    tokenB = await login('owner-b@test.example');
  });

  afterAll(async () => { await owner.$disconnect(); await app.close(); });

  it('join creates a token with position + ETA, and idempotency returns the same token with one SMS', async () => {
    const key = `idem-${Date.now()}`;
    const body = { branchId: branchA, serviceId: svcA, phone: '01710000001', name: 'Idem', idempotencyKey: key };
    const r1 = await request(app.getHttpServer()).post('/api/v1/public/join').send(body).expect(201);
    const r2 = await request(app.getHttpServer()).post('/api/v1/public/join').send(body).expect(201);
    expect(r2.body.id).toBe(r1.body.id);
    expect(r2.body.number).toBe(r1.body.number);
    expect(r1.body.position.peopleAhead).toBe(0);
    expect(r1.body.position.etaMin).toBeGreaterThanOrEqual(0);
    expect(r1.body.position.etaLow).toBeGreaterThanOrEqual(0);
    const rows = await pub.token.findMany({ where: { idempotencyKey: key } });
    expect(rows).toHaveLength(1);
    const sms = await pub.notification.findMany({ where: { tokenId: r1.body.id, event: 'joined' } });
    expect(sms).toHaveLength(1);
  });

  it('public token page resolves by code, 404 for unknown code', async () => {
    const joined = await request(app.getHttpServer()).post('/api/v1/public/join')
      .send({ branchId: branchA, serviceId: svcA, phone: '01710000002' }).expect(201);
    const page = await request(app.getHttpServer()).get(`/api/v1/public/t/${joined.body.publicCode}`).expect(200);
    expect(page.body.number).toBe(joined.body.number);
    await request(app.getHttpServer()).get('/api/v1/public/t/doesnotexist12').expect(404);
  });

  it('10 parallel call-next claim 10 different tokens', async () => {
    // 12 waiting tokens on service A.
    for (let i = 0; i < 12; i++) {
      await request(app.getHttpServer()).post('/api/v1/public/join')
        .send({ branchId: branchA, serviceId: svcA, phone: `017100001${String(i).padStart(2, '0')}` }).expect(201);
    }
    const results = await Promise.all(
      countersA.map((c) =>
        request(app.getHttpServer()).post(`/api/v1/counters/${c}/call-next`)
          .set('Authorization', `Bearer ${tokenA}`).then((r) => r.body),
      ),
    );
    // A counter with no token left returns null (empty body): only real
    // claims have a number. Exactly 10 distinct tokens must be claimed.
    console.log('CALL-NEXT RESULTS:', JSON.stringify(results));
    const numbers = results.filter((r: { number?: string }) => r && r.number).map((r: { number?: string }) => r.number);
    expect(numbers).toHaveLength(10);
    expect(new Set(numbers).size).toBe(10);
  });

  it('tenant B cannot touch tenant A (RLS)', async () => {
    // B's call-next on A's counter: counter not found for B.
    await request(app.getHttpServer()).post(`/api/v1/counters/${countersA[0]}/call-next`)
      .set('Authorization', `Bearer ${tokenB}`).expect(404);
    // B listing A's queue sees nothing.
    const q = await request(app.getHttpServer()).get(`/api/v1/queue?branchId=${branchA}`)
      .set('Authorization', `Bearer ${tokenB}`).expect(200);
    expect(q.body).toHaveLength(0);
  });

  it('no-show frees the counter and the next call advances', async () => {
    const called = await pub.token.findFirst({ where: { status: 'called', counterId: countersA[0] } });
    expect(called).toBeTruthy();
    await request(app.getHttpServer()).post(`/api/v1/counters/${countersA[0]}/no-show`)
      .set('Authorization', `Bearer ${tokenA}`).expect(201);
    const after = await pub.token.findUnique({ where: { id: called!.id } });
    expect(after!.status).toBe('no_show');
    const next = await request(app.getHttpServer()).post(`/api/v1/counters/${countersA[0]}/call-next`)
      .set('Authorization', `Bearer ${tokenA}`).expect(201);
    expect(next.body.number).toBeTruthy();
    expect(next.body.number).not.toBe(called!.number);
  });

  it('end-of-day sweep expires waiting tokens', async () => {
    // Self-contained: join two tokens so there is something to sweep.
    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer()).post('/api/v1/public/join')
        .send({ branchId: branchA, serviceId: svcA, phone: `0171000090${i}` }).expect(201);
    }
    // Sweep expires every open token (waiting + called + serving), not just waiting.
    const before = await pub.token.count({ where: { orgId: orgA, branchId: branchA, status: { in: ['waiting', 'called', 'serving'] } } });
    expect(before).toBeGreaterThan(0);
    const res = await request(app.getHttpServer()).post(`/api/v1/branches/${branchA}/sweep`)
      .set('Authorization', `Bearer ${tokenA}`).expect(201);
    expect(res.body.expired).toBe(before);
    const after = await pub.token.count({ where: { orgId: orgA, branchId: branchA, status: { in: ['waiting', 'called', 'serving'] } } });
    expect(after).toBe(0);
  });

  it('SMS gateway down: token flow still works, SMS retries then fails visibly', async () => {
    process.env.SMS_PROVIDER = 'fail';
    const joined = await request(app.getHttpServer()).post('/api/v1/public/join')
      .send({ branchId: branchA, serviceId: svcA, phone: '01710000099' }).expect(201);
    expect(joined.body.number).toBeTruthy();
    // call-next still works with the gateway down: free a counter if it is
    // busy (complete returns 400 when idle), then call.
    await request(app.getHttpServer()).post(`/api/v1/counters/${countersA[0]}/complete`)
      .set('Authorization', `Bearer ${tokenA}`);
    const called = await request(app.getHttpServer()).post(`/api/v1/counters/${countersA[0]}/call-next`)
      .set('Authorization', `Bearer ${tokenA}`).expect(201);
    expect(called.body.number).toBe(joined.body.number);
    const n = await pub.notification.findFirst({ where: { tokenId: joined.body.id, event: 'joined' } });
    expect(n).toBeTruthy();
    for (let i = 0; i < 5; i++) {
      await expect(worker.process({ name: 'send', data: { notificationId: n!.id } } as unknown as Job)).rejects.toThrow();
    }
    const failed = await pub.notification.findUnique({ where: { id: n!.id } });
    expect(failed!.status).toBe('failed');
    expect(failed!.attempts).toBe(5);
    const usage = await request(app.getHttpServer()).get(`/api/v1/sms/usage?branchId=${branchA}`)
      .set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(usage.body.failed).toBeGreaterThan(0);
    process.env.SMS_PROVIDER = 'dev';
  });
});
