# Database

PostgreSQL via Prisma 7. The datasource uses the driver adapter (`@prisma/adapter-pg`), so no
binary engine is downloaded.

Schema: [`prisma/schema.prisma`](../prisma/schema.prisma)
Migrations: `prisma/migrations/` — eight, applied in order with `npm run db:deploy`.

---

## Content — shared, never user-owned

| Model | Purpose |
| --- | --- |
| `Phase` | One of fifteen stages. Ordered, coloured, archivable. |
| `RoadmapGroup` | A group of topics inside a phase. |
| `Topic` | A knowledge topic. Carries the parsed section payload. |
| `TopicPrerequisite` | Directed prerequisite edge between topics. |
| `TopicRelation` | Non-hierarchical edge (`PREREQUISITE`, `RELATED`, `CONTRASTS`, `EXTENDS`). |
| `Project` | A portfolio milestone with a checklist. |
| `Achievement` | A definition; unlocks are per user. |
| `InterviewQuestion` | A question in the bank. The core of the app. |
| `PracticeBlock` | A drill, scenario, rapid-fire set, checklist or reference. |

### Topic content fields

The parser writes a shaped payload per topic rather than flattening to prose:

| Column | Holds |
| --- | --- |
| `interviewJson` | `whyAsked`, `evaluation[]`, `sayOutLoud`, `probe[]`, `wrongAnswers[]`, `tradeoffs[]`, `prerequisites[]`, `keyConcepts[]`, `mistakes[]`, `interviewSignal` |
| `interviewQsJson` | `[{ text, answer }]` — the topic's questions and model answers |
| `troubleshootingJson` | `symptoms[]`, `investigation[]`, `rootCause[]`, `fix[]`, `prevention[]`, `tools[]` |
| `referenceMarkdown` | Code fences and diagrams, kept verbatim |
| `practiceTasksJson` | Exercises and self-checks |
| `objectivesJson` / `keyConceptsJson` / `commonMistakesJson` / `resourcesJson` | Study material |

These are `Json?`. A topic whose body was never authored has them all `NULL` — which is how the
app distinguishes "outline only" from "written but thin".

### InterviewQuestion

```prisma
model InterviewQuestion {
  key             String    @unique   // derived from the source, never from a user
  text            String    @db.Text
  modelAnswer     String?   @db.Text
  topicId         String?
  phaseId         String?
  groupId         String?
  practiceBlockId String?            // authored inside a drill instead of on a topic
  difficulty      Difficulty @default(INTERMEDIATE)
  tagsJson        Json?
  phaseOrder      Int       @default(0)
  isActive        Boolean   @default(true)
}
```

Two things to know:

**`key` is the identity.** It is built from the source document, so re-seeding updates text in
place instead of creating duplicates. Block-authored questions use
`block::<phase>::<kind>::<title-slug>::<ordinal>::<index>`.

**A question belongs to a topic or a block, not both.** `topicId` and `practiceBlockId` are
mutually exclusive in practice: rapid-fire and Q&A material is authored inside a practice block,
so its questions hang off the block. The seed enforces this and the smoke suite asserts no
question is left with neither.

### PracticeBlock

```prisma
model PracticeBlock {
  key        String      @unique
  phaseId    String      // required: a block with no phase is unreachable
  kind       PracticeKind
  title      String
  order      Int
  itemsJson           Json?   // checklist / bullet items
  whyAsked            String?
  evaluationJson      Json?
  sayOutLoud          String?
  probeJson           Json?
  signal              String?
  symptomsJson        Json?   // scenario runbook, in this order
  investigationJson   Json?
  rootCauseJson       Json?
  fixJson             Json?
  preventionJson      Json?
  toolsJson           Json?
  mistakesJson        Json?
  referenceMarkdown   String?
  markdown            String? // verbatim source when it is not structured
}
```

`kind` is one of `DRILL`, `SCENARIO`, `RAPIDFIRE`, `QA`, `MACHINE_CODING`, `CHECKLIST`,
`REFERENCE`. The archetype is taken from the source heading, so the same drill is never mistaken
for a topic.

`markdown` exists because a block written as a table or prose has no structured fields. Rather
than dropping the authored content, it is stored and rendered verbatim. This currently affects
roughly a third of blocks.

---

## User data — private, filtered by session

| Model | Purpose |
| --- | --- |
| `User` | Account, role, goals, timezone, target role and level |
| `UserTopicProgress` | Per-topic status. Created on first explicit action, never on view. |
| `StudySession` | A timed study session, feeding analytics and streaks |
| `UserNote` | Private markdown note, optionally linked to a topic |
| `Bookmark` | Saved topic; the unique index makes it idempotent |
| `Revision` + `RevisionHistory` | The spaced-repetition ladder and its history |
| `UserQueueItem` | The candidate's study queue |
| `UserProjectProgress` | Per-project checklist state |
| `UserAchievement` | Unlock record |
| `LearningGoal` | Daily/weekly target |
| `LearningActivity` | Append-only activity feed |
| `MockInterview` | Interview log with kind and outcome |
| `InterviewPrep` | Optional date, company and role for a real interview |
| `QuestionAttempt` | **The core progress record.** One row per user per question. |
| `DrillResult` | `PASSED` / `NEEDS_WORK` / `ATTEMPTED` per user per block |
| `Notification` | Per-user notification |
| `AuditLog` | Administrative actions |

