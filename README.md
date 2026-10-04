# Full Stack Interview Roadmap

A complete, self-contained interview-preparation roadmap — zero to staff engineer — and the
platform built on top of it.

This repository holds two things:

1. **The roadmap content.** 15 phases, 119 groups, 1,988 topics, 7,264 interview questions and
   612 practice blocks.
2. **FullStackPath**, a multi-user Next.js app that turns that content into a recall loop with
   real per-user progress, spaced repetition, notes, analytics and an admin CMS.

---

## Layout

```
.
├── plan.md                                  # the product specification
├── README.md                                # this file
│
├── # Complete Full Stack Interview Roa.txt  # roadmap: structure + full body, phases 1-15
├── expand.md                                # the expanded edition, phases 4-15 (the bulk)
│
└── fullstackpath/                           # the application  ->  start here
    ├── README.md                            # setup, scripts, content pipeline
    ├── docs/                                # architecture, database, API, deployment, status
    ├── prisma/                             # schema, migrations, seed
    ├── scripts/                             # content parser + end-to-end smoke suite
    └── src/                                 # app routes, features, services
```

### The two content files

| File | What it is |
| --- | --- |
| `# Complete Full Stack Interview Roa.txt` | The canonical roadmap. The top of the file is the compact outline of all 15 phases; the expanded edition follows underneath. |
| `expand.md` | The same expanded edition for phases 4–15, kept separately because it is large. |

They are **generated content — do not hand-edit to "fix" wording**. The app reads both; see
[Authoring content](#authoring-content).

---

## Quick start

You need **Node 20+** and a **PostgreSQL** database.

```bash
cd fullstackpath
npm install
cp .env.example .env.local        # then edit DATABASE_URL and AUTH_SECRET
npm run db:deploy                 # apply migrations
npm run db:seed                   # load the roadmap + interview content
npm run dev
```

Open <http://localhost:3000>, register an account, and go to **`/interview`**.

Generate an auth secret with:

```bash
openssl rand -base64 32
```

Full detail, including every environment variable, is in
[`fullstackpath/README.md`](./fullstackpath/README.md).

---

## Working with the content

The database is **never** the place to edit content. Change a source file, then run one command:

```bash
cd fullstackpath
npm run content:sync
```

That re-parses both content files, regenerates the seed data and the static outline, reloads the
database and prints a coverage report. The seed is idempotent and prunes rows whose source text is
gone, so you never accumulate ghost content.

To see where the content is thin before writing anything:

```bash
npm run content:coverage
```

### Authoring content

The parser recognises these labels inside a topic section. Writing them explicitly is what makes
content reachable in the UI:

```markdown
**Definition:** one sentence.
**Why interviewers ask:** the signal being tested.
**How to think about it**
- Key point.
**Say out loud:** the phrasing to actually use.
**Questions**
1. The question?
**Model answer, Q1:** the full answer.
**Evaluation:** rubric point.
**Probe:** the follow-up they will use.
**Wrong answers:** what sounds right and is not.
**Trade-offs:** when the other answer wins.
**Mistakes:** common errors.
```

A second convention is also supported — a question heading followed by an unnumbered answer:

```markdown
### Q1. What is a closure?

**Model answer.**
A function plus its lexical environment, kept alive by reference.
```

Practice material is recognised by its heading — `RAPID-FIRE`, `DEBUGGING SCENARIOS`,
`READINESS CHECKLIST`, `INTERVIEW Q&A`, `MACHINE-CODING`, `DRILL`, `SCENARIO` — and stored as
practice blocks rather than topics, so drilling never inflates roadmap completion.

---

## Verifying a change

```bash
cd fullstackpath
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run build         # next build
npm run content:test  # parser tests, no database required
```

For end-to-end checks, run the app and the smoke suite in two terminals:

```bash
npm run dev
npm run smoke -- http://localhost:3000
```

---

## Documentation

| Document | What it covers |
| --- | --- |
| [`fullstackpath/README.md`](./fullstackpath/README.md) | Setup, scripts, the content pipeline |
| [`docs/ARCHITECTURE.md`](./fullstackpath/docs/ARCHITECTURE.md) | How the app is structured and why |
| [`docs/DATABASE.md`](./fullstackpath/docs/DATABASE.md) | Every model and the invariants it protects |
| [`docs/API.md`](./fullstackpath/docs/API.md) | Routes, server actions, error contract |
| [`docs/ROADMAP_CONTENT.md`](./fullstackpath/docs/ROADMAP_CONTENT.md) | Content pipeline in detail |
| [`docs/DEPLOYMENT.md`](./fullstackpath/docs/DEPLOYMENT.md) | Vercel + Neon production setup |
| [`docs/DEVELOPMENT_STATUS.md`](./fullstackpath/docs/DEVELOPMENT_STATUS.md) | **What is done and what is not** |
| [`plan.md`](./plan.md) | The original product specification |

Read `DEVELOPMENT_STATUS.md` before trusting any number in this file — it is the honest inventory.

---

## Licence

Private project. No licence granted.