# Development Status

An honest picture of what is built, what is verified, and what is not. Read this before trusting
a number on a screen.

Last verified against a local database after `npm run content:sync`, with `tsc --noEmit` clean,
`eslint` reporting zero errors **and zero warnings**, `next build` succeeding, all 32 parser tests
passing, and 65/66 smoke checks passing.

---

## Verified

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | 0 errors |
| Lint | `npm run lint` | 0 errors, 0 warnings |
| Production build | `npm run build` | succeeds, 28 routes |
| Parser tests | `npm run content:test` | 32/32 |
| End-to-end | `npm run smoke -- http://localhost:3130` | 67/67 |
| Content integrity | `npm run content:coverage` | 0 unlinked, 0 orphaned, 0 empty groups |

Every one of the 15 phases reports a non-zero topic denominator, so no phase percentage can
render as `NaN`.

---

## Content

| Measure | Value |
| --- | --- |
| Phases | 15 mapped, **all with authored content** |
| Groups | 118 active (1 empty group dropped at parse time) |
| Topics | 1,894 active (143 archived after a title-splitting fix) |
| Topics with an authored interview payload | 1,503 |
| Questions in the bank | 6,907 |
| Questions with a model answer | 2,860 (41%) |
| Practice blocks | 612 |
| Practice items | 4,812 |
| Debugging scenarios | 146 |
| Projects | 8 |
| Achievements | 14 |

### The Phase 9–13 gap is closed

An earlier version of this file recorded that phases 9–13 had no authored body, because
`expand.md` stopped at Phase 8. `expand.md` now carries the full expanded edition through Phase 15,
and all fifteen phases have real interview content. The `Deep: 0` signal that used to appear for
those phases is gone.

### Model answers cover 40%

`npm run content:coverage` names the phases where answer coverage is thinnest, which is where the
next writing effort pays:

| Phase | Answered | Total | Coverage |
| --- | --- | --- | --- |
| 13 | 0 | 24 | 0% |
| 1 | 6 | 150 | 4% |
| 11 | 12 | 181 | 7% |
| 14 | 20 | 169 | 12% |
| 5 | 254 | 1,189 | 21% |
| 8 | 161 | 602 | 27% |

Unanswered questions are still drillable — you commit to an answer and rate yourself — but there is
nothing to compare against, which weakens the loop for exactly those questions.

### Fixing a gap

1. Append the missing content to `expand.md` under its `# PHASE n` heading.
2. `npm run content:sync`.
3. `npm run content:coverage` to confirm the numbers moved.

No code change is needed.

---

## Built and working

### The core loop

- Question bank with reveal-answer and `CONFIDENT` / `PARTIAL` / `BLANK` self-rating
- Dashboard leads with worst-recall-first questions, not topic completion
- Rating a question never touches topic progress — separate models, deliberately
- Practice kit: drills, debugging scenarios with symptom-first reveal, rapid-fire, machine
  coding, readiness checklists
- Blocks that pass their per-item checklist now record a tick per user, stored on `DrillResult`
  and rendered with an optimistic update that rolls back if the write fails.
- Path recommendations score every candidate topic before slicing. Truncating in the database
  first (the previous `take: 200`) meant a learner whose recommended phases held more than 200
  topics — Phase 5 alone has 244 — never saw topics from whichever phase sorted last.
- Per-block `PASSED` / `NEEDS_WORK` state
- Interview preparation record: date, company, role
- Readiness reported as actionable counts. No invented "job-ready" score

### Content integrity

- Markdown-table questions are parsed into the bank, recovering hundreds of questions and model
  answers that a line-oriented pass cannot see.
- A `### Qn. question` heading followed by an unnumbered `**Model answer.**` block is paired
  correctly. This recovered 266 questions with their answers in one pass, including all of Phase
  12's Q&A, which had been parsed as zero questions.
- **Topic titles are split on commas at paren depth zero only.** A naive split turned
  "LLM API integration (OpenAI, Anthropic, etc.)" into three topics, two of them fragments like
  `etc.)`, and left a leading `- ` on the first topic of every bullet.
- **Structural prose labels are recognised.** Labels such as `Mechanics.`, `Why it exists.`,
  `Production considerations` and `When to use vs when not to` were previously unrecognised: the
  label text became a key concept *and* the paragraph beneath it was discarded, because prose is
  only collected for a known open field. They now map to a `bodyOnly` field that keeps the prose
  and discards the label.
- **Derived interview prompts are filtered.** When a topic has no explicit question list, prompts
  are generated from its concepts. Fragments and sentences are skipped, so the bank no longer
  contains prompts like `Explain mechanics. and when you would use it.`
- Groups **and topics** that leave the source are **archived, never deleted**: deleting would
  cascade into every learner's progress and attempts. Archiving takes them off the roadmap while
  keeping history, and returning rows are reactivated by the upsert.
- Groups that parse to zero topics are dropped, so a learner never opens an empty branch.
- Idempotent: a second `db:seed` writes nothing, prunes nothing and archives nothing.

### Auth and isolation

