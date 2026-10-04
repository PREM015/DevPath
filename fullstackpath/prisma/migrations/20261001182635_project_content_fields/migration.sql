-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "estimatedHours" INTEGER,
ADD COLUMN     "objectivesJson" JSONB,
ADD COLUMN     "stackJson" JSONB;
