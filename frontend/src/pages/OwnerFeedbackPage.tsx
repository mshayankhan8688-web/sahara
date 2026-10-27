import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { PublicLayout } from "@/components/PublicLayout";
import { Alert, Button, Field, TextInput } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type Row = {
  id: string;
  rating: number;
  category: string;
  comment: string;
  email: string;
  signedIn: boolean;
  createdAt: string;
};

export function OwnerFeedbackPage() {
  useDocumentTitle("Review feedback");
  const [key, setKey] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const load = async () => {
    setError("");
    setRows(null);
    if (key.trim().length < 16) {
      setError("Enter the review key from the API settings.");
      return;
    }
    setPending(true);
    try {
      const result = await api.reviewFeedback(key.trim());
      setRows(result.feedback);
    } catch (loadError) {
      console.error("Feedback review failed", loadError);
      setError(loadError instanceof ApiError ? loadError.message : "Feedback could not be loaded.");
    } finally {
      setPending(false);
    }
  };

  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-soft">Owner</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">Review feedback</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-soft">
          This list is not public. The key is checked on the server and is kept only in this tab until you leave or refresh.
        </p>
        <form
          className="mt-8 grid max-w-xl gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <Field label="Review key" hint="Set FEEDBACK_REVIEW_SECRET on the API. It is not stored in the website.">
            <TextInput type="password" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="current-password" />
          </Field>
          {error ? <Alert>{error}</Alert> : null}
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Checking…" : "Show feedback"}
            </Button>
          </div>
        </form>
        {rows && rows.length === 0 ? <p className="mt-8 text-sm text-soft">No feedback has been saved yet.</p> : null}
        {rows && rows.length > 0 ? (
          <ul className="mt-8 space-y-4">
            {rows.map((row) => (
              <li key={row.id} className="rounded-3xl border border-line bg-elevated p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-soft">
                  {row.category} · {row.rating}/5 · {new Date(row.createdAt).toLocaleString()}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{row.comment}</p>
                <p className="mt-3 text-xs text-soft">{row.email ? row.email : "No email"}{row.signedIn ? " · signed in" : ""}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </PublicLayout>
  );
}
