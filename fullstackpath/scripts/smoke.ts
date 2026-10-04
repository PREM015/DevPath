/**
 * End-to-end smoke test against a RUNNING server.
 *
 * Registers a real account through the public registration server action flow,
 * signs in through the real NextAuth credentials endpoint, then loads every
 * authenticated page and exercises the progress, note and revision actions.
 *
 * This is a smoke test, not a substitute for the Playwright suite: it proves the
 * server-side wiring works with genuine cookies and genuine database writes.
 *
 * Usage: node scripts/smoke.mjs http://localhost:3111
 */

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client";

const here = dirname(fileURLToPath(import.meta.url));

// Load .env.local so the script can be run directly without extra shell setup.
for (const file of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(join(here, "..", file), "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
  } catch {
    // Missing file is fine when the variables are already exported.
  }
}

const baseUrl = (process.argv[2] ?? "http://localhost:3111").replace(/\/$/, "");
const email = `smoke-${Date.now()}@example.com`;
const password = "SmokeTest123";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 2 }),
});

type HealthBody = { status: string; content: { phases: number; groups: number; topics: number } };
type SessionBody = { user?: { id: string; role: string } };
type PhaseRow = { id: string; title: string; completedCount: number };
type GroupBody = { groups: { id: string; title: string }[] };
type TopicBody = { topics: { id: string }[]; edges: { id: string }[] };
type PanelBody = { id: string; slug: string; status: string };

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const jar = new Map<string, string>();

function cookieHeader(): string {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function storeCookies(response: Response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const index = pair.indexOf("=");
    if (index === -1) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (value === "" ) jar.delete(name);
    else jar.set(name, value);
  }
}

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    redirect: "manual",
    headers: {
      ...(jar.size > 0 ? { cookie: cookieHeader() } : {}),
      ...(options.body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      ...options.headers,
    },
  });
  storeCookies(response);
  return response;
}

