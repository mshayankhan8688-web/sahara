import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { UsageSnapshot } from "@/lib/types";

const labels: Record<string, string> = {
  chat: "Chat",
  studio: "Studio",
  image: "Images",
  diagram: "Diagrams",
};

export function UsageMeter({ compact = false }: { compact?: boolean }) {
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () => {
      void api
        .billingUsage()
        .then((response) => {
          if (alive) {
            setUsage(response.usage);
            setError("");
          }
        })
        .catch((loadError) => {
          if (!alive) return;
          setError(loadError instanceof ApiError ? loadError.message : "Usage unavailable.");
        });
    };
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("sahara:usage", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("sahara:usage", onFocus);
    };
  }, []);

  if (error && !usage) {
    return compact ? null : <p className="px-1 text-xs text-soft">{error}</p>;
  }
  if (!usage) return null;

  const chat = usage.buckets.find((bucket) => bucket.kind === "chat");
  if (compact) {
    return (
      <Link to="/app/pricing" className="block rounded-2xl border border-line bg-muted/40 px-3 py-2 text-xs text-soft transition hover:border-accent hover:text-ink">
        <span className="font-semibold text-ink">{usage.planName}</span>
        {chat ? ` · ${chat.remaining}/${chat.limit} chat left` : null}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-muted/30 p-3 text-xs leading-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-ink">{usage.planName} plan</p>
        <Link to="/app/pricing" className="text-accent hover:underline">
          Plans
        </Link>
      </div>
      <ul className="mt-2 space-y-1 text-soft">
        {usage.buckets.map((bucket) => (
          <li key={bucket.kind}>
            {labels[bucket.kind] ?? bucket.kind}: {bucket.remaining} left of {bucket.limit}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-soft">
        Resets {new Date(usage.resetsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} (UTC day).
      </p>
      {!usage.paymentsConfigured ? (
        <p className="mt-1 text-[11px] text-soft">Premium checkout is not live yet.</p>
      ) : null}
    </div>
  );
}

export function notifyUsageChanged() {
  window.dispatchEvent(new Event("sahara:usage"));
}
