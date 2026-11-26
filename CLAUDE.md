# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development & Build
- **Install dependencies**: `pnpm install`
- **Run dev servers**: `pnpm dev` (runs API on `:3001` and Web on `:3000` in parallel)
- **Run API dev**: `pnpm dev:api`
- **Run Web dev**: `pnpm dev:web`
- **Typecheck**: `pnpm typecheck`
- **Lint**: `pnpm lint`
- **Build**: `pnpm build`

### Database
- **Initial setup (as postgres superuser)**:
  ```bash
  psql -U postgres -v owner_pass=qp_owner_dev -v app_pass=qp_app_dev -v pub_pass=qp_pub_dev -f scripts/db-setup.sql
  pnpm db:migrate
  psql -U postgres -d queuepass -f scripts/db-grants.sql
  psql -U postgres -d queuepass_test -f scripts/db-grants.sql
  ```
- **Migrate**: `pnpm db:migrate`
- **Seed**: `pnpm db:seed`
- **Prisma engine fix (if egress proxy ECONNRESETs)**: `scripts/fix-prisma-engine.sh`

### Testing
- **Unit tests**: `pnpm test` (or `pnpm --filter @queuepass/api test`)
- **API E2E tests**: `pnpm test:e2e`
- **Smoke tests (Playwright)**:
  ```bash
  pnpm --filter @queuepass/web test:smoke
  ```

## Architecture & Structure

QueuePass is a virtual queue management SaaS for Bangladesh (software-only, Bangla-first, SMS-first, no app for visitors).

- **`apps/web`** — Next.js 15 frontend with `next-intl` (bn/en, default bn) and Board design system. Includes public views, visitor token page, counter dashboard, TV display (`/display/[branch-id]`), and kiosk (`/kiosk/[branch-id]`).
- **`apps/api`** — NestJS 11 backend with Prisma 6, PostgreSQL Row Level Security (RLS), BullMQ SMS outbox, and Server-Sent Events (SSE) for live updates.
- **`packages/shared`** — Shared TypeScript types, ETA math, and SMS templates/copy.

### Key Technical Details
- **Row Level Security (RLS)**: Tenant-scoped queries go through `PrismaService.withTenant()`, setting a transaction-local `app.tenant_id`. The `queuepass_public` role is BYPASSRLS / SELECT-only for public token lookups by unguessable code. `FORCE RLS` applies to owner role too, so seeds and test fixtures run as superuser.
- **SMS Outbox**: Handled via BullMQ with pluggable providers (`dev` logs to console, `fail` errors, `bulksmsbd` / `greenweb` real gateways). Gateway failures do not block call-next operations; failed SMS items land in the manager's failed queue.
