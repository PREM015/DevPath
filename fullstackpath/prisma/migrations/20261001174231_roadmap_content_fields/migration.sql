-- AlterTable
ALTER TABLE "Phase" ADD COLUMN     "objectivesJson" JSONB;

-- AlterTable
ALTER TABLE "RoadmapGroup" ADD COLUMN     "objectivesJson" JSONB;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "commonMistakesJson" JSONB,
ADD COLUMN     "objectivesJson" JSONB;
