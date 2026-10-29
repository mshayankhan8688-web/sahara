import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { readReplyLanguage } from "@/lib/replyLanguage";
import { AiReply, Alert, Button, PageHeader } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const chips = ["Something light", "Pakistani food", "Burger", "Pizza", "Less spicy", "Affordable"];

export function FoodPage() {
  useDocumentTitle("Food");
  const [note, setNote] = useState("I'm feeling low and I'm hungry. Please suggest something simple.");
  const [reply, setReply] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const ask = async () => {
    setPending(true);
    setError("");
    try {
      const result = await api.recommend(note, readReplyLanguage());
      setReply(result.content);
      setNotice(result.notice);
    } catch (askError) {
      console.error("Food recommendation failed", askError);
      setReply("");
      setError(askError instanceof ApiError ? askError.message : "The suggestion could not be made.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader
        eyebrow="Ideas, not a menu"
        title="Food ideas"
        body="Ask Gemini what to eat. Replies are general meal suggestions, not restaurant search."
      />
      <div className="flex max-w-2xl flex-wrap gap-2">
        {chips.map((chip) => (
          <button key={chip} type="button" className="chip" onClick={() => setNote(chip)}>
            {chip}
          </button>
        ))}
      </div>
      <label className="panel mt-5 block max-w-2xl p-4 sm:p-5">
        <span className="sr-only">What do you feel like eating?</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} className="w-full rounded-3xl border border-line bg-muted px-4 py-3 text-sm outline-none focus:border-accent" />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => void ask()} disabled={pending || note.trim().length === 0}>
          {pending ? "Asking Gemini…" : "Suggest food"}
        </Button>
      </div>
      {error ? <div className="mt-4 max-w-2xl"><Alert>{error}</Alert></div> : null}
      {reply ? (
        <article className="mt-6 max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-leaf">AI suggestion</p>
          <AiReply content={reply} />
          {notice ? <p className="mt-3 text-xs leading-5 text-soft">{notice}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
