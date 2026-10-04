# Deployment

## What you need

- Node 20 or newer
- A managed PostgreSQL database
- A deployment target that runs a Node server

This is a Next.js App Router application with a PostgreSQL database and Auth.js sessions. It
needs a real database — there is no in-memory or file-based mode.

---

## Environment variables

Set these in your host's dashboard. Do not commit them.

```bash
DATABASE_URL="postgresql://user:password@host:5432/fullstackpath?sslmode=require"
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="https://your-domain.example"
```

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Use `?sslmode=require` on managed providers. |
| `AUTH_SECRET` | yes | Signing key for sessions. Rotating it logs everyone out. |
| `AUTH_URL` | production | The canonical origin. Wrong value breaks OAuth callbacks. |
| `AUTH_TRUST_HOST` | on some hosts | Set to `true` behind a proxy that does not set `x-forwarded-host`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `EMAIL_FROM` | optional | Without them, verification and reset emails are written to the server log instead of sent. |
| `SKIP_EMAIL_VERIFICATION` | optional | Set to `true` to let new accounts in without verifying. Development only. |

### The email fallback

Without SMTP configured, the app still works. Verification and reset messages are logged to the
server console, so you can click the link from your deploy log during testing. This is a
supported path, not a degraded one — but it is unsuitable for real users, so configure SMTP before
launching.

---

## Database

### Apply migrations

```bash
npm run db:deploy
```

Uses `migrate deploy`, which only applies pending migrations. Never run `migrate dev` in
production — it can reset the database.

### Load content

Content ships as generated JSON, not as a migration, so seeding is a separate step:

```bash
npm run db:seed
```

This is idempotent. It upserts by key and prunes rows no longer present in the source, so it is
safe to re-run after adding to `expand.md`. It does not touch candidate data.

To re-seed on a schedule, or after a content update:

```bash
npm run content:sync
```

Run it as a one-off job after deploying a content change, not on every request.

---

## Build

```bash
npm ci
npm run db:generate
npm run build
npm run start
```

`npm run build` runs `tsc` as part of the Next build, so a type error fails the build rather than
shipping.

### Health check

```
GET /api/health
```

Returns `200` with `"database": "up"` when the application and database are both reachable, and
`503` with `"status": "degraded"` when the database is not. Point your platform's health check
here. It is intentionally unauthenticated.

---

## Vercel

1. Import the repository.
2. Framework preset: Next.js. Build command: `npm run build`.
3. Add `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST=true`.
4. Use a **managed Postgres** (Vercel Postgres, Neon or Supabase) and set `DATABASE_URL` with
   `?sslmode=require`.
5. Add a `prisma/seed-data` aware seed step, or run `npm run db:deploy && npm run db:seed` once
   from your machine after the first deploy.
6. Run `npm run db:deploy` as a **pre-deploy** step. Vercel does not run it automatically.

---

## Docker

`Dockerfile`:

```dockerfile
FROM node:22-bookworm-slim AS base

# Prisma needs openssl
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate
RUN npm run build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/generated ./src/generated

EXPOSE 3000
CMD ["npm", "run", "start"]
```

Build and run:

```bash
docker build -t fullstackpath .
docker run -p 3000:3000 --env-file .env.local fullstackpath
```

Image notes:

- `node:22-bookworm-slim` over `node:22` — the full image carries hundreds of packages you will
  never use and a large CVE surface.
- `openssl` is required by Prisma.
- Migrations are **not** run in `CMD`. Run them as a separate step before starting the container,
  so a failed migration does not start an app against an old schema.

`docker-compose.yml` with Postgres:

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: fullstackpath
      POSTGRES_PASSWORD: fullstackpath
      POSTGRES_DB: fullstackpath
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fullstackpath"]
      interval: 5s
      retries: 10

  app:
    build: .
    ports: ["3000:3000"]
    depends_on:
      db: { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql://fullstackpath:fullstackpath@db:5432/fullstackpath
      AUTH_SECRET: change-me
      AUTH_URL: http://localhost:3000

volumes:
  pgdata:
```

---

## Migrations in a release

```bash
npm run db:deploy        # 1. apply pending migrations
npm run db:seed          # 2. load content
npm run db:generate      # 3. regenerate the client
npm run build            # 4. build
```

Step 3 before 4 matters: `next build` type-checks against the generated client, so a schema change
without a regenerated client fails the build.

---

## Backups and content updates

- Back up the database on your provider's schedule. Candidate data is irreplaceable.
- Content is versioned in git as `prisma/seed-data/*.json`, so a content rollback is a `git revert`
  followed by `npm run db:seed`. Candidate attempts are untouched by re-seeding unless the
  question they reference was removed from the source, in which case they cascade — see
  [ROADMAP_CONTENT.md](./ROADMAP_CONTENT.md#idempotency-and-pruning).
- To change content in production, edit `expand.md`, run `npm run content:sync`, and commit the
  regenerated JSON. The JSON diff is the reviewable record of the change.

---

## Operational notes

**Sticky sessions.** Auth.js uses database sessions by default, so any instance can serve any
request and no sticky routing is needed.

**Reverse proxy.** Terminate TLS at the proxy. Set `AUTH_TRUST_HOST=true` so the app reads the
forwarded host, and keep `x-forwarded-proto` intact so secure cookies are issued.

**Zero-downtime deploys.** Run `db:deploy` before starting new instances. Migrations here are
additive — new nullable columns and new tables — so a mixed-version fleet during a rolling deploy
is safe. Avoid removing or renaming a column in the same release that stops writing it.

**Content Security Policy.** `next.config.ts` sets a baseline CSP. If you add a third-party script,
tag or font, extend the policy there rather than loosening it globally.

**Index creation on large tables.** `phaseId`, `topicId`, `practiceBlockId` and `difficulty` are
indexed on `InterviewQuestion`, and `phaseId` and `groupId` on the other content tables. If you
add an index in a future migration, use `CREATE INDEX CONCURRENTLY` — the default `CREATE INDEX`
takes a write lock and will block on a table with candidate attempt rows.

---

## Pre-launch checklist

- [ ] `DATABASE_URL` points at production, with `sslmode=require`
- [ ] `AUTH_SECRET` is fresh and not the development value
- [ ] `AUTH_URL` matches the public origin exactly
- [ ] SMTP configured, or you accept verification links in the logs
- [ ] `npm run db:deploy` run against production
- [ ] `npm run db:seed` run against production
- [ ] `/api/health` returns `200` and `"database": "up"`
- [ ] Registration works end to end, including the verification email
- [ ] Password reset works end to end
- [ ] Two accounts cannot see each other's attempts, notes or progress
- [ ] Automated backups enabled
- [ ] `npm run typecheck && npm run lint && npm run build` clean
- [ ] `npm run smoke -- https://your-domain.example` passing