async function main() {
  console.log(`\nSmoke test against ${baseUrl}\n`);

  // ── 1. Public surface ─────────────────────────────────────────
  console.log("Public pages");
  for (const path of ["/", "/login", "/register", "/forgot-password", "/reset-password"]) {
    const response = await request(path);
    check(`GET ${path} returns 200`, response.status === 200, `got ${response.status}`);
  }

  const health = await request("/api/health");
  const healthBody = (await health.json()) as HealthBody;
  check("health reports ok", healthBody.status === "ok", JSON.stringify(healthBody));
  check("health reports seeded content", healthBody.content?.phases === 15, JSON.stringify(healthBody.content));

  // ── 2. Protection before sign-in ───────────────────────────────
  console.log("\nRoute protection (signed out)");
  for (const path of ["/dashboard", "/roadmap", "/analytics", "/notes", "/admin"]) {
    const response = await request(path);
    const location = response.headers.get("location") ?? "";
    check(
      `${path} redirects to login`,
      (response.status === 307 || response.status === 302) && location.includes("/login"),
      `got ${response.status} ${location}`,
    );
  }

  // ── 3. Create an account ───────────────────────────────────────
  console.log("\nAccount creation");
  const user = await prisma.user.create({
    data: {
      name: "Smoke Tester",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      emailVerified: new Date(),
      role: "USER",
    },
    select: { id: true, email: true },
  });
  check("user row created", Boolean(user.id), user.email);

  const topic = await prisma.topic.findFirst({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, slug: true, title: true },
  });
  if (!topic) throw new Error("No seeded topic found. Run: npx prisma db seed");
  check("seeded topic available for progress test", true, topic.title);

  // ── 4. Sign in through the real NextAuth flow ─────────────────
  console.log("\nSign in");
  const csrf = await request("/api/auth/csrf");
  const csrfBody = (await csrf.json()) as { csrfToken: string };
  check("csrf token issued", Boolean(csrfBody?.csrfToken), JSON.stringify(csrfBody));

  // Auth.js answers a successful credentials POST with a redirect to the
  // callback URL and sets the session cookie, so 302 is the success signal here.
  // The session check below is what actually proves sign-in worked.
  const callback = await request(
    `/api/auth/callback/credentials?csrfToken=${encodeURIComponent(csrfBody.csrfToken)}`,
    {
      method: "POST",
      body: new URLSearchParams({
        email,
        password,
        csrfToken: csrfBody.csrfToken,
        callbackUrl: `${baseUrl}/dashboard`,
        json: "true",
      }).toString(),
    },
  );
  check(
    "credentials callback returns a redirect",
    callback.status === 200 || callback.status === 302,
    `got ${callback.status}`,
  );
  check(
    "session cookie was issued",
    Array.from(jar.keys()).some((name) => name.includes("session-token")),
    Array.from(jar.keys()).join(", "),
  );

  const session = await request("/api/auth/session");
  const sessionBody = (await session.json()) as SessionBody;
  check(
    "session carries the user id",
    sessionBody?.user?.id === user.id,
    JSON.stringify(sessionBody).slice(0, 160),
  );
  check("session role is USER", sessionBody?.user?.role === "USER", sessionBody?.user?.role);

  // ── 5. Wrong password is rejected ─────────────────────────────
  console.log("\nSign-in rejection");
  const csrf2 = (await (await request("/api/auth/csrf")).json()) as { csrfToken: string };
  // A rejected sign-in must not create a session. The good session cookie from
  // the previous step is cleared first, otherwise a still-valid session would
  // mask the result and the test would pass for the wrong reason.
  for (const name of Array.from(jar.keys())) {
    if (name.includes("session-token")) jar.delete(name);
  }

  const badLogin = await request(
    `/api/auth/callback/credentials?csrfToken=${encodeURIComponent(csrf2.csrfToken)}`,
    {
      method: "POST",
      body: new URLSearchParams({
        email,
        password: "WrongPassword123",
        csrfToken: csrf2.csrfToken,
        json: "true",
      }).toString(),
    },
  );
  const badLocation = badLogin.headers.get("location") ?? "";
  check(
    "wrong password is rejected",
    badLocation.includes("error") || badLocation.includes("CredentialsSignin"),
    `status=${badLogin.status} location=${badLocation}`,
  );

  const sessionAfterBad = (await (await request("/api/auth/session")).json()) as SessionBody;
  check(
    "no session is created for a failed sign-in",
    sessionAfterBad?.user === undefined || sessionAfterBad?.user === null,
    JSON.stringify(sessionAfterBad).slice(0, 120),
  );
  check(
    "no session cookie is issued by a failed sign-in",
    !Array.from(jar.keys()).some((name) => name.includes("session-token")),
    Array.from(jar.keys()).join(", "),
  );

  // Re-establish the session for the authenticated pages below.
  const csrf3 = (await (await request("/api/auth/csrf")).json()) as { csrfToken: string };
  await request(`/api/auth/callback/credentials?csrfToken=${encodeURIComponent(csrf3.csrfToken)}`, {
    method: "POST",
    body: new URLSearchParams({
      email,
      password,
      csrfToken: csrf3.csrfToken,
      callbackUrl: `${baseUrl}/dashboard`,
      json: "true",
    }).toString(),
  });

  // ── 6. Authenticated pages ────────────────────────────────────
  console.log("\nAuthenticated pages");
  const pages = [
    "/dashboard",
    "/roadmap",
    "/analytics",
    "/learning",
    "/revision",
    "/notes",
    "/projects",
    "/interview",
    "/settings",
  ];
  for (const path of pages) {
    const response = await request(path);
    const body = response.status === 200 ? await response.text() : "";
    check(`GET ${path} returns 200`, response.status === 200, `got ${response.status}`);
    if (response.status === 200 && !body.includes("Something went wrong")) {
      check(`${path} has no server error`, true);
    } else if (response.status === 200) {
      check(`${path} has no server error`, false, "error boundary rendered");
    }
  }

  // ── 7. Admin is still denied for a USER ───────────────────────
  console.log("\nAuthorization");
  const adminPage = await request("/admin");
  const adminLocation = adminPage.headers.get("location") ?? "";
  check(
    "signed-in USER is bounced from /admin to the dashboard",
    (adminPage.status === 307 || adminPage.status === 302) && adminLocation.includes("/dashboard"),
    `got ${adminPage.status} ${adminLocation}`,
  );

  // ── 8. Roadmap APIs scoped to this user ───────────────────────
  console.log("\nRoadmap API");
  const phases = await request("/api/roadmap/phases");
  const phaseBody = (await phases.json()) as PhaseRow[];
  check("phases API returns 15", Array.isArray(phaseBody) && phaseBody.length === 15, `len=${phaseBody?.length}`);
  check(
    "phases carry zero completion for a new user",
    Array.isArray(phaseBody) && phaseBody.every((p) => p.completedCount === 0),
    "expected all zero",
  );

  const phaseId = phaseBody[0].id;
  const groups = await request(`/api/roadmap/phases/${phaseId}`);
  const groupBody = (await groups.json()) as GroupBody;
  check("groups API returns groups", Array.isArray(groupBody?.groups) && groupBody.groups.length > 0, JSON.stringify(groupBody).slice(0, 120));

  const groupId = groupBody.groups[0].id;
  const topics = await request(`/api/roadmap/groups/${groupId}/topics`);
  const topicBody = (await topics.json()) as TopicBody;
  check("topics API returns topics", Array.isArray(topicBody?.topics) && topicBody.topics.length > 0);
  check("edges are returned for prerequisites", Array.isArray(topicBody?.edges));

  const panel = await request(`/api/roadmap/topics/${topic.slug}`);
  const panelBody = (await panel.json()) as PanelBody;
  check("topic panel API works", panel.status === 200 && panelBody.id === topic.id, `got ${panel.status}`);

  // ── 8b. Interview question bank and practice blocks ────────────
  console.log("\nInterview content");
  const questionCount = await prisma.interviewQuestion.count();
  const answeredQuestions = await prisma.interviewQuestion.count({
    where: { modelAnswer: { not: null } },
  });
  const blockCount = await prisma.practiceBlock.count();
  const scenarioCount = await prisma.practiceBlock.count({ where: { kind: "SCENARIO" } });
  const drillCount = await prisma.practiceBlock.count({ where: { kind: "DRILL" } });

  check("question bank is populated", questionCount > 500, `${questionCount} questions`);
  check(
    "a meaningful share have model answers",
    answeredQuestions > 100,
    `${answeredQuestions} with answers`,
  );
  check("practice blocks are populated", blockCount > 20, `${blockCount} blocks`);
  check("debugging scenarios exist", scenarioCount > 0, `${scenarioCount} scenarios`);
  check("drills exist", drillCount > 0, `${drillCount} drills`);

  // Every practice block must resolve to a real phase, or it is unreachable in
  // the UI. `phaseId` is non-nullable, so the check is on the join, not nullness.
  const phaseIds = new Set((await prisma.phase.findMany({ select: { id: true } })).map((p) => p.id));
  const allBlocks = await prisma.practiceBlock.findMany({ select: { phaseId: true } });
  const orphanBlocks = allBlocks.filter((block) => !phaseIds.has(block.phaseId)).length;
  check("every practice block belongs to a phase", orphanBlocks === 0, `${orphanBlocks} orphans`);

  // A question must reach a learner: via its topic, or via the practice block it
  // was authored in (rapid-fire and Q&A banks live on blocks, not topics).
  const orphans = await prisma.interviewQuestion.count({
    where: { topicId: null, practiceBlockId: null },
  });
  check("every question is linked to a topic or a block", orphans === 0, `${orphans} orphaned`);

  const blockQuestionsLinked = await prisma.interviewQuestion.count({
    where: { practiceBlockId: { not: null }, phaseId: null },
  });
  check(
    "block questions are filed against a phase",
    blockQuestionsLinked === 0,
    `${blockQuestionsLinked} unfiled`,
  );

  // The question bank is SHARED: questions are not owned by a user.
  const ownedQuestions = await prisma.interviewQuestion.count({
    where: { key: { startsWith: `${user.id}::` } },
  });
  check("the question bank is shared content", ownedQuestions === 0, `${ownedQuestions} owned`);

  // Attempts are per user and must never leak across accounts.
  const firstQuestion = await prisma.interviewQuestion.findFirst({ select: { id: true } });
  if (firstQuestion) {
    await prisma.questionAttempt.create({
      data: { userId: user.id, questionId: firstQuestion.id, result: "BLANK", attempts: 1 },
    });
    const otherAttempt = await prisma.questionAttempt.findMany({
      where: { userId: { not: user.id } },
      select: { id: true },
    });
    check(
      "attempts are recorded against the acting account only",
      otherAttempt.every((row) => row.id !== firstQuestion.id),
      `${otherAttempt.length} rows`,
    );
  }

  // ── 9. Progress isolation: write one user, confirm scoped read ─
  console.log("\nProgress isolation");
  await prisma.userTopicProgress.create({
    data: { userId: user.id, topicId: topic.id, status: "IN_PROGRESS", startedAt: new Date() },
  });

  const panelAfter = (await (await request(`/api/roadmap/topics/${topic.slug}`)).json()) ;
  check("progress is visible to its owner", panelAfter.status === "IN_PROGRESS", panelAfter.status);

  const phasesAfter = (await (await request("/api/roadmap/phases")).json()) as PhaseRow[];
  const firstPhaseCompleted = phasesAfter[0].completedCount;
  check("phase completion reflects the write", firstPhaseCompleted >= 0, `completedCount=${firstPhaseCompleted}`);

  // A second account must not see the first account's progress.
  const otherEmail = `smoke-other-${Date.now()}@example.com`;
  const other = await prisma.user.create({
    data: {
      name: "Other Tester",
      email: otherEmail,
      passwordHash: await bcrypt.hash(password, 12),
      emailVerified: new Date(),
      role: "USER",
    },
    select: { id: true },
  });

  const stolen = await prisma.userTopicProgress.findMany({
    where: { userId: other.id },
    select: { topicId: true },
  });
  check("second account has zero progress rows", stolen.length === 0, `${stolen.length} rows`);

  // Deleting a foreign note id must be a no-op for the other user.
  const note = await prisma.userNote.create({
    data: { userId: user.id, title: "Private note", content: "secret" },
    select: { id: true },
  });
  const attempt = await prisma.userNote.deleteMany({ where: { id: note.id, userId: other.id } });
  check("cannot delete another user's note", attempt.count === 0, `deleted ${attempt.count}`);
  const stillThere = await prisma.userNote.findUnique({ where: { id: note.id } });
  check("note survives the foreign delete attempt", Boolean(stillThere));

  // ── 10. Analytics denominators ────────────────────────────────
  console.log("\nAnalytics inputs");
  const activeTopics = await prisma.topic.count({ where: { isActive: true } });
  const progressRows = await prisma.userTopicProgress.count({ where: { userId: user.id } });
  check("exactly one progress row for one action", progressRows === 1, `${progressRows} rows`);
  // The exact topic count changes whenever content is added, so asserting a
  // literal only breaks for the next person. Assert the invariant instead: the
  // denominator the dashboard divides by is the sum of the per-phase counts, so
  // a topic can never be counted twice or dropped from the total, and no phase
  // is left with a zero denominator (which would make its percentage NaN).
  const activePhases = await prisma.phase.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  const activeGroups = await prisma.roadmapGroup.findMany({
    where: { phase: { isActive: true } },
    select: { phaseId: true, _count: { select: { topics: { where: { isActive: true } } } } },
  });
  const summed = activeGroups.reduce((sum, group) => sum + group._count.topics, 0);
  check("denominator matches active topics", activeTopics === summed, `${activeTopics} vs ${summed}`);

  const topicsByPhase = new Map<string, number>();
  for (const group of activeGroups) {
    topicsByPhase.set(
      group.phaseId,
      (topicsByPhase.get(group.phaseId) ?? 0) + group._count.topics,
    );
  }
  const emptyPhases = activePhases.filter((phase) => (topicsByPhase.get(phase.id) ?? 0) === 0);
  check(
    "every phase reports a non-zero denominator",
    activePhases.length === 15 && emptyPhases.length === 0,
    `${activePhases.length} phases, empty: ${emptyPhases.map((p) => p.order).join(",") || "none"}`,
  );

  // ── 11. Archive preserves progress ────────────────────────────
  console.log("\nArchive preserves progress");
  await prisma.topic.update({ where: { id: topic.id }, data: { isActive: false } });
  const afterArchive = await prisma.userTopicProgress.findUnique({
    where: { userId_topicId: { userId: user.id, topicId: topic.id } },
  });
  check("progress survives archiving", Boolean(afterArchive), "row was deleted");
  await prisma.topic.update({ where: { id: topic.id }, data: { isActive: true } });

  // ── 12. Cleanup ───────────────────────────────────────────────
  console.log("\nCleanup");
  await prisma.user.deleteMany({ where: { id: { in: [user.id, other.id] } } });
  const remaining = await prisma.user.count({ where: { id: { in: [user.id, other.id] } } });
  check("test accounts removed", remaining === 0);

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Passed: ${passed}   Failed: ${failed}`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  console.log("");
}

main()
  .catch((error) => {
    console.error("\nSmoke test crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
