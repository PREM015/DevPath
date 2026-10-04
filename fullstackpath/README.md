# FullStackPath

An interview-preparation platform for full-stack engineers. Every question carries a model
answer, what the interviewer is grading, the probe they will follow up with, and the wrong
answers that lose the role.

The product is the recall loop:

1. get a real interview question
2. answer it **out loud** before seeing anything
3. reveal the model answer and compare
4. rate yourself `CONFIDENT` / `PARTIAL` / `BLANK`

That rating is the only progress data that drives anything. Reading a topic is not recall, and
completing a topic never marks its questions answered.

---

## Quick start

Requires Node 20+ and a PostgreSQL database.

```bash
npm install
npm run db:deploy      # apply migrations
npm run db:seed        # load roadmap + interview content
npm run dev
```

Open http://localhost:3000, register an account, and go to **/interview**.

Email verification and password reset work without a provider — messages are logged to the
server console. Add an SMTP provider only if you want real delivery.

### Environment

Create `.env.local`:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/fullstackpath"
AUTH_SECRET="<openssl rand -base64 32>"
```

---

## What is in the app

| Route | What it does |
| --- | --- |
| `/interview` | The prep hub: questions to work next, drills due, readiness gaps |
| `/interview/questions` | Filterable question bank with reveal-answer and self-rating |
| `/interview/kit` | Drills, debugging scenarios, rapid-fire sets, readiness checklists |
| `/roadmap` | Fifteen phases as an explorable graph, with per-topic detail |
| `/revision` | Spaced repetition driven by your own recall ratings |
| `/learning` | Your active topics, queue, history and personal plan |
| `/projects` | The eight project milestones and your progress on each |
| `/notes` | Private per-topic notes |
| `/analytics` | Study time, streaks, recall breakdown — from your own rows only |
| `/settings` | Profile, targets, study goals, theme, data export |
| `/admin` | Content and user management |

### The interview model

- **`InterviewQuestion`** — shared content. Keyed by source, so re-seeding updates text instead
  of duplicating it. Lives either on a `Topic` or inside a `PracticeBlock`.
- **`QuestionAttempt`** — per user. The `CONFIDENT` / `PARTIAL` / `BLANK` rating.
- **`PracticeBlock`** — practice, not knowledge: `DRILL`, `SCENARIO`, `RAPIDFIRE`, `QA`,
  `MACHINE_CODING`, `CHECKLIST`, `REFERENCE`. Scenarios carry a full runbook
  (symptom → investigation → root cause → fix → prevention).
- **`DrillResult`** — per user, `PASSED` / `NEEDS_WORK` / `ATTEMPTED`.
- **`InterviewPrep`** — optional interview date, company and role.

Questions and blocks are shared. Only attempts, results and preparation records are private, and
every query filters them by the session's user id.

---

## Content pipeline

The content comes from files outside this repository:

- `# Complete Full Stack Interview Roa.txt` — the outline plus the full body for phases 1–3
- `expand.md` — the expanded body for phases 4 onward

Never hand-edit the database. Change the source, then run one command:

```bash
npm run content:sync
```

That runs, in order:

| Step | Command | Output |
| --- | --- | --- |
| 1 | `content:parse` | `prisma/seed-data/phase-*.json` |
| 2 | `content:outline` | `src/content/phase-outlines.ts` |
| 3 | `db:generate` | Prisma client |
| 4 | `db:seed` | database rows |
| 5 | `content:coverage` | the gap report |

The seed is idempotent and **prunes** rows whose key no longer appears in the source, so editing
the source and re-running never leaves ghost content behind.

### Checking coverage

```bash
npm run content:coverage
```

Prints, per phase: topics, how many have authored content, questions, how many have a model
answer, and practice blocks. Then it names the phases with the thinnest answer coverage, which is
where the next writing effort pays off.

```bash
npm run content:coverage -- --json    # machine-readable
```

### Authoring content

`expand.md` is the file to append to. The parser recognises these labels inside a topic section,
so writing them explicitly is what makes content reachable in the UI:

