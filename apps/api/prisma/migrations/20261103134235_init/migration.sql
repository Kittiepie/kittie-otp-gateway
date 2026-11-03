-- CreateEnum
CREATE TYPE "client_status" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "otp_channel" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "otp_status" AS ENUM ('REQUESTED', 'SENT', 'FAILED', 'VERIFIED', 'LOCKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "otp_event_type" AS ENUM ('REQUESTED', 'SENT', 'FAILED', 'VERIFIED', 'LOCKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "admins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "status" "client_status" NOT NULL DEFAULT 'active',
    "rate_limit_per_min" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_requests" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "recipient_masked" TEXT NOT NULL,
    "recipient_hash" TEXT NOT NULL,
    "channel" "otp_channel" NOT NULL,
    "purpose" TEXT,
    "status" "otp_status" NOT NULL DEFAULT 'REQUESTED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ(3),

    CONSTRAINT "otp_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "type" "otp_event_type" NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_prefix_key" ON "api_keys"("prefix");

-- CreateIndex
CREATE INDEX "api_keys_client_id_idx" ON "api_keys"("client_id");

-- CreateIndex
CREATE INDEX "otp_requests_client_id_created_at_idx" ON "otp_requests"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "otp_requests_created_at_idx" ON "otp_requests"("created_at");

-- CreateIndex
CREATE INDEX "otp_requests_status_expires_at_idx" ON "otp_requests"("status", "expires_at");

-- CreateIndex
CREATE INDEX "otp_events_request_id_idx" ON "otp_events"("request_id");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_requests" ADD CONSTRAINT "otp_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_events" ADD CONSTRAINT "otp_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "otp_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
