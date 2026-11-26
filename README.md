# QueuePass

Virtual queue management SaaS for Bangladesh. Software-only, Bangla-first, SMS-first, no app for visitors.

- `apps/web` — Next.js 15, next-intl (bn/en, default bn), Board design system.
- `apps/api` — NestJS 11, Prisma 6, Postgres RLS, BullMQ SMS outbox, SSE live updates.
- `packages/shared` — shared types, ETA math, SMS copy.

**Local only — no git remote, no deploy.** See `.env.example` for config.

## Run locally

Prerequisites: Node 22+, pnpm 10, PostgreSQL 16, Redis. No Docker needed.

```bash
pnpm install
# One-time DB setup (as the postgres superuser; passwords are local dev only):
psql -U postgres -v owner_pass=qp_owner_dev -v app_pass=qp_app_dev -v pub_pass=qp_pub_dev -f scripts/db-setup.sql
pnpm db:migrate
psql -U postgres -d queuepass -f scripts/db-grants.sql
psql -U postgres -d queuepass_test -f scripts/db-grants.sql
pnpm db:seed
pnpm dev:api   # :3001
pnpm dev:web   # :3000
```

Seed logins (local dev only): owner `owner@citycare.example / Owner123!`,
manager `manager@citycare.example / Manager123!`, counter `counter@citycare.example / PIN 1234`.

Public demo: http://localhost:3000 — join a queue, then open the counter dashboard.
TV display: http://localhost:3000/display/<branch-id> · Kiosk: http://localhost:3000/kiosk/<branch-id>

## Checks

```bash
pnpm typecheck && pnpm lint
pnpm test          # unit: shared ETA/SMS/fair-order helpers
pnpm test:e2e      # API: concurrency, idempotency, RLS, no-show, sweep, SMS-down
pnpm build
pnpm --filter @queuepass/web test:smoke   # Playwright: join -> token page, login -> manager
```

## Notes

- **Prisma engine on this VM:** Prisma 6.19.3 cannot download its query engine
  through the egress proxy (ECONNRESET). After a fresh `pnpm install`, run
  `scripts/fix-prisma-engine.sh` (copies the cached engine binary into the
  pnpm store); then `cd apps/api && npx prisma version` should work.
- **RLS:** every tenant-scoped query goes through `PrismaService.withTenant()`,
  which sets a transaction-local `app.tenant_id`. The `queuepass_public` role
  (BYPASSRLS, SELECT-only) is used only for pre-auth reads and public token
  lookups by unguessable code. `FORCE RLS` applies to the owner role too, so
  the seed and test fixtures run as the postgres superuser.
- **SMS:** provider is `SMS_PROVIDER` (`dev` logs to console, `fail` always
  errors, `bulksmsbd` / `greenweb` are real gateways behind env credentials).
  A dead gateway never blocks call-next — the SMS retries and lands in the
  manager's failed list. Billing tiers are placeholders (pricing TBD); SMS
  top-ups are recorded, no real money moves.
- **Docker:** `docker-compose.yml` exists for machines with Docker; this VM
  has no Docker, so local runs use the system Postgres/Redis.
