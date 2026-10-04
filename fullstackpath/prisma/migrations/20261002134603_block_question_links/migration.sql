-- AlterTable
ALTER TABLE "InterviewQuestion" ADD COLUMN     "practiceBlockId" TEXT;

-- CreateIndex
CREATE INDEX "InterviewQuestion_practiceBlockId_idx" ON "InterviewQuestion"("practiceBlockId");

-- AddForeignKey
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_practiceBlockId_fkey" FOREIGN KEY ("practiceBlockId") REFERENCES "PracticeBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
