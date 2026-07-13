-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "closed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "deals_closed_at_idx" ON "deals"("closed_at");

-- CreateIndex
CREATE INDEX "deals_amount_idx" ON "deals"("amount");
