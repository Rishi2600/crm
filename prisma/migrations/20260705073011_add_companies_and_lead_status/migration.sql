/*
  Warnings:

  - You are about to drop the column `company` on the `contacts` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('HOT', 'WARM', 'COLD');

-- AlterTable
ALTER TABLE "contacts" DROP COLUMN "company",
ADD COLUMN     "company_id" TEXT,
ADD COLUMN     "is_favourite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lead_status" "LeadStatus" NOT NULL DEFAULT 'WARM',
ADD COLUMN     "location" TEXT;

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_company_id_idx" ON "contacts"("company_id");

-- CreateIndex
CREATE INDEX "contacts_owner_id_idx" ON "contacts"("owner_id");

-- CreateIndex
CREATE INDEX "contacts_created_at_idx" ON "contacts"("created_at");

-- CreateIndex
CREATE INDEX "contacts_first_name_idx" ON "contacts"("first_name");

-- CreateIndex
CREATE INDEX "contacts_last_name_idx" ON "contacts"("last_name");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
