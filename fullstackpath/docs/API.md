# API

Two surfaces: **route handlers** for read APIs and external calls, and **server actions** for
everything a user does in the app.

---

## Conventions

**Errors.** Route handlers return
`{ error: { code, message } }` with an appropriate status. They do not throw.

**Server actions** return `{ ok: true }` or `{ ok: false, error: string }`. They never throw, so
a form can render the failure next to the input instead of hitting an error boundary.

**Authentication.** Every protected route and action resolves the caller server-side:

```ts
const user = await requireUserPage();   // throws / redirects if not signed in
const user = await getSessionUser();    // returns null if not signed in
```

A `userId` is never accepted from a form field, query parameter or header. This is what makes
ownership enforceable — see [ARCHITECTURE.md](./ARCHITECTURE.md#the-one-rule-data-access-lives-in-services).

**Rate limiting** is applied to authentication endpoints: registration, login, and password
reset requests are limited per identifier, and the limit is checked before the database is
touched.

---

## Route handlers

### `GET /api/health`

Unauthenticated liveness check. Returns database reachability.

```json
{ "status": "ok", "database": "up", "timestamp": "2026-10-02T12:00:00.000Z" }
```

Returns `503` with `"status": "degraded"` if the database is unreachable. This is the one route
deliberately open to unauthenticated callers, since a load balancer cannot hold a session.

### `GET /api/roadmap/phases`

Public. Ordered list of active phases with group and topic counts.

### `GET /api/roadmap/phases/[phaseId]`

Public. One phase with its groups, topics, and any topic whose status the caller has recorded.

### `GET /api/roadmap/groups/[groupId]/topics`

Public. Topics in a group with the caller's progress overlaid when a session exists.

### `GET /api/roadmap/topics`

Public. Paginated topic list.

| Query | Notes |
| --- | --- |
| `phaseId` | filter to a phase |
| `groupId` | filter to a group |
| `q` | case-insensitive title search |
| `status` | filter by the caller's progress status |
| `limit` / `offset` | default 50, max 100 |

### `GET /api/roadmap/topics/[slug]`

Public. One topic by slug: content payload, prerequisites, related topics, the caller's progress,
notes and bookmarks.

### `POST /api/roadmap/topics`

**Admin only.** Creates a topic. Responds `403` for a non-admin, `409` on a duplicate slug.

### `GET /api/search`

Cross-entity search over topics, phases and projects.

| Query | Notes |
| --- | --- |
| `q` | required, at least 2 characters |
| `type` | `topic` \| `phase` \| `project` |
| `limit` | default 20 |

---

## Server actions

Called from client components. Every one validates its input with a Zod schema, resolves the
session, authorises, then delegates to a service.

### Progress — `src/server/actions/progress.ts`

| Action | Input | Effect |
| --- | --- | --- |
| `updateTopicProgress` | topic id, status, expected version | Sets status explicitly. Never called on view. |
| `resetTopicProgress` | topic id | Returns to `NOT_STARTED`. |
| `startStudySession` | topic id? | Opens a `StudySession`. |
| `endStudySession` | session id, minutes | Closes it and feeds analytics. |
| `toggleBookmark` | topic id | Idempotent — the unique index makes a double click safe. |
| `scheduleRevision` | topic id, interval | Adds to the revision ladder. |
| `removeRevision` | topic id | Removes it. |
| `reviewTopic` | topic id, result | Records a review; reschedules. |
| `postponeRevision` | topic id | Pushes to the next interval. |

`getRevisionLadder` and `getUserDayAnchor` are reads.

### Interview — `src/server/actions/interview-kit.ts`

| Action | Input | Effect |
| --- | --- | --- |
| `recordAttemptAction` | question id, `CONFIDENT` \| `PARTIAL` \| `BLANK` | Upserts the candidate's `QuestionAttempt`. **Does not touch topic progress.** |
| `updateDrillAction` | block id, `PASSED` \| `NEEDS_WORK` \| `ATTEMPTED` | Upserts `DrillResult`. |
| `toggleBlockChecklistAction` | block id, item index | Ticks one checklist item. |
| `saveInterviewPrepAction` | date, company, role, notes | Saves `InterviewPrep` for that account. |

### Notes — `src/server/actions/notes.ts`

`upsertNoteAction`, `deleteNoteAction`, `toggleNotePinAction`, `exportNotesAction`.

Deleting is ownership-checked in the query, so a delete aimed at someone else's note affects zero
rows. The smoke suite asserts exactly this.

### Queue — `src/server/actions/queue.ts`

`addToQueueAction`, `removeFromQueueAction`, `reorderQueueAction`.

### Projects, settings, admin, notifications

`projects.ts`, `settings.ts`, `admin.ts`, `notifications.ts`. Admin actions check
`session.user.role === "ADMIN"` before any write.

---

## Auth — `src/server/actions/auth.ts`

| Action | Notes |
| --- | --- |
| `register` | Validates, hashes with bcrypt, creates the user, sends a verification token. |
| `login` | Rate limited. Generic failure message — never reveals whether an email exists. |
| `requestPasswordReset` | Always responds the same way, whether or not the address is known. |
| `resetPassword` | Single-use token; marks it used on success. |
| `verifyEmail` | Consumes the token and sets `emailVerified`. |

Auth.js itself is mounted at `src/app/api/auth/[...nextauth]`.

---

## Interview queries — read only

The question bank and practice kit read through services rather than route handlers, because
they are server components:

| Function | Returns |
| --- | --- |
| `listQuestions(userId, filters)` | Filtered page with the caller's attempt attached. |
| `getNextUpQuestions(userId, limit)` | Worst recall first: blank, then partial, then unattempted. |
| `getQuestionStats(userId)` | Totals plus the confident/partial/blank distribution. |
| `getQuestionBankByPhase(userId)` | Per-phase counts against the caller's progress. |
| `getDrillSet(userId, kind, phaseId)` | A practice block ready to run. |
| `getPracticeBlocks(userId, filters)` | Filtered blocks with runbook fields. |
| `getPracticeStats(userId)` | Counts by kind and status. |
| `getReadiness(userId)` | Actionable counts. Deliberately no single score. |

`listQuestions` filters support `query`, `phaseId`, `difficulty`, `result`
(`confident` / `partial` / `blank` / `unattempted`), `hasModelAnswer`, `limit` and `offset`.

`unattempted` is a real bucket rather than the absence of one: it resolves to
`attempts: { none: { userId } }`, which is what lets the app distinguish "I got this wrong" from
"I have never seen this".

---

## Adding an endpoint

1. Write the query in `src/server/services`, taking `userId` as the first argument.
2. Write the route handler thin: resolve the session, call the service, return the result.
3. If it is a mutation, add a server action with a Zod schema that calls the same service.
4. Add a check to `scripts/smoke.ts` if it touches user data — especially if it reads or writes
   anything private.

Do not import `prisma` into a route handler or a component.