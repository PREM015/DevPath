# Architecture

## Shape

A single Next.js App Router application. No monorepo, no separate API service.

```
src/
  app/                    routes (App Router)
    (auth)/               login, register, password reset, verification
    (dashboard)/          authenticated pages
    api/                  route handlers
  components/             shared UI (design system primitives, landing, layout)
  features/               feature-scoped UI (roadmap, interview, revision, ...)
  server/
    services/             all database reads. The only place queries are written.
    actions/              server actions. Validate, authorise, then call a service.
  lib/                    config, db client, permissions, utils
  content/                GENERATED — static outline for the landing page
  generated/prisma/       GENERATED — Prisma client
prisma/
  schema.prisma
  seed.ts                 roadmap seed, then calls seed-interview.ts
  seed-interview.ts       questions and practice blocks
  seed-data/              GENERATED — phase-*.json from the parser
scripts/
  parse-roadmap.mjs       source documents -> seed-data JSON
  lib/parse-section.mjs   per-section field extraction
  test-parse-section.mjs  parser unit tests, no database
  generate-outline.mjs    seed data -> src/content/phase-outlines.ts
  coverage.mjs            per-phase gap report
  smoke.ts                end-to-end checks against a running server
```

## The one rule: data access lives in services

Every Prisma query is in `src/server/services`. Components and server actions call services.

This exists for one reason: ownership. A candidate's attempts, notes, bookmarks, progress and
drill results must only ever be reachable by that candidate. If queries are scattered across
components, one forgotten `where` clause leaks a row. Concentrating them makes the filter
auditable — you can read every place `userId` is used and check each one.

Consequence: if you need new data, add a function to a service. Do not import `prisma` into a
component.

## Auth

Auth.js v5 (beta) with credentials and a Prisma adapter for account records.

```
src/auth.ts          Auth.js configuration
src/lib/auth-db.ts   adapter instance
src/proxy.ts         Next 16 route protection (renamed from middleware.ts)
```

Session state is read server-side. Nothing about identity is accepted from the client: every
service takes a `userId` that the caller obtained from `requireUserPage()` or
`getSessionUser()`, never from a form field, route param or header.

## Rendering

- **Server Components by default.** They read the database directly and ship no client JS.
- **Client Components only for interaction.** The question bank, practice cards and the roadmap
  canvas are client components because they hold reveal state, not because they fetch.
- Mutations go through server actions in `src/server/actions`, each returning
  `{ ok: true } | { ok: false, error }` rather than throwing, so the UI can show a message.
- After a successful mutation the action calls `router.refresh()` so the server re-reads the
  database. There is no client-side cache to invalidate.

## Content pipeline

```
source .txt / .md
   └─ scripts/parse-roadmap.mjs
        └─ prisma/seed-data/phase-*.json     (generated, checked in)
             ├─ scripts/generate-outline.mjs -> src/content/phase-outlines.ts (generated)
             └─ prisma/seed.ts -> prisma/seed-interview.ts -> PostgreSQL
```

The parser is a line-oriented state machine. Each topic section is split into labelled fields
by `scripts/lib/parse-section.mjs`, which recognises bold labels, bullet lists, numbered lists
and markdown tables. Code fences are captured verbatim as reference material and never parsed as
prose, so a code example cannot pollute the concept list.

The parser reads the whole document into memory and is content-addressed by slug, so re-running
is safe. `npm run content:sync` is the only supported way to change content.

Why the generated JSON is checked in: it makes a content change reviewable in a diff. You can see
exactly what one edit to `expand.md` did to the app without running anything.

## Invariants worth knowing

1. **Opening content never completes it.** Progress is only ever changed by an explicit action.
2. **Answering a question never touches topic progress.** They are separate models on purpose.
3. **Questions and practice blocks are shared; only attempts are private.** Question keys are
   derived from the source, never from a user id.
4. **Content is pruned, not orphaned.** Re-seeding deletes rows whose key is no longer in the
   source, so a candidate is never asked to rate a question that has been removed.
5. **No fabricated metrics.** Readiness is reported as counts a candidate can act on. There is
   no "job-ready score", because there is no defensible formula for one.
6. **No padded content.** A phase with no authored body is labelled as such in the UI rather than
   filled with generic filler.

## Testing strategy

| Layer | Tool | Needs a database |
| --- | --- | --- |
| Parser fields | `scripts/test-parse-section.mjs` (32 assertions) | no |
| Static checks | `tsc --noEmit`, `eslint` | no |
| Build | `next build` | no |
| End to end | `scripts/smoke.ts` (65 checks) | yes, running server |

The smoke suite is the interesting one. It registers two accounts and asserts that the second
cannot see or modify the first's progress, notes, bookmarks or attempts. Ownership is the class
of bug that unit tests are worst at catching and that matters most, so it is tested against a
real database and a real HTTP server.

Run it:

```bash
npm run dev
npm run smoke -- http://localhost:3000
```

## Trade-offs

**No Redis or job queue.** Stale-question ordering is a window function over Postgres. At
thousands of questions per user this is fine; at millions it would need a real ranking service.
Adding one before it is needed would add a failure mode for no measured gain.

**No search engine.** `ilike` over question text. Adequate for 5,000 rows, not for 500,000.

**Server Components over a client cache.** No React Query in practice reads. A dashboard query
costs one database round trip; a client cache would cost a hydration payload plus an extra
request and a staleness bug.

**Polymorphic JSON on Topic.** `interviewJson` holds the shaped section payload. A normalised
child table would be more queryable but would mean a join per field on the topic page, which is
read once and rendered whole.

**Beta Auth.js.** It is the only maintained line for App Router and it is pinned. The
credentials flow is standard; the adapter is used only for account records.