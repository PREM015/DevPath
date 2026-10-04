import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarClock,
  Flame,
  ListChecks,
  MessagesSquare,
  NotebookPen,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  Wrench,
} from "lucide-react";
import { APP_DESCRIPTION, APP_NAME } from "@/config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PhaseOutline } from "@/features/roadmap/phase-outline";
import { PHASE_OUTLINE } from "@/features/roadmap/phase-outline-data";
import { CONTENT_TOTALS } from "@/content/phase-outlines";

export const metadata: Metadata = {
  title: `${APP_NAME} — Answer out loud. Know what they actually ask.`,
  description: APP_DESCRIPTION,
};

const LOOP = [
  {
    icon: MessagesSquare,
    step: "01",
    title: "Get the question",
    body: "A real interview question, filed under the phase and topic it belongs to. Not a reading list — the question they will actually ask you.",
  },
  {
    icon: Timer,
    step: "02",
    title: "Answer out loud",
    body: "Commit to an answer before you can see anything. Reading silently is not recall, and it is the reason most people freeze in the real interview.",
  },
  {
    icon: Sparkles,
    step: "03",
    title: "Reveal and compare",
    body: "The model answer appears next to yours, plus what the interviewer is grading, the probe they will follow up with, and the wrong answers that lose the role.",
  },
  {
    icon: Target,
    step: "04",
    title: "Rate yourself honestly",
    body: "Confident, partial, or blank. That rating is the only progress data in this app, and it drives what comes back for revision.",
  },
] as const;

const PRACTICE = [
  {
    icon: Flame,
    title: "Rapid-fire sets",
    body: "Short questions that need one-breath answers. Built for the first ten minutes of a screen, where people lose interviews.",
  },
  {
    icon: Wrench,
    title: "Debugging scenarios",
    body: "Symptom first, diagnosis withheld. You are shown what you see, then the investigation, root cause, fix and prevention — in that order.",
  },
  {
    icon: ListChecks,
    title: "Readiness checklists",
    body: "Per-section lists a reviewer should be able to answer yes to. Work them and you know exactly what is missing.",
  },
  {
    icon: ScrollText,
    title: "Reference material",
    body: "Diagrams, tables and code from the source, kept verbatim so nothing authored is lost when a section is structured.",
  },
] as const;

const FAQS = [
  {
    q: "Is this a list of links, or does it know what I got wrong?",
    a: "It knows. Every question records your own result, and the question bank is ordered by what you have rated blank or partial. Nothing is completed for you and nothing is marked done because you opened it.",
  },
  {
    q: "How is my recall data kept private?",
    a: "Every read and write of your attempts, notes, bookmarks and revision history is filtered by your account id, taken from your server-side session and never from anything the client sends. The questions themselves are shared content; only your answers to them are yours.",
  },
  {
    q: "What happens when content is added or edited?",
    a: "Content is versioned by a stable key and edited in place, so your progress survives. A question removed from the source is removed here too rather than left behind as a ghost you can still be asked to rate.",
  },
  {
    q: "Will this guarantee me a job?",
    a: "No, and it does not claim to. It is a question bank with drills and honest self-rating. Your preparation and your interviews are still yours.",
  },
  {
    q: "How much is written for each topic?",
    a: "Only what the source actually contains, and the coverage report states it plainly. Phases with no authored body yet are labelled as such rather than padded with generic material.",
  },
  {
    q: "Do I need a paid service or an email provider?",
    a: "No. Email verification and password reset work out of the box by logging to the server console. Add a provider only if you want real delivery.",
  },
] as const;

const number = new Intl.NumberFormat("en-US");

