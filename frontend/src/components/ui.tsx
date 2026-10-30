import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { textDirection } from "@/lib/speech";

export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="13" cy="16" r="4" fill="currentColor" />
      <circle cx="20.5" cy="16" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <Mark className="h-8 w-8 text-accent" />
      <span className="font-serif text-[1.65rem] leading-none">SAHARA</span>
    </span>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-accent text-on-accent hover:opacity-90",
    ghost: "border border-line bg-transparent text-ink hover:bg-muted",
    danger: "border border-line text-accent hover:bg-accent-soft",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition duration-150 hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-line bg-muted px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-2xl border border-line bg-muted px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent ${props.className ?? ""}`}
    />
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-soft">{label}</span>
      {children}
      {error ? <span className="mt-1.5 block text-xs text-accent">{error}</span> : null}
      {hint && !error ? <span className="mt-1.5 block text-xs leading-5 text-soft">{hint}</span> : null}
    </label>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl border border-line bg-accent-soft px-4 py-3 text-sm leading-6 text-ink shadow-[var(--shadow)]">
      {children}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-dashed border-line bg-elevated/60 px-6 py-10">
      <h2 className="font-serif text-3xl leading-tight">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-soft">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ eyebrow, title, body, action }: { eyebrow?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-soft">{eyebrow}</p> : null}
        <h1 className="font-serif text-3xl leading-tight sm:text-4xl">{title}</h1>
        {body ? <p className="mt-3 text-sm leading-6 text-soft">{body}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function AiReply({ content, action }: { content: string; action?: ReactNode }) {
  const dir = textDirection(content);
  return (
    <div dir={dir} className={`panel whitespace-pre-wrap p-4 text-sm leading-7 ${dir === "rtl" ? "font-arabic text-right" : ""}`}>
      {content}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function AiMark() {
  return <span className="rounded-full border border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-leaf">AI</span>;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  // Portal to body so dialogs are not clipped by sidebar overflow / backdrop-filter containing blocks.
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/55 px-4" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="w-full max-w-md rounded-3xl border border-line bg-elevated p-6 shadow-[var(--shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="dialog-title" className="font-serif text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-soft">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onConfirm();
            }}
          >
            {busy ? "Deleting…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
