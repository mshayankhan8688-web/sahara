import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { readReplyLanguage } from "@/lib/replyLanguage";
import type { SavedPlan } from "@/lib/types";
import { AiReply, Alert, Button, Field, PageHeader, TextArea } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function GuidePage({
  kind,
  title,
  body,
  examples,
  notice,
}: {
  kind: "study" | "career";
  title: string;
  body: string;
  examples: string[];
  notice: string;
}) {
  useDocumentTitle(title);
  const [prompt, setPrompt] = useState(examples[0] ?? "");
  const [reply, setReply] = useState("");
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const load = () => {
    api.plans(kind).then((result) => setPlans(result.plans)).catch((loadError) => {
      console.error("Failed to load plans", loadError);
    });
  };

  useEffect(load, [kind]);

  const ask = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await api.guide({ kind, prompt, replyLanguage: readReplyLanguage() });
      setReply(result.content);
    } catch (askError) {
      console.error("Guide request failed", askError);
      setError(askError instanceof ApiError ? askError.message : "SAHARA could not answer.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader eyebrow="SAHARA" title={title} body={body} />
      <p className="max-w-xl text-sm leading-6 text-soft">{notice}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {examples.map((example) => (
          <button key={example} type="button" className="chip text-left" onClick={() => setPrompt(example)}>
            {example}
          </button>
        ))}
      </div>
      <div className="panel mt-4 max-w-xl space-y-3 p-4 sm:p-5">
        {error ? (
          <Alert>
            <p>{error}</p>
            <button type="button" className="mt-2 text-sm font-semibold" onClick={() => void ask()} disabled={pending}>Retry</button>
          </Alert>
        ) : null}
        <Field label="What do you need?">
          <TextArea rows={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </Field>
        <Button type="button" onClick={() => void ask()} disabled={pending || prompt.trim().length < 2}>
          {pending ? "Thinking…" : "Ask SAHARA"}
        </Button>
      </div>
      {reply ? (
        <div className="mt-4 max-w-xl">
          <AiReply
            content={reply}
            action={
              <Button variant="ghost" type="button" onClick={() => void api.savePlan({ kind, title: prompt.slice(0, 80), content: reply }).then(() => { setError(""); load(); })}>
                Save this
              </Button>
            }
          />
        </div>
      ) : null}
      <div className="mt-8 max-w-xl space-y-3">
        {plans.map((plan) => (
          <article key={plan.id} className="panel p-4 text-sm leading-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl">{plan.title}</h2>
              <button type="button" className="text-xs text-accent" onClick={() => void api.deletePlan(plan.id).then(load)}>Delete</button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-soft">{plan.content}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
