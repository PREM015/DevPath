# Roadmap Content

How source documents become content in the app, and how to add to it.

---

## Sources

Two files, both outside this repository, in the parent directory:

| File | Contents |
| --- | --- |
| `# Complete Full Stack Interview Roa.txt` | The outline for all fifteen phases (lines 1–430), then the full body for phases 1–3 |
| `expand.md` | The expanded body for phases 4 onward |

The parser reads the outline from the TXT and merges bodies from both. Order matters: the TXT
wins for structure, so the roadmap shape never depends on how far `expand.md` has been written.

---

## The pipeline

```
# Complete Full Stack Interview Roa.txt  ┐
                                        ├─> scripts/parse-roadmap.mjs
expand.md                               ┘        │
                                                 v
                                  prisma/seed-data/phase-01..15.json
                                                 │
                        ┌────────────────────────┴─────────────────────┐
                        v                                              v
        scripts/generate-outline.mjs                        prisma/seed.ts
                        │                                              │
                        v                                              v
        src/content/phase-outlines.ts                          PostgreSQL
           (landing page only)
```

Run it all with:

```bash
npm run content:sync
```

Never write to the database directly. Change the source, re-run, and the database follows.

---

## Why the JSON is generated *and* committed

`prisma/seed-data/*.json` is a build artefact, but committing it means a content change shows up
in a diff as data:

```
- "questions": [{ "text": "What is a closure?" }]
+ "questions": [{ "text": "What is a closure?", "answer": "A function plus its lexical environment." }]
```

You can see exactly what one edit to `expand.md` did to the app, without running anything.

---

## How a section is parsed

`scripts/lib/parse-section.mjs` is a line-oriented state machine. It tracks a `current` field and
appends each line to whichever field is open.

Recognised shapes:

| Shape | Example | Result |
| --- | --- | --- |
| Bold label | `**Why interviewers ask:** ...` | Sets the field |
| Bold model answer | `**Model answer, Q3:** ...` | Attached to question 3 |
| Bullet | `- item` | Appended to the open field |
| Numbered | `1. item` | Question if `Questions` is open |
| Markdown table | `\| # \| Question \| Key points \|` | Question + answer rows |
| Code fence | ` ``` ` … ` ``` ` | `__reference`, never parsed as prose |
| Inline answer | `- What is X? *(answer)*` | Split into question and answer |

Label matching is prefix-based, so `Mistakes` and `Common mistakes` both work. Labels resolve
most-specific-first so a short prefix cannot shadow a longer one.

### Fields produced

`definition`, `whyAsked`, `keyConcepts[]`, `mistakes[]`, `practice[]`, `selfCheck[]`,
`resources[]`, `questions[]`, `modelAnswer[]`, `sayOutLoud`, `interviewSignal`, `probe[]`,
`wrongAnswers[]`, `tradeoffs[]`, `prerequisites[]`, `symptoms[]`, `investigation[]`,
`rootCause[]`, `fix[]`, `prevention[]`, `tools[]`, and `__reference`.

### The markdown-table fallback

A large share of the authored rapid-fire and Q&A material is a three-column table:

```markdown
| # | Question | Key points |
|---|---|---|
| 1 | What happens when you type a URL? | URL parse -> DNS -> TCP -> TLS -> HTTP -> render |
```

The line-oriented pass cannot see cells, so without a table fallback every one of these blocks
would arrive with zero items and its questions would be absent from the question bank. The
fallback recognises a question column, takes the last column as the key points, and emits a
question per row.

This is why the bank grew from 4,111 to 4,938 questions and from 594 to 1,432 answered: the
content existed all along, in tables.

---

## Practice blocks versus topics

Not everything is knowledge. Drills, scenarios, rapid-fire sets and checklists are practice, and
turning them into topics would inflate roadmap completion and pollute the roadmap graph.

Recognised by heading archetype:

| Heading contains | Becomes | `kind` |
| --- | --- | --- |
| `RAPID-FIRE` | practice block | `RAPIDFIRE` |
| `DEBUGGING SCENARIO` | practice block | `SCENARIO` |
| `INTERVIEW Q&A` | practice block | `QA` |
| `MACHINE-CODING` | practice block | `MACHINE_CODING` |
| `READINESS CHECKLIST` | practice block | `CHECKLIST` |
| `TRACE`, `DRILL`, `FROM-SCRATCH`, `Q&A (n questions` | practice block | `DRILL` |
| `REFERENCE`, `CHEAT`, `APPENDIX` | practice block | `REFERENCE` |

Blocks are filed against a phase by, in order: their own numbering, the numbering of the topic
they follow, then a title match. A phase-level block such as `PHASE 3 RAPID-FIRE` has no parent
topic, so it lands on the phase it appears in.

The parser reports `unplaceable practice blocks` when it cannot file one. That number should be
zero; if it is not, the block's heading does not identify a phase.

### Scenarios carry a runbook

`SCENARIO` blocks keep the fields an interviewer grades in order:

```
symptoms[] -> investigation[] -> rootCause[] -> fix[] -> prevention[] + tools[]
```

The UI reveals them in that order, so a candidate can self-test the diagnosis before seeing the
conclusion.

### When a block is not structured

A block written as a table or prose has no structured fields. Rather than dropping it, the raw
body is stored in `markdown` and rendered verbatim. Roughly a third of blocks currently rely on
this. No authored content is ever discarded.

---

## Writing content

Append to `expand.md` under the phase heading. Use the labels the parser understands, otherwise
the text is stored as reference and will not reach the question bank.

A well-formed topic section:

