-- CreateEnum
CREATE TYPE "InterviewKind" AS ENUM ('CODING', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'MOCK', 'SCREENING', 'OTHER');

-- CreateEnum
CREATE TYPE "InterviewOutcome" AS ENUM ('PASSED', 'FAILED', 'PENDING', 'OFFER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REVISION_DUE', 'DAILY_GOAL', 'ACHIEVEMENT', 'SYSTEM');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'TOPIC_RESET';
ALTER TYPE "ActivityType" ADD VALUE 'NOTE_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'BOOKMARK_REMOVED';
ALTER TYPE "ActivityType" ADD VALUE 'PHASE_COMPLETED';
ALTER TYPE "ActivityType" ADD VALUE 'MOCK_INTERVIEW_LOGGED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "achievementNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dailyGoalReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "revisionIntervalsJson" JSONB,
ADD COLUMN     "revisionReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sessionsInvalidBefore" TIMESTAMP(3),
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'system';

-- CreateTable
CREATE TABLE "UserQueueItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockInterview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "round" TEXT,
    "kind" "InterviewKind" NOT NULL DEFAULT 'OTHER',
    "outcome" "InterviewOutcome",
    "difficulty" INTEGER,
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "topicsCoveredJson" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserQueueItem_userId_sortOrder_idx" ON "UserQueueItem"("userId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "UserQueueItem_userId_topicId_key" ON "UserQueueItem"("userId", "topicId");

-- CreateIndex
CREATE INDEX "MockInterview_userId_performedAt_idx" ON "MockInterview"("userId", "performedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "UserQueueItem" ADD CONSTRAINT "UserQueueItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQueueItem" ADD CONSTRAINT "UserQueueItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockInterview" ADD CONSTRAINT "MockInterview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