- Registration, login, verification, password reset, single-use reset tokens
- Rate limiting on auth endpoints, generic failure messages
- Database-level ownership on progress, notes, bookmarks, revisions, attempts, drill results
- Two accounts cannot see or modify each other's data — asserted in the smoke suite, not assumed

### Supporting product

Roadmap graph, topic pages (interview-first layout), progress, study sessions, spaced repetition,
queue, notes, bookmarks, projects, achievements, analytics, mock interview log, notifications,
search, admin content and user management.

---

## Not done

Listed so it is not mistaken for working.

| Area | State |
| --- | --- |
| **Vitest / Playwright** | No formal unit or browser test suite. Parser checks run on a custom runner; end-to-end runs through `scripts/smoke.ts`. Both work, neither is a standard harness. |
| **Unit tests for streak and progress rules** | Not written. Streak arithmetic (`src/lib/utils/time.ts`) and revision scheduling (`src/server/services/revision.ts`) are only covered indirectly, by the smoke suite. These are the rules most likely to be quietly wrong. |
| **Browser tests** | None. No Playwright, so client-side interaction, focus management and responsive layout are unverified in a real browser. |
| **Model answers for phases 13, 1, 11, 14** | See the coverage table above. The questions exist and are drillable; the answers do not. |
| **Production database** | Not configured. Local PostgreSQL only; no Neon or other remote instance. Deployment steps are in `DEPLOYMENT.md`. |
| **Email delivery** | Falls back to the server console when `RESEND_API_KEY` is unset. This now logs a one-time warning in production so it cannot fail silently, but **a user who forgets their password still cannot recover their account** until a provider key is set. |
| **OAuth providers** | Credentials only. `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` are unset, so there is no Google or GitHub sign-in. |
| **Search index** | `ilike` over question text. Fine at ~7,000 rows, not at 500,000. |
| **Rate limiting on content-mutating actions** | Auth endpoints only. Acceptable for a single-tenant study tool; add throttling before opening it to untrusted traffic. |
| **Localisation** | English only. |
| **Offline / PWA** | Not supported. |
| **Mobile app** | Responsive web only. |

---

## Known issues

**Difficulty classification is heuristic, and two areas remain soft.** Difficulty comes from an
explicit marker where one exists, otherwise from a per-phase default table in
`scripts/lib/difficulty.mjs`, otherwise from the group. That table was derived by reading the
source, and its reasoning is recorded per phase in `PHASE_DIFFICULTY_EVIDENCE` so it can be
re-derived rather than trusted. Two known-soft areas:

- **Within-group spread.** A group inherits one difficulty for all its topics. In Phase 5, "Event
  emitter" and "Outbox pattern" both land in the same group and therefore the same class, though
  they are not equally demanding. Fixing this needs per-topic authoring, not a code change.
- **Phases 14 and 15 are `BEGINNER` by default** despite being the last phases. They are
  behavioural and career material and are genuinely not technically demanding, so this is
  intentional — but it will look wrong to anyone who assumes difficulty rises with phase number.

**Auth.js v5 is a beta.** It is pinned to an exact version because the API is still moving. An
upgrade needs re-reading the migration notes, not just bumping the number.

**The parser depends on authored heading conventions.** It is a heuristic parser, not a formal
grammar. If a heading style changes, the fix is in `scripts/parse-roadmap.mjs` archetype matching
or `scripts/lib/parse-section.mjs` label resolution. Both have unit tests; add one when you change
either.

**A `### Qn.` heading inside a block used to truncate that block.** Any heading that was neither a
numbered topic nor a known archetype was treated as a section boundary, so a Q&A block was cut off
at its first question and every answer after it was lost. Question headings are now kept with the
block that owns them. If you add a new heading style inside a block, check it does not match the
section-boundary branch.

**Content keys are derived from source text.** Renaming a topic heading changes its key, which
means the old row is pruned and a new one created. Candidate attempts on that topic cascade and
are lost. Keep old headings as aliases, or accept the reset. This is a real trade-off: pruning
keeps the app honest about what is in your material, and costs history on a rename.

**Prisma 7 with the driver adapter** means no generated engine binary, which simplifies
deployment, but the client is generated into `src/generated/` and must be regenerated after any
schema change before `next build` will type-check.

---

## Suggested order of work

If you are picking this up next:

1. **Fill model answers for phases 13, 1, 11 and 14.** Phase 1 is where candidates start.
2. **Split within-group difficulty** where a group spans an easy topic and a hard one. This needs
   authoring decisions, not code.
3. **Add Vitest** for streak arithmetic and revision scheduling.
4. **Wire SMTP**, then deploy to Vercel with a Neon database.
5. **Add Playwright** for the reveal-answer and rating flow — the one interaction that defines the
   product and is currently only tested at the HTTP level.

---

## How to extend

See [ROADMAP_CONTENT.md](./ROADMAP_CONTENT.md) for the content pipeline and authoring rules,
[ARCHITECTURE.md](./ARCHITECTURE.md) for the data-access rule, and
[API.md](./API.md) for adding a query or an action. The one constraint to keep: all database
access stays in `src/server/services`, taking `userId` as the first argument.