-- CreateEnum
CREATE TYPE "PracticeKind" AS ENUM ('DRILL', 'SCENARIO', 'RAPIDFIRE', 'QA', 'MACHINE_CODING', 'CHECKLIST', 'REFERENCE');

-- CreateEnum
CREATE TYPE "AttemptResult" AS ENUM ('CONFIDENT', 'PARTIAL', 'BLANK');

-- CreateEnum
CREATE TYPE "DrillStatus" AS ENUM ('NOT_STARTED', 'ATTEMPTED', 'PASSED', 'NEEDS_WORK');

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "interviewJson" JSONB,
ADD COLUMN     "referenceMarkdown" TEXT,
ADD COLUMN     "troubleshootingJson" JSONB;

-- CreateTable
CREATE TABLE "InterviewQuestion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "modelAnswer" TEXT,
    "topicId" TEXT,
    "phaseId" TEXT,
    "groupId" TEXT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'INTERMEDIATE',
    "tagsJson" JSONB,
    "phaseOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeBlock" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "groupId" TEXT,
    "kind" "PracticeKind" NOT NULL,
    "title" TEXT NOT NULL,
    "afterTopicTitle" TEXT,
    "itemsJson" JSONB,
    "whyAsked" TEXT,
    "evaluationJson" JSONB,
    "sayOutLoud" TEXT,
    "probeJson" JSONB,
    "signal" TEXT,
    "symptomsJson" JSONB,
    "investigationJson" JSONB,
    "rootCauseJson" JSONB,
    "fixJson" JSONB,
    "preventionJson" JSONB,
    "toolsJson" JSONB,
    "mistakesJson" JSONB,
    "referenceMarkdown" TEXT,
    "markdown" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "result" "AttemptResult" NOT NULL,
    "secondsSpent" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "status" "DrillStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "checklistJson" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrillResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewPrep" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "company" TEXT,
    "role" TEXT,
    "level" TEXT,
    "interviewDate" TIMESTAMP(3),
    "focusJson" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewPrep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewQuestion_key_key" ON "InterviewQuestion"("key");

-- CreateIndex
CREATE INDEX "InterviewQuestion_phaseId_phaseOrder_idx" ON "InterviewQuestion"("phaseId", "phaseOrder");

-- CreateIndex
CREATE INDEX "InterviewQuestion_topicId_idx" ON "InterviewQuestion"("topicId");

-- CreateIndex
CREATE INDEX "InterviewQuestion_difficulty_idx" ON "InterviewQuestion"("difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeBlock_key_key" ON "PracticeBlock"("key");

-- CreateIndex
CREATE INDEX "PracticeBlock_phaseId_kind_idx" ON "PracticeBlock"("phaseId", "kind");

-- CreateIndex
CREATE INDEX "PracticeBlock_groupId_idx" ON "PracticeBlock"("groupId");

-- CreateIndex
CREATE INDEX "QuestionAttempt_userId_result_idx" ON "QuestionAttempt"("userId", "result");

-- CreateIndex
CREATE INDEX "QuestionAttempt_userId_lastAttemptAt_idx" ON "QuestionAttempt"("userId", "lastAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionAttempt_userId_questionId_key" ON "QuestionAttempt"("userId", "questionId");

-- CreateIndex
CREATE INDEX "DrillResult_userId_status_idx" ON "DrillResult"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DrillResult_userId_blockId_key" ON "DrillResult"("userId", "blockId");

-- CreateIndex
CREATE INDEX "InterviewPrep_userId_idx" ON "InterviewPrep"("userId");

-- AddForeignKey
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RoadmapGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeBlock" ADD CONSTRAINT "PracticeBlock_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeBlock" ADD CONSTRAINT "PracticeBlock_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RoadmapGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "InterviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillResult" ADD CONSTRAINT "DrillResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillResult" ADD CONSTRAINT "DrillResult_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "PracticeBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPrep" ADD CONSTRAINT "InterviewPrep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
