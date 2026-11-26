-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'branch_manager', 'counter', 'viewer');

-- CreateEnum
CREATE TYPE "CounterStatus" AS ENUM ('open', 'break', 'closed');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('waiting', 'called', 'serving', 'completed', 'no_show', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('normal', 'priority');

-- CreateEnum
CREATE TYPE "TokenSource" AS ENUM ('qr', 'sms', 'kiosk', 'staff', 'appointment');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('sms', 'whatsapp');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('booked', 'checked_in', 'completed', 'no_show', 'cancelled');

-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeLicence" TEXT,
    "maskingSenderId" TEXT,
    "smsBalanceBdt" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "plan" TEXT NOT NULL DEFAULT 'pilot',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'viewer',
    "branchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "workingHours" JSONB NOT NULL DEFAULT '{}',
    "holidays" JSONB NOT NULL DEFAULT '[]',
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "codePrefix" TEXT NOT NULL,
    "configuredServiceMin" INTEGER NOT NULL DEFAULT 5,
    "avgServiceMin" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "serviceSamples" INTEGER NOT NULL DEFAULT 0,
    "capacityPerDay" INTEGER NOT NULL DEFAULT 100,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "priorityRules" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CounterStatus" NOT NULL DEFAULT 'open',
    "currentTokenId" TEXT,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "counterId" TEXT,
    "appointmentId" TEXT,
    "number" TEXT NOT NULL,
    "seqNo" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "status" "TokenStatus" NOT NULL DEFAULT 'waiting',
    "priority" "Priority" NOT NULL DEFAULT 'normal',
    "source" "TokenSource" NOT NULL DEFAULT 'qr',
    "publicCode" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "noShowCount" INTEGER NOT NULL DEFAULT 0,
    "recallCount" INTEGER NOT NULL DEFAULT 0,
    "requeueCount" INTEGER NOT NULL DEFAULT 0,
    "predictedWaitMin" INTEGER,
    "actualWaitMin" INTEGER,
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "slotAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'booked',
    "tokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'sms',
    "locale" TEXT NOT NULL DEFAULT 'bn',
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'dev',
    "providerMsgId" TEXT,
    "costBdt" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "body" TEXT NOT NULL DEFAULT '',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "tokenId" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_stats" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "serviceId" TEXT,
    "date" DATE NOT NULL,
    "tokensIssued" INTEGER NOT NULL DEFAULT 0,
    "served" INTEGER NOT NULL DEFAULT 0,
    "noShow" INTEGER NOT NULL DEFAULT 0,
    "avgWaitMin" DOUBLE PRECISION,
    "avgServiceMin" DOUBLE PRECISION,
    "peakHour" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CounterServices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CounterServices_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_orgId_idx" ON "users"("orgId");

-- CreateIndex
CREATE INDEX "branches_orgId_idx" ON "branches"("orgId");

-- CreateIndex
CREATE INDEX "services_branchId_idx" ON "services"("branchId");

-- CreateIndex
CREATE INDEX "services_orgId_idx" ON "services"("orgId");

-- CreateIndex
CREATE INDEX "counters_branchId_idx" ON "counters"("branchId");

-- CreateIndex
CREATE INDEX "counters_orgId_idx" ON "counters"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_publicCode_key" ON "tokens"("publicCode");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_idempotencyKey_key" ON "tokens"("idempotencyKey");

-- CreateIndex
CREATE INDEX "tokens_branchId_serviceId_status_priority_createdAt_idx" ON "tokens"("branchId", "serviceId", "status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "tokens_branchId_status_idx" ON "tokens"("branchId", "status");

-- CreateIndex
CREATE INDEX "tokens_orgId_idx" ON "tokens"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_branchId_serviceId_seqNo_createdAt_key" ON "tokens"("branchId", "serviceId", "seqNo", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_tokenId_key" ON "appointments"("tokenId");

-- CreateIndex
CREATE INDEX "appointments_branchId_slotAt_idx" ON "appointments"("branchId", "slotAt");

-- CreateIndex
CREATE INDEX "appointments_orgId_idx" ON "appointments"("orgId");

-- CreateIndex
CREATE INDEX "notifications_status_createdAt_idx" ON "notifications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_branchId_idx" ON "notifications"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_tokenId_event_key" ON "notifications"("tokenId", "event");

-- CreateIndex
CREATE INDEX "audit_logs_orgId_createdAt_idx" ON "audit_logs"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_branchId_createdAt_idx" ON "audit_logs"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "daily_stats_orgId_date_idx" ON "daily_stats"("orgId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_stats_branchId_serviceId_date_key" ON "daily_stats"("branchId", "serviceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_orgId_key_key" ON "idempotency_keys"("orgId", "key");

-- CreateIndex
CREATE INDEX "_CounterServices_B_index" ON "_CounterServices"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counters" ADD CONSTRAINT "counters_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "counters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CounterServices" ADD CONSTRAINT "_CounterServices_A_fkey" FOREIGN KEY ("A") REFERENCES "counters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CounterServices" ADD CONSTRAINT "_CounterServices_B_fkey" FOREIGN KEY ("B") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
