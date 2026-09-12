-- CreateEnum
CREATE TYPE "LeadSubStatus" AS ENUM ('UNTOUCHED', 'CONTACTED', 'NOT_REACHABLE', 'CALLBACK_REQUESTED', 'PROPOSAL_SENT', 'NEGOTIATING', 'WON', 'LOST', 'DROPPED', 'JUNK', 'DUPLICATE', 'OUT_OF_AREA');

-- CreateEnum
CREATE TYPE "LeadHistoryType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'REMARK_ADDED', 'DETAILS_UPDATED', 'FOLLOW_UP_SCHEDULED');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "lead_sub_status" "LeadSubStatus" NOT NULL DEFAULT 'UNTOUCHED',
ADD COLUMN     "lead_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "source_name" TEXT;

-- CreateTable
CREATE TABLE "lead_history" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "LeadHistoryType" NOT NULL,
    "from_value" TEXT,
    "to_value" TEXT,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_lead_sub_status_idx" ON "contacts"("lead_sub_status");

-- CreateIndex
CREATE INDEX "contacts_lead_score_idx" ON "contacts"("lead_score");

-- CreateIndex
CREATE INDEX "lead_history_contact_id_created_at_idx" ON "lead_history"("contact_id", "created_at");

-- CreateIndex
CREATE INDEX "lead_history_type_idx" ON "lead_history"("type");

-- AddForeignKey
ALTER TABLE "lead_history" ADD CONSTRAINT "lead_history_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_history" ADD CONSTRAINT "lead_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