export default function LandingPage() {
  const outlineOnly = PHASE_OUTLINE.outlineOnlyPhases;

  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold">
            <span aria-hidden className="text-lg">🗺️</span>
            <span className="gradient-text">{APP_NAME}</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#method" className="transition-colors hover:text-foreground">Method</a>
            <a href="#practice" className="transition-colors hover:text-foreground">Practice</a>
            <a href="#roadmap" className="transition-colors hover:text-foreground">Coverage</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Start prepping</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/4 top-0 size-96 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="absolute right-1/4 top-40 size-80 rounded-full bg-purple-500/10 blur-3xl" />
          </div>

          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="outline" className="mb-6 animate-fade-in">
              <MessagesSquare className="size-3" aria-hidden />
              {number.format(CONTENT_TOTALS.questions)} questions ·{" "}
              {CONTENT_TOTALS.practiceBlocks} drills and scenarios
            </Badge>

            <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight animate-fade-in-up sm:text-5xl md:text-6xl">
              <span className="hero-gradient block">Answer out loud.</span>
              <span className="gradient-text block">Know what they actually ask.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground animate-fade-in-up delay-150">
              Every question comes with the model answer, what the interviewer is grading, the probe
              they will follow up with, and the wrong answers that lose the role.{" "}
              <span className="text-foreground">Then you rate yourself honestly.</span>
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 animate-fade-in-up delay-300 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">
                  Start your first drill
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login">
                  <MessagesSquare />
                  Open the question bank
                </Link>
              </Button>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Free account. No credit card. Your answers and ratings stay private to your account.
            </p>
          </div>
        </section>

        {/* The numbers, stated honestly */}
        <section className="border-t border-border/60 px-4 py-14 sm:px-6">
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: number.format(CONTENT_TOTALS.questions), label: "interview questions" },
              {
                value: number.format(CONTENT_TOTALS.answeredQuestions),
                label: "with a model answer",
              },
              { value: number.format(CONTENT_TOTALS.practiceBlocks), label: "drills and scenarios" },
              { value: `${CONTENT_TOTALS.phases}`, label: "phases of coverage" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-5 text-center">
                <p className="text-3xl font-extrabold tracking-tight">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The core loop */}
        <section id="method" className="border-t border-border/60 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                The loop that actually works
              </h2>
              <p className="mt-3 text-muted-foreground">
                Reading about a topic feels productive and prepares you for nothing. Recall does not.
                This app only asks you to do the part that works.
              </p>
            </div>

            <ol className="grid gap-6 md:grid-cols-4">
              {LOOP.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.step} className="relative">
                    <div className="mb-3 flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden />
                    </div>
                    <p className="mb-1 text-[11px] font-bold tracking-widest text-muted-foreground/70">
                      {item.step}
                    </p>
                    <h3 className="mb-1.5 text-sm font-semibold">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* What each attempt gives you */}
        <section className="border-t border-border/60 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Not just the answer. The grading.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Knowing the answer is half of it. Knowing what the interviewer listens for is the
                other half, and it is rarely written down anywhere else.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Target,
                  title: "Why they ask this",
                  body: "The signal the question is testing, so you know what to aim at rather than reciting everything you know.",
                },
                {
                  icon: ScrollText,
                  title: "Say out loud",
                  body: "The phrasing to actually use. Interviewers grade structure and clarity, and this is the shape of a strong answer.",
                },
                {
                  icon: ListChecks,
                  title: "What they evaluate",
                  body: "The rubric points. Miss one and a fully correct answer can still read as average.",
                },
                {
                  icon: MessagesSquare,
                  title: "They will probe",
                  body: "The follow-up they will use when your answer was shallow. Being ready for this is where senior candidates separate.",
                },
                {
                  icon: ShieldAlert,
                  title: "Wrong answers",
                  body: "Answers that sound right, get past a first read, and still cost you the role.",
                },
                {
                  icon: Wrench,
                  title: "Runbooks",
                  body: "For debugging questions: symptom, investigation, root cause, fix, prevention — the order a senior engineer works in.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="glass-card p-5">
                    <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="size-4 text-primary" aria-hidden />
                    </div>
                    <h3 className="mb-1.5 text-sm font-semibold">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Practice material */}
        <section id="practice" className="border-t border-border/60 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Practice, not just reading
              </h2>
              <p className="mt-3 text-muted-foreground">
                Questions are the assessment. These are the parts where you rehearse under the same
                pressure.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {PRACTICE.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="glass-card flex gap-4 p-5">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="size-4 text-primary" aria-hidden />
                    </div>
                    <div>
                      <h3 className="mb-1 text-sm font-semibold">{item.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Coverage */}
        <section id="roadmap" className="border-t border-border/60 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                What is written so far
              </h2>
              <p className="mt-3 text-muted-foreground">
                {PHASE_OUTLINE.totalTopics} topics across {PHASE_OUTLINE.totalGroups} groups and{" "}
                {CONTENT_TOTALS.phases} phases. Phases still being written are labelled, not padded.
              </p>
            </div>
            <PhaseOutline />
          </div>
        </section>

        {/* Honest status */}
        <section className="border-t border-border/60 px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="glass-card p-6">
              <h2 className="mb-3 text-lg font-bold">Where the writing stands</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Phases 1 through 8 have full authored content — model answers, rubrics, probes,
                debugging scenarios and reference material. The remaining phases have their topic
                outlines in place so the roadmap is complete, but their bodies are still being
                written, and this app says so rather than filling them with generic text.
              </p>
              {outlineOnly.length > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Still being written:{" "}
                  <span className="font-medium text-foreground">
                    phase{outlineOnly.length > 1 ? "s" : ""} {outlineOnly.join(", ")}
                  </span>
                  .
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Also included */}
        <section className="border-t border-border/60 px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Tracking, when you want it</h2>
              <ul className="mt-5 space-y-3">
                {[
                  { icon: CalendarClock, text: "Interview date, company and role, so the gaps you have left are the ones that matter." },
                  { icon: NotebookPen, text: "Private markdown notes on any topic, linked to the question you were stuck on." },
                  { icon: Target, text: "A readiness view built from your own blank and partial answers, with no invented score." },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.text} className="flex gap-3 text-sm">
                      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span className="text-muted-foreground">{item.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight">The roadmap underneath</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                For candidates who need the study order rather than just the questions: prerequisites,
                key concepts, common mistakes and practice tasks, expandable from phase to group to
                topic. It is supporting material. The question bank is the product.
              </p>
              <ul className="mt-5 space-y-3">
                {[
                  { icon: NotebookPen, text: "Progress and review scheduling, driven only by your own recall ratings." },
                  { icon: ListChecks, text: "Topic completion is always explicit and always reversible." },
                  { icon: ShieldAlert, text: "Every read of your data is filtered by your account in the query itself." },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.text} className="flex gap-3 text-sm">
                      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span className="text-muted-foreground">{item.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border/60 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-10 text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Questions worth asking
            </h2>
            <dl className="space-y-3">
              {FAQS.map((faq) => (
                <div key={faq.q} className="glass-card p-5">
                  <dt className="mb-1.5 text-sm font-semibold">{faq.q}</dt>
                  <dd className="text-sm leading-relaxed text-muted-foreground">{faq.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/60 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Start with the question you would freeze on
            </h2>
            <p className="mt-3 text-muted-foreground">
              Create an account, pick a phase, and answer ten questions out loud. That is the whole
              setup.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">
                  Create your account
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/login">I already have one</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm">
            <span aria-hidden className="text-base">🗺️</span>
            <span className="gradient-text font-semibold">{APP_NAME}</span>
            <span className="text-muted-foreground">· Full stack interview prep</span>
          </div>
          <nav className="flex gap-5 text-sm text-muted-foreground">
            <Link href="/register" className="hover:text-foreground">Register</Link>
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
            <Link href="/api/health" className="hover:text-foreground">Status</Link>
          </nav>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {APP_NAME}
          </p>
        </div>
      </footer>
    </div>
  );
}