import { useState } from "react";
import { Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, TextArea, TextInput } from "@/components/ui";

const categories = ["General", "AI Chat", "Location", "Restaurant Search", "Voice", "Design", "Other"] as const;

export function FeedbackForm() {
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
      className="grid max-w-xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm text-soft">Rating</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating from 1 to 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              className={`rounded-full p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${rating >= value ? "text-accent" : "text-soft"}`}
              onClick={() => setRating(value)}
            >
              <Star className="h-5 w-5" fill={rating >= value ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
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
      <label className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        Company
        <input tabIndex={-1} autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} />
      </label>
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
