import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { JournalEntry } from "@/lib/types";
import { Alert, Button, ConfirmDialog, EmptyState, PageHeader, TextArea, TextInput } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const moods = ["low", "restless", "hungry", "calm", "grateful"];

export function JournalPage() {
  useDocumentTitle("Journal");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<JournalEntry | null>(null);
  const [content, setContent] = useState("");
  const [moodTag, setMoodTag] = useState("");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<JournalEntry | null>(null);

  const load = (q = query) => {
    api.journal(q).then((result) => setEntries(result.entries)).catch((loadError) => {
      console.error("Failed to load journal", loadError);
      setError(loadError instanceof ApiError ? loadError.message : "Journal entries could not be loaded.");
    });
  };

  useEffect(() => {
    load("");
  }, []);

  const open = (entry: JournalEntry | null) => {
    setActive(entry);
    setContent(entry?.content ?? "");
    setMoodTag(entry?.moodTag ?? "");
  };

  const save = async (status: "draft" | "saved") => {
    try {
      const body = { content, moodTag, status };
      const result = active ? await api.updateJournal(active.id, body) : await api.createJournal(body);
      setActive(result.entry);
      load();
      setError("");
    } catch (saveError) {
      console.error("Failed to save journal", saveError);
      setError(saveError instanceof ApiError ? saveError.message : "The entry could not be saved.");
    }
  };

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader eyebrow="Private" title="Journal" body="Entries stay out of chat until you choose Share with AI on one of them." />
      {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside>
          <form
            className="mb-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              load(query);
            }}
          >
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search journal" />
          </form>
          <Button type="button" variant="ghost" onClick={() => open(null)}>New entry</Button>
          {entries.length === 0 ? <p className="mt-4 text-sm text-soft">Nothing saved yet.</p> : null}
          <ul className="mt-3 space-y-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => open(entry)} className="panel w-full px-3 py-2 text-left">
                  <span className="block truncate text-sm">{entry.content || "Empty draft"}</span>
                  <span className="text-xs text-soft">{entry.status}{entry.moodTag ? ` · ${entry.moodTag}` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="panel p-5">
          {entries.length === 0 && !content ? (
            <EmptyState title="A page of your own" body="Write a draft, then save it. Deleting it removes it from your account." />
          ) : null}
          <TextArea rows={10} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write what you don't want sent anywhere yet" />
          <div className="mt-3 flex flex-wrap gap-2">
            {moods.map((mood) => (
              <button key={mood} type="button" className={`rounded-full border px-3 py-1 text-xs ${moodTag === mood ? "border-accent" : "border-line"}`} onClick={() => setMoodTag(mood)}>
                {mood}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => void save("draft")}>Save draft</Button>
            <Button type="button" onClick={() => void save("saved")}>Save entry</Button>
            {active ? (
              <Link
                to={`/app/chat?journal=${active.id}`}
                className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Share with AI
              </Link>
            ) : null}
            {active ? <Button variant="danger" type="button" onClick={() => setPendingDelete(active)}>Delete</Button> : null}
          </div>
        </section>
      </div>
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this entry?"
          body="It will not be sent to the AI, and it will be removed from your account."
          confirmLabel="Delete"
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            void api.deleteJournal(pendingDelete.id).then(() => {
              if (active?.id === pendingDelete.id) open(null);
              load();
            });
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}
