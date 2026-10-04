"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Pin, PinOff, Plus, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  deleteNoteAction,
  toggleNotePinAction,
  upsertNoteAction,
} from "@/server/actions/notes";

export type NoteRow = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  topic: { id: string; slug: string; title: string } | null;
};

type Props = {
  initialNotes: NoteRow[];
  initialSelectedId: string | null;
  topics: { id: string; slug: string; title: string }[];
  stats: { total: number; pinned: number; wordCount: number };
};

export function NotesWorkspace({ initialNotes, initialSelectedId, topics, stats }: Props) {
  const router = useRouter();
  const [notes, setNotes] = React.useState<NoteRow[]>(initialNotes);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialSelectedId);
  const [query, setQuery] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const selected = notes.find((note) => note.id === selectedId) ?? null;

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(needle) ||
        note.content.toLowerCase().includes(needle) ||
        note.tags.some((tag) => tag.toLowerCase().includes(needle)),
    );
  }, [notes, query]);

  async function createNote() {
    setError(null);
    const result = await upsertNoteAction({ title: "Untitled note", content: "", tags: [] });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const noteId = String(result.data?.noteId ?? "");
    const now = new Date().toISOString();
    setNotes((current) => [
      { id: noteId, title: "Untitled note", content: "", tags: [], isPinned: false, createdAt: now, updatedAt: now, topic: null },
      ...current,
    ]);
    setSelectedId(noteId);
    router.refresh();
  }

  async function removeNote(noteId: string) {
    setError(null);
    const result = await deleteNoteAction(noteId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotes((current) => current.filter((note) => note.id !== noteId));
    setSelectedId((current) => (current === noteId ? null : current));
    router.refresh();
  }

  async function togglePin(noteId: string) {
    setError(null);
    const result = await toggleNotePinAction(noteId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotes((current) =>
      current.map((note) => (note.id === noteId ? { ...note, isPinned: !note.isPinned } : note)),
    );
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {stats.total} note{stats.total === 1 ? "" : "s"}
          </p>
          <Button size="sm" onClick={createNote}>
            <Plus />
            New
          </Button>
        </div>

        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
        />

        <div className="max-h-[60vh] space-y-1 overflow-y-auto lg:max-h-[calc(100vh-16rem)]">
          {filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              {notes.length === 0 ? "No notes yet." : "No notes match your search."}
            </p>
          ) : (
            filtered.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "rounded-lg border px-3 py-2 transition-colors",
                  selectedId === note.id
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:bg-secondary/40",
                )}
              >
                <button onClick={() => setSelectedId(note.id)} className="w-full text-left">
                  <div className="flex items-center gap-1.5">
                    {note.isPinned && (
                      <span className="text-[10px] text-primary" aria-label="Pinned">
                        ★
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{note.title}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {note.topic?.title ?? "General"} ·{" "}
                    {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                      new Date(note.updatedAt),
                    )}
                  </p>
                </button>
              </div>
            ))
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      {/* Editor — keyed so switching notes remounts with fresh initial values */}
      <div className="min-w-0">
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            topics={topics}
            onDelete={() => removeNote(selected.id)}
            onTogglePin={() => togglePin(selected.id)}
            onSaved={(patch) =>
              setNotes((current) =>
                current.map((note) => (note.id === selected.id ? { ...note, ...patch } : note)),
              )
            }
          />
        ) : (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
            <p className="text-sm font-medium">Select a note, or create one</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Notes are private to your account and support Markdown.
            </p>
            <Button size="sm" className="mt-4" onClick={createNote}>
              <Plus />
              New note
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteEditor({
  note,
  topics,
  onDelete,
  onTogglePin,
  onSaved,
}: {
  note: NoteRow;
  topics: { id: string; slug: string; title: string }[];
  onDelete: () => void;
  onTogglePin: () => void;
  onSaved: (patch: Partial<NoteRow>) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(note.title);
  const [content, setContent] = React.useState(note.content);
  const [tags, setTags] = React.useState(note.tags.join(", "));
  const [topicId, setTopicId] = React.useState(note.topic?.id ?? "");
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState(false);

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = React.useCallback(async () => {
    try {
      const result = await upsertNoteAction({
        noteId: note.id,
        title: title.trim() || "Untitled note",
        content,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        topicId: topicId || null,
      });

      if (result.ok) {
        setSaveState("saved");
        onSaved({ title: title.trim() || "Untitled note", content, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) });
        router.refresh();
      } else {
        setSaveState("error");
        setError(result.error);
      }
    } catch {
      setSaveState("error");
      setError("Autosave failed.");
    }
  }, [note.id, title, content, tags, topicId, onSaved, router]);

  /** Debounced autosave 1.2s after the last keystroke. */
  const scheduleSave = React.useCallback(() => {
    setSaveState("saving");
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1200);
  }, [flush]);

  // Persist any in-flight edit when the editor unmounts (note switched or closed).
  React.useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      void flush();
    }
  }, [flush]);

  function edit(setter: (value: string) => void, value: string) {
    setter(value);
    scheduleSave();
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(event) => edit(setTitle, event.target.value)}
          placeholder="Note title"
          aria-label="Note title"
          className="font-medium"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onTogglePin}
          aria-label={note.isPinned ? "Unpin note" : "Pin note"}
        >
          {note.isPinned ? <PinOff /> : <Pin />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label="Delete note"
          className="text-destructive hover:bg-destructive/10"
        >
          <Trash2 />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={topicId}
          onChange={(event) => edit(setTopicId, event.target.value)}
          aria-label="Link to a roadmap topic"
          className="h-8 max-w-xs rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Not linked to a topic</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.title}
            </option>
          ))}
        </select>

        <Input
          value={tags}
          onChange={(event) => edit(setTags, event.target.value)}
          placeholder="tags, comma, separated"
          aria-label="Note tags"
          className="h-8 max-w-xs text-xs"
        />

        <Button variant="ghost" size="sm" onClick={() => setPreview((value) => !value)} aria-pressed={preview}>
          {preview ? "Edit" : "Preview"}
        </Button>

        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && (
            <>
              <Check className="size-3.5 text-green-500" aria-hidden />
              Saved
            </>
          )}
          {saveState === "error" && <span className="text-destructive">{error}</span>}
        </span>
      </div>

      {preview ? (
        <div className="md-preview min-h-[320px] rounded-lg border border-border p-4">
          {content.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          ) : (
            <p className="text-xs text-muted-foreground">This note is empty.</p>
          )}
        </div>
      ) : (
        <Textarea
          value={content}
          onChange={(event) => edit(setContent, event.target.value)}
          placeholder="Write in Markdown…"
          aria-label="Note content"
          className="min-h-[320px] font-mono text-sm leading-relaxed"
        />
      )}

      <div className="flex flex-wrap gap-1.5">
        {tags.split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}