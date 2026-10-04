-- AlterTable
ALTER TABLE "Revision" ADD COLUMN     "ladderIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Revision_userId_status_idx" ON "Revision"("userId", "status");