```markdown
# 6.2 Index design

**Definition:** a data structure that trades write cost for read speed.

**Why interviewers ask:** "the table is slow" is the most common production database question,
and the answer is nearly always a missing or wrong index.

**How to think about it**
- B-tree for range scans and equality.
- Hash for exact match only.
- Composite column order follows the query's filter order.

**Say out loud:** "I'd start with the access pattern, then pick the index that serves it..."

**Questions**
1. When would a hash index beat a B-tree?
2. Why does column order matter in a composite index?

**Model answer, Q1:** Only for equality lookups...

**Evaluation:** names the access pattern before the index type; explains the cost on writes.

**Probe:** "what happens to that index on a hot write path?"

**Wrong answers:** "B-tree because it's always faster" — correct only for range scans.

**Trade-offs:** every index is a write tax.

**Prerequisites:** B-tree structure, query plans.

**Mistakes:** indexing low-cardinality columns first in a composite key.

**Code**
```sql
CREATE INDEX CONCURRENTLY idx_orders_user_created
  ON orders (user_id, created_at DESC);
```
```

A well-formed drill:

```markdown
# 6.2 RAPID-FIRE

| # | Question | Key points |
|---|---|---|
| 1 | What does an index cost on writes? | Every insert and update must update it |
| 2 | When is a hash index wrong? | It cannot do range scans |
```

A well-formed scenario:

```markdown
# 6.2 DEBUGGING SCENARIOS (3)

## Scenario 1 - A query that got slow overnight

**Symptoms:** p50 unchanged, p99 up 40x. Only the reporting query.

**Likely causes:** a new index build blocked writes; autovacuum fell behind; the plan flipped to
a sequential scan after a statistics update.

**Investigation:** `EXPLAIN (ANALYZE, BUFFERS)` before and after; check `pg_stat_user_tables`
for a bloat ratio; compare `last_autoanalyze` against the plan change time.

**Fix:** refresh statistics, rebuild the index concurrently, pin the plan if the flip recurs.

**Prevention:** alert on bloat ratio and plan-flip count; keep a canary query per hot endpoint.
```

### Rules

1. **One `#` heading per topic.** The parser uses headings to delimit sections.
2. **Label before content.** A bullet with no label above it lands in `keyConcepts` by default,
   which is usually not what you want.
3. **Do not hand-edit `prisma/seed-data/`.** It is overwritten on every parse.
4. **Do not hand-edit the database.** Re-run `content:sync`.
5. **Mark new material.** A `🆕` marker records that a topic is new rather than original, which
   the parser stores as `origin`.

---

## Checking the result

```bash
npm run content:coverage
```

```
Phase                               Topics   Deep   Quest    Ans  Blocks
------------------------------------------------------------------------------
 1. Interview Preparation Foundati       48     39     135      0       2
 6. Database Systems                   189    135     514     33       3
 8. DevOps and Cloud                   109     36     360     34       0
------------------------------------------------------------------------------
TOTAL                                 1482    813    4938   1432     141

NEXT BATCH: 0 phase(s) have structure but no authored content

Model-answer coverage below 50% (highest value to fill next):
  - Phase 1: 0/135 (0%)
  - Phase 6: 33/514 (6%)
```

- **Topics** — in the roadmap
- **Deep** — have an authored body, not just an outline title
- **Quest** — questions
- **Ans** — questions with a model answer
- **Blocks** — practice blocks

The tail of the report names where to write next. `--json` gives machine-readable output.

---

## Testing the parser

```bash
npm run content:test
```

32 assertions over `parse-section.mjs`, no database required. They cover each field, the
markdown-table fallback, inline answers, code fences, and the edge cases that would otherwise
silently drop content: a section with a table but no labels, a table with no question column, and
an empty section.

Run these before committing a parser change. If you add a label, add an assertion for it.

---

## Idempotency and pruning

The seed upserts by `key`, so re-running never duplicates content. It also **prunes**: rows whose
key is not written by the current run are deleted.

```
  interview: 4938 questions (1432 with a model answer), 141 practice blocks with 1087 items
  pruned:    813 questions, 140 blocks that are no longer in the source
```

That first run after a key-format change is expected. A second run should print no `pruned:` line.

Pruning is deliberate. If a question is removed from the source, keeping it would leave a
candidate rating a question that no longer exists in their material. Attempt rows cascade with it,
which is correct — a removed question cannot be answered.

If you ever need to preserve content across a rename, keep the old heading as an alias rather
than relying on the old row surviving.

---

## Troubleshooting

**`unplaceable practice blocks` is not zero.** The block's heading does not identify a phase.
Check that it appears under a `# PHASE n` heading or after a numbered topic.

**A phase shows topics but zero questions.** The body has not been written, or it is stored as
reference because it has no recognised labels. `npm run content:coverage` shows `Deep: 0` for that
case, and the UI labels it "outline only".

**A question has no model answer.** It came from a `Questions` list with no `Model answer, Qn:`
label. Add the label; re-running the pipeline will attach it to the existing question by key
rather than creating a new one.

**Counts in the landing page are stale.** It reads `src/content/phase-outlines.ts`, which is
generated. Run `npm run content:outline`, or the full `content:sync`.

**Content shows but is unreachable.** Check `InterviewQuestion.phaseId` — a null there means the
block was filed but the question never got linked. `scripts/smoke.ts` asserts this is zero.

---

## Current state

| Phases | State |
| --- | --- |
| 1–8 | Full authored content |
| 9–13 | Outline mapped, bodies not yet written |
| 14–15 | Outline only |

Verified: 1,482 topics, 4,938 questions (1,432 with a model answer), 141 practice blocks with
1,087 items, of which 67 are debugging scenarios. Zero questions unlinked, zero without a phase.

Phases 9–13 have their topic outlines from the TXT but no authored body in either file. They are
labelled as such rather than padded. When the body is written, append it to `expand.md` under a
`# PHASE n` heading and run `npm run content:sync` — no code change needed.