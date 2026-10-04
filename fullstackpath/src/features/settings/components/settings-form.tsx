"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Save, Trash2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Switch, Separator } from "@/components/ui/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changePasswordAction } from "@/server/actions/auth";
import {
  deleteAccountAction as deleteAccount,
  exportAccountAction as exportAccount,
  updateAvatarAction,
  updateProfileAction,
} from "@/server/actions/settings";

const LEARNER_ROLES = [
  { value: "FRONTEND", label: "Frontend-leaning" },
  { value: "BACKEND", label: "Backend-leaning" },
  { value: "BALANCED", label: "Balanced full stack" },
  { value: "STARTUP", label: "Startup generalist" },
] as const;

const TARGET_LEVELS = [
  { value: "JUNIOR", label: "Junior" },
  { value: "MID", label: "Mid-level" },
  { value: "SENIOR", label: "Senior" },
  { value: "STAFF", label: "Staff engineer" },
] as const;

const DEFAULT_INTERVALS = [1, 3, 7, 14, 30, 60, 120];

export type SettingsProfile = {
  name: string | null;
  email: string;
  image: string | null;
  bio: string | null;
  timezone: string;
  preferredRole: string | null;
  targetLevel: string | null;
  dailyGoalMinutes: number;
  weeklyGoalMinutes: number;
  revisionReminders: boolean;
  dailyGoalReminders: boolean;
  achievementNotifications: boolean;
  emailNotifications: boolean;
  revisionIntervals: number[] | null;
  usesPassword: boolean;
};

