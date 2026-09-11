-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('FRESH', 'INTERESTED', 'CONVERTED', 'CLOSED', 'IRRELEVANT');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('DIRECT', 'REFERRAL', 'WEBSITE', 'CAMPAIGN', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'MISSED');

-- CreateEnum
CREATE TYPE "FollowUpOutcome" AS ENUM ('CONNECTED', 'NOT_CONNECTED', 'INTERESTED', 'NOT_INTERESTED', 'CALLBACK_REQUESTED', 'CONVERTED');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "lead_stage" "LeadStage" NOT NULL DEFAULT 'FRESH',
ADD COLUMN     "lead_source" "LeadSource" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN     "revived_at" TIMESTAMP(3),
ADD COLUMN     "re_enquiry_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "deal_id" TEXT,
    "owner_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" "FollowUpOutcome",
    "notes" TEXT,
    "reschedule_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_lead_stage_idx" ON "contacts"("lead_stage");

-- CreateIndex
CREATE INDEX "contacts_lead_source_idx" ON "contacts"("lead_source");

-- CreateIndex
CREATE INDEX "contacts_revived_at_idx" ON "contacts"("revived_at");

-- CreateIndex
CREATE INDEX "follow_ups_contact_id_idx" ON "follow_ups"("contact_id");

-- CreateIndex
CREATE INDEX "follow_ups_deal_id_idx" ON "follow_ups"("deal_id");

-- CreateIndex
CREATE INDEX "follow_ups_owner_id_idx" ON "follow_ups"("owner_id");

-- CreateIndex
CREATE INDEX "follow_ups_status_idx" ON "follow_ups"("status");

-- CreateIndex
CREATE INDEX "follow_ups_scheduled_at_idx" ON "follow_ups"("scheduled_at");

-- CreateIndex
CREATE INDEX "follow_ups_completed_at_idx" ON "follow_ups"("completed_at");

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
