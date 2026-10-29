import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, TextArea, TextInput } from "@/components/ui";

const categories = ["General", "AI Chat", "Study", "Day plan", "Career", "Food ideas", "Journal", "Voice", "Design", "Other"] as const;

function StarMark({ filled }: { filled: boolean }) {
  return <Star className="h-7 w-7" fill={filled ? "currentColor" : "none"} />;
}

export function RatingSummary({ version = 0 }: { version?: number }) {
  const [summary, setSummary] = useState<{ count: number; average: number | null; stars: Record<string, number> } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    api
      .feedbackSummary()
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((loadError: unknown) => {
        console.error("Feedback summary failed", loadError);
        if (active) setError(loadError instanceof ApiError ? loadError.message : "Ratings could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [version]);

  if (error) return <Alert>{error}</Alert>;
  if (!summary) return <p className="text-sm text-soft">Loading ratings…</p>;
  if (summary.count === 0) return <p className="text-sm text-soft">No ratings yet. A saved star rating will show here.</p>;

  const rounded = summary.average === null ? 0 : Math.round(summary.average);
  return (
    <div className="rounded-3xl border border-line bg-elevated p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-soft">Ratings from people</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex text-accent" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((value) => (
            <StarMark key={value} filled={value <= rounded} />
          ))}
        </div>
        <p className="text-sm font-semibold">
          {summary.average} from {summary.count} {summary.count === 1 ? "rating" : "ratings"}
        </p>
      </div>
      <ul className="mt-4 grid gap-1 text-sm text-soft">
        {[5, 4, 3, 2, 1].map((value) => (
          <li key={value}>
            {value} {value === 1 ? "star" : "stars"}: {summary.stars[String(value)] ?? 0}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FeedbackForm({ onSaved }: { onSaved?: () => void }) {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<(typeof categories)[number] | "">("");
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    setError("");
    if (rating < 1 || rating > 5) {
      setError("Choose a rating from 1 to 5.");
      return;
    }
    if (!category) {
      setError("Choose a feedback category.");
      return;
    }
    const text = comment.trim();
    if (text.length < 8) {
      setError("Write at least 8 characters.");
      return;
    }
    if (text.length > 2000) {
      setError("Keep feedback under 2,000 characters.");
      return;
    }
    const address = email.trim();
    if (address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("Enter a valid email, or leave it blank.");
      return;
    }
    setPending(true);
    try {
      const result = await api.sendFeedback({
        rating,
        category,
        comment: text,
        email: address,
        company,
      });
      if (!result.saved) {
        setError("The feedback was not saved.");
        return;
      }
      setSaved(true);
      onSaved?.();
    } catch (submitError) {
      console.error("Feedback was not saved", submitError);
      setError(submitError instanceof ApiError ? submitError.message : "The feedback was not saved.");
    } finally {
      setPending(false);
    }
  };

  if (saved) {
    return (
      <Alert>
        <p>Saved. Thank you for the note.</p>
        <button type="button" className="mt-2 text-sm font-semibold" onClick={() => navigate("/")}>
          Back home
        </button>
      </Alert>
    );
  }

  return (
    <form
      className="relative grid max-w-xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <fieldset className="rounded-3xl border border-line bg-elevated p-4">
        <legend className="px-1 text-sm font-semibold">Your rating</legend>
        <p className="mt-1 text-sm text-soft">Tap a star. 1 is low and 5 is high. The rating is saved with the note.</p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Rating from 1 to 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              className={`grid h-16 w-14 place-items-center rounded-2xl border text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${rating >= value ? "border-accent bg-accent/15 text-accent" : "border-line text-soft"}`}
              onClick={() => setRating(value)}
            >
              <Star className="h-7 w-7" fill={rating >= value ? "currentColor" : "none"} />
              {value}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm" role="status">
          {rating > 0 ? `Selected: ${rating} of 5 stars.` : "No star selected yet."}
        </p>
      </fieldset>
      <Field label="Category">
        <select
          className="w-full rounded-2xl border border-line bg-muted px-3 py-2.5 text-sm"
          value={category}
          onChange={(event) => setCategory(event.target.value as (typeof categories)[number] | "")}
          required
        >
          <option value="">Choose one</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Feedback" hint={`${comment.trim().length}/2000`}>
        <TextArea value={comment} onChange={(event) => setComment(event.target.value)} rows={6} maxLength={2000} required />
      </Field>
      <Field label="Email, optional" hint="Leave this blank if you do not want a reply.">
        <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={120} />
      </Field>
      <div className="absolute h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Company
          <input tabIndex={-1} autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} />
        </label>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send feedback"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