export function SettingsForm({ profile }: { profile: SettingsProfile }) {
  const router = useRouter();

  const [name, setName] = React.useState(profile.name ?? "");
  const [bio, setBio] = React.useState(profile.bio ?? "");
  const [timezone, setTimezone] = React.useState(profile.timezone);
  const [preferredRole, setPreferredRole] = React.useState(profile.preferredRole ?? "BALANCED");
  const [targetLevel, setTargetLevel] = React.useState(profile.targetLevel ?? "MID");
  const [dailyGoal, setDailyGoal] = React.useState(String(profile.dailyGoalMinutes));
  const [weeklyGoal, setWeeklyGoal] = React.useState(String(profile.weeklyGoalMinutes));
  const [avatar, setAvatar] = React.useState(profile.image ?? "");
  const [intervals, setIntervals] = React.useState<string>(
    (profile.revisionIntervals ?? DEFAULT_INTERVALS).join(", "),
  );
  const [reminders, setReminders] = React.useState({
    revisionReminders: profile.revisionReminders,
    dailyGoalReminders: profile.dailyGoalReminders,
    achievementNotifications: profile.achievementNotifications,
    emailNotifications: profile.emailNotifications,
  });

  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setPending(key);
    setMessage(null);
    try {
      const result = await fn();
      setMessage(
        result.ok
          ? { kind: "ok", text: result.message ?? "Saved." }
          : { kind: "error", text: result.error ?? "Something went wrong." },
      );
      if (result.ok) router.refresh();
    } finally {
      setPending(null);
    }
  }

  function saveProfile() {
    const parsedIntervals = intervals
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0 && value <= 365);

    return run("profile", () =>
      updateProfileAction({
        name: name.trim() || undefined,
        bio,
        timezone,
        preferredRole: preferredRole as never,
        targetLevel: targetLevel as never,
        dailyGoalMinutes: Number(dailyGoal) || 0,
        weeklyGoalMinutes: Number(weeklyGoal) || 0,
        revisionIntervals: parsedIntervals.length > 0 ? parsedIntervals : undefined,
        ...reminders,
      }),
    );
  }

  async function saveAvatar() {
    return run("avatar", () => updateAvatarAction({ image: avatar.trim() }));
  }

  async function download(kind: "account" | "notes") {
    setPending(kind);
    try {
      const result = kind === "account" ? await exportAccount() : await import("@/server/actions/notes").then((m) => m.exportNotesAction());
      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      const filename = String(result.data?.filename ?? "export.json");
      const payload = String(result.data?.payload ?? "{}");

      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      setMessage({ kind: "ok", text: result.message ?? "Export downloaded." });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          role="status"
          className={
            message.kind === "ok"
              ? "rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-sm text-green-600 dark:text-green-400"
              : "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          }
        >
          {message.text}
        </div>
      )}

      {/* Profile */}
      <Card id="profile">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="email" hint="Contact support to change your email.">
              <Input id="email" value={profile.email} disabled />
            </Field>
          </div>

          <Field label="Avatar URL" htmlFor="avatar" hint="Must be an https:// image URL.">
            <div className="flex gap-2">
              <Input
                id="avatar"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://…"
              />
              <Button
                variant="outline"
                loading={pending === "avatar"}
                onClick={() => void saveAvatar()}
              >
                Save
              </Button>
            </div>
          </Field>

          <Field label="Bio" htmlFor="bio">
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </Field>

          <Field label="Time zone" htmlFor="timezone" hint="Used for streaks and daily goals.">
            <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {/* Path */}
      <Card id="path">
        <CardHeader>
          <CardTitle>Learning path</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your role and level change what is suggested first. They never hide anything from the
            roadmap, and changing them does not touch your existing progress.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target role" htmlFor="preferredRole">
              <Select
                id="preferredRole"
                value={preferredRole}
                onChange={(e) => setPreferredRole(e.target.value)}
              >
                {LEARNER_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Target level" htmlFor="targetLevel">
              <Select
                id="targetLevel"
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value)}
              >
                {TARGET_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Goals */}
      <Card id="goals">
        <CardHeader>
          <CardTitle>Study goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Daily target (minutes)" htmlFor="dailyGoal">
              <Input
                id="dailyGoal"
                type="number"
                min={0}
                max={960}
                value={dailyGoal}
                onChange={(e) => setDailyGoal(e.target.value)}
              />
            </Field>
            <Field label="Weekly target (minutes)" htmlFor="weeklyGoal">
              <Input
                id="weeklyGoal"
                type="number"
                min={0}
                max={6720}
                value={weeklyGoal}
                onChange={(e) => setWeeklyGoal(e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Revision */}
      <Card id="revision">
        <CardHeader>
          <CardTitle>Revision settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Review intervals in days"
            htmlFor="intervals"
            hint="Comma separated, 1 to 365 each. Leave as 1,3,7,14,30,60,120 for the default ladder."
          >
            <Input id="intervals" value={intervals} onChange={(e) => setIntervals(e.target.value)} />
          </Field>

          <div className="space-y-3">
            <ToggleRow
              label="Revision reminders"
              description="Show in-app notifications when a review is due."
              checked={reminders.revisionReminders}
              onChange={(checked) =>
                setReminders((current) => ({ ...current, revisionReminders: checked }))
              }
            />
            <ToggleRow
              label="Daily goal reminders"
              description="Remind me when I have not reached my daily target."
              checked={reminders.dailyGoalReminders}
              onChange={(checked) =>
                setReminders((current) => ({ ...current, dailyGoalReminders: checked }))
              }
            />
            <ToggleRow
              label="Achievement notifications"
              description="Tell me when I unlock something."
              checked={reminders.achievementNotifications}
              onChange={(checked) =>
                setReminders((current) => ({ ...current, achievementNotifications: checked }))
              }
            />
            <ToggleRow
              label="Email notifications"
              description="Allow the platform to email you. Turn off if you never want email."
              checked={reminders.emailNotifications}
              onChange={(checked) =>
                setReminders((current) => ({ ...current, emailNotifications: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Button loading={pending === "profile"} onClick={saveProfile} size="lg">
        <Save />
        Save settings
      </Button>

      <Separator />

      {/* Security */}
      <SecuritySection usesPassword={profile.usesPassword} />

      <Separator />

      {/* Data */}
      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Export everything you have recorded. The export contains only your own data.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              loading={pending === "account"}
              onClick={() => void download("account")}
            >
              <Download />
              Export all my data
            </Button>
            <Button
              variant="outline"
              loading={pending === "notes"}
              onClick={() => void download("notes")}
            >
              <Download />
              Export notes only
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeleteAccountSection />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function SecuritySection({ usesPassword }: { usesPassword: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await changePasswordAction({
      currentPassword: current,
      password: next,
      confirmPassword: confirm,
    });
    setPending(false);

    if (result.status === "error") {
      setMessage({ kind: "error", text: result.message });
      return;
    }
    setMessage({ kind: "ok", text: result.message });
    setCurrent("");
    setNext("");
    setConfirm("");
    router.refresh();
  }

  return (
    <Card id="security">
      <CardHeader>
        <CardTitle>Account security</CardTitle>
      </CardHeader>
      <CardContent>
        {!usesPassword ? (
          <p className="text-sm text-muted-foreground">
            You signed up with Google, so there is no password to change on this account.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {message && (
              <p
                role="status"
                className={
                  message.kind === "ok"
                    ? "text-sm text-green-600 dark:text-green-400"
                    : "text-sm text-destructive"
                }
              >
                {message.text}
              </p>
            )}
            <Field label="Current password" htmlFor="currentPassword" required>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New password" htmlFor="newPassword" required>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  required
                />
              </Field>
              <Field label="Confirm new password" htmlFor="confirmPassword" required>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Button type="submit" loading={pending} loadingText="Updating…">
              Change password
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteAccountSection() {
  const router = useRouter();
  const [confirmation, setConfirmation] = React.useState("");
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = React.useState(false);

  async function remove() {
    setPending(true);
    setMessage(null);
    const result = await deleteAccount(confirmation);
    setPending(false);

    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setMessage({ kind: "ok", text: result.message });
    router.push("/");
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="size-4" aria-hidden />
          Delete account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This permanently deletes your account and everything attached to it: progress, notes,
          bookmarks, revision history, project records, study sessions and achievements. Type{" "}
          <span className="font-mono text-foreground">DELETE</span> to confirm.
        </p>
        {message && (
          <p
            role="alert"
            className={
              message.kind === "ok"
                ? "text-sm text-green-600 dark:text-green-400"
                : "text-sm text-destructive"
            }
          >
            {message.text}
          </p>
        )}
        <div className="flex gap-2">
          <Input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="DELETE"
            aria-label="Type DELETE to confirm"
            className="max-w-xs"
          />
          <Button
            variant="destructive"
            loading={pending}
            onClick={remove}
            disabled={confirmation !== "DELETE"}
          >
            <Trash2 />
            Delete account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}