```markdown
**Definition:** one sentence.
**Why interviewers ask:** the signal being tested.
**How to think about it**
- Key point.
**Say out loud:** the phrasing to actually use.
**Questions**
1. The question?
2. Another?
**Model answer, Q1:** the full answer.
**Evaluation:** rubric point.
**Probe:** the follow-up they will use.
**Wrong answers:** what sounds right and is not.
**Trade-offs:** when the other answer wins.
**Prerequisites:** what to know first.
**Mistakes:** common errors.
```

A `Questions` table also works and is parsed into the bank:

```markdown
| # | Question | Key points |
|---|---|---|
| 1 | What is a closure? | Function plus its lexical environment, kept alive |
```

The other Q&A convention is a numbered question heading followed by an unnumbered answer. The
answer is attached to the heading above it, so keep them adjacent:

```markdown
### Q1. What is a closure?

**Model answer.**
A function plus its lexical environment, kept alive by reference.
```

Drills and scenarios are recognised by heading archetype (`RAPID-FIRE`, `DEBUGGING SCENARIOS`,
`READINESS CHECKLIST`, `INTERVIEW Q&A`, `MACHINE-CODING`) and stored as `PracticeBlock`s, not
topics, so they never inflate roadmap completion.

### Difficulty

Precedence, highest first:

1. an explicit marker on the topic (`### 4.1.9 useReducer 🔴`)
2. an explicit marker on the group heading (`### Caching Layers (🔴)`)
3. the per-phase default in `scripts/lib/difficulty.mjs`
4. `UNKNOWN_PHASE_DIFFICULTY`, for a phase with none of the above

Markers are `🟢` beginner, `🟡` intermediate, `🔴` advanced, `⚫` senior/staff, or the words
`(Beginner)`, `(Intermediate)`, `(Advanced)`, `(Senior)`. They are stripped from titles before
slugs are built, so adding a marker never changes an ID.

Only 19 of the 68 groups carry a marker, which is why the per-phase defaults exist. They were
derived by reading the source, and `PHASE_DIFFICULTY_EVIDENCE` records the reasoning per phase.
Note that Phases 14 and 15 default to `BEGINNER` on purpose: behavioural and career content is
not technically demanding, so difficulty does not rise with phase number.

### Content status

All fifteen phases now carry authored interview content: model answers, rubrics, probes, debugging
runbooks and reference material. Nothing is a bare outline.

| Measure | Value |
| --- | --- |
| Phases | 15 |
| Groups | 119 |
| Topics | 1,988 |
| Topics with an authored interview payload | 1,535 |
| Interview questions | 7,264 |
| Questions with a model answer | 2,875 |
| Practice blocks | 612 (5,142 items) |

The phases still thin on model answers are Phase 13, Phase 1, Phase 11 and Phase 14. Run
`npm run content:coverage` for current numbers and the ranked list of where to write next.

---

## Verifying a change

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # next build
npm run content:test # 32 parser unit tests, no database needed

npm run dev                                  # in one terminal
npm run smoke -- http://localhost:3000       # in another
```

`npm run smoke` runs 65 end-to-end checks against a running server: registration, login,
rate limiting, ownership isolation between two accounts, progress writes, analytics inputs,
archive behaviour, and the interview bank. It creates and deletes its own accounts.

---

## Scripts

| Script | Purpose |
| --- | --- |
| `dev` / `build` / `start` | Next.js |
| `typecheck` / `lint` | static checks |
| `db:generate` / `db:migrate` / `db:deploy` / `db:seed` / `db:reset` / `db:studio` | Prisma |
| `content:parse` | source files → `prisma/seed-data/*.json` |
| `content:outline` | seed data → static outline for the landing page |
| `content:coverage` | gap report against the database |
| `content:test` | parser unit tests |
| `content:sync` | all of the above, in order |
| `smoke` | end-to-end checks |
| `verify` | typecheck + lint + build |

---

## Further reading

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — how the app is put together and why
- [DATABASE.md](./docs/DATABASE.md) — every model, and the invariants they protect
- [API.md](./docs/API.md) — routes, server actions, and the error contract
- [ROADMAP_CONTENT.md](./docs/ROADMAP_CONTENT.md) — the content pipeline in detail
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) — production setup
- [DEVELOPMENT_STATUS.md](./docs/DEVELOPMENT_STATUS.md) — what is done and what is not

## Licence

Private project. No licence granted.