### QuestionAttempt — the only real progress

```prisma
model QuestionAttempt {
  userId        String
  questionId    String
  result        AttemptResult   // CONFIDENT | PARTIAL | BLANK
  attempts      Int      @default(1)
  lastAttemptAt DateTime
  @@unique([userId, questionId])
  @@id([userId, questionId])
}
```

The composite key means one row per user per question. Re-rating updates it, so the row count is
an honest count of questions attempted — not a count of clicks.

This table is deliberately the only thing the readiness view reads. Roadmap completion lives in
`UserTopicProgress` and is a separate concern: a candidate can have completed 200 topics and
still rate every question blank, and the app will say so.

---

## Auth tables

`Account`, `Session`, `VerificationToken`, `PasswordResetToken`. Managed by Auth.js v5 plus a
custom reset token with `usedAt` so a link cannot be replayed.

Passwords are bcrypt hashes. Password reset tokens are stored hashed and single-use.

---

## Invariants enforced by the database

| Invariant | Mechanism |
| --- | --- |
| One progress row per user per topic | `@@id([userId, topicId])` on `UserTopicProgress` |
| One bookmark per user per topic | `@@unique([userId, topicId])` |
| One attempt per user per question | `@@id([userId, questionId])` |
| One revision per user per topic | `@@unique([userId, topicId])` |
| Re-seeding cannot duplicate content | `key` is `@unique` on `InterviewQuestion` and `PracticeBlock` |
| A block is always reachable | `phaseId` is required on `PracticeBlock` |
| Deleting content clears dependent rows | `onDelete: Cascade` throughout |
| Ownership cannot be lost | no cascade path from `User` to content, only to user rows |

The last row matters: there is no foreign key from a content row to a `User`, so deleting an
account cannot orphan or reassign shared content. User rows cascade; content does not.

---

## Enums

`Role`, `LearnerRole`, `TargetLevel`, `Difficulty`, `ProgressStatus`, `RevisionStatus`,
`RevisionResult`, `ProjectStatus`, `GoalStatus`, `ActivityType`, `RelationType`, `InterviewKind`,
`InterviewOutcome`, `NotificationType`, `PracticeKind`, `AttemptResult`, `DrillStatus`.

`Difficulty` is `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `SENIOR` — note there is no `MEDIUM`;
block-authored questions default to `INTERMEDIATE`.

---

## Migrations

| Migration | Adds |
| --- | --- |
| `20261001171151_init` | Auth and base tables |
| `20261001173336_user_features` | Progress, notes, bookmarks, goals |
| `20261001174231_roadmap_content_fields` | Structured content columns on `Topic` |
| `20261001174453_revision_ladder` | Revision and history |
| `20261001182635_project_content_fields` | Project checklist and links |
| `20261002045627_interview_prep_models` | `InterviewQuestion`, `PracticeBlock`, `QuestionAttempt`, `DrillResult`, `InterviewPrep` |
| `20261002050625_activity_types` | Extended `ActivityType` values |
| `20261002134603_block_question_links` | `InterviewQuestion.practiceBlockId` |

### Adding a migration

```bash
npx prisma migrate dev --name what_changed
npm run db:generate
npm run typecheck
```

Never edit an applied migration. In development, `migrate dev` is fine. In production, use
`migrate deploy`, which only applies what is pending.

---

## Current row counts

Verified against the local database after a full `npm run content:sync`:

| Table | Rows |
| --- | --- |
| `Phase` | 15 |
| `RoadmapGroup` | 93 |
| `Topic` | 1,482 |
| `InterviewQuestion` | 4,938 |
| `InterviewQuestion` with a model answer | 1,432 |
| `InterviewQuestion` authored in a block | 809 |
| `PracticeBlock` | 141 |
| `Project` | 8 |
| `Achievement` | 14 |

Check the live numbers any time:

```bash
npm run content:coverage
```

---

## Inspecting

```bash
npm run db:studio
```

Useful checks when something looks wrong:

```sql
-- Questions that reach no phase: must be zero.
SELECT count(*) FROM "InterviewQuestion" WHERE "phaseId" IS NULL;

-- Questions linked to neither a topic nor a block: must be zero.
SELECT count(*) FROM "InterviewQuestion"
WHERE "topicId" IS NULL AND "practiceBlockId" IS NULL;

-- Blocks with no content in any field: should be zero.
SELECT key, kind FROM "PracticeBlock"
WHERE jsonb_array_length("itemsJson") = 0
  AND "markdown" IS NULL
  AND "whyAsked" IS NULL;

-- Recall distribution for one user.
SELECT result, count(*) FROM "QuestionAttempt"
WHERE "userId" = '<id>' GROUP BY result;
```

If the first two return non-zero, the seed did not run to completion — the parser reports
`unplaceable practice blocks` when it cannot file content, and the seed prints the count it
wrote.