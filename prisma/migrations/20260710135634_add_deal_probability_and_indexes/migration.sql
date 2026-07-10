-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "probability" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "deals_owner_id_idx" ON "deals"("owner_id");

-- CreateIndex
CREATE INDEX "deals_contact_id_idx" ON "deals"("contact_id");

-- CreateIndex
CREATE INDEX "deals_stage_idx" ON "deals"("stage");

-- CreateIndex
CREATE INDEX "deals_status_idx" ON "deals"("status");

-- CreateIndex
CREATE INDEX "deals_expected_close_date_idx" ON "deals"("expected_close_date");

-- CreateIndex
CREATE INDEX "deals_created_at_idx" ON "deals"("created_at");
