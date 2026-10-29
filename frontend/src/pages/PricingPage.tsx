import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/PublicLayout";
import { Alert, Button, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { BillingPlansResponse } from "@/lib/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/context/AuthContext";

export function PricingPage({ embedded = false }: { embedded?: boolean }) {
  useDocumentTitle("Pricing");
  const { user } = useAuth();
  const [data, setData] = useState<BillingPlansResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void api
      .billingPlans()
      .then((response) => {
        if (alive) setData(response);
      })
      .catch((loadError) => {
        if (!alive) return;
        setError(loadError instanceof ApiError ? loadError.message : "Plans could not be loaded.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const body = (
    <div className={embedded ? "h-full overflow-auto px-4 py-6 sm:px-8" : "mx-auto max-w-5xl px-5 py-10"}>
      <PageHeader
        eyebrow="Plans"
        title="Free and Premium"
        body="Prices are shown in PKR and come from the server config. Live checkout is off until a payment provider is verified — nobody is charged from this page."
      />
      {error ? <Alert>{error}</Alert> : null}
      {data ? (
        <div className="mt-2 grid gap-6 md:grid-cols-2">
          {data.plans.map((plan) => (
            <article key={plan.id} className="panel depth-card flex flex-col p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{plan.name}</p>
              <h2 className="mt-2 font-serif text-4xl">
                {plan.monthlyPricePkr == null
                  ? "PKR 0"
                  : `PKR ${plan.monthlyPricePkr.toLocaleString("en-PK")}`}
                <span className="ml-2 text-base font-sans font-normal text-soft">
                  {plan.monthlyPricePkr == null ? "/ forever" : "/ month"}
                </span>
              </h2>
              {plan.annualPricePkr != null ? (
                <p className="mt-1 text-sm text-soft">
                  or PKR {plan.annualPricePkr.toLocaleString("en-PK")} / year
                </p>
              ) : null}
              <p className="mt-4 text-sm leading-6 text-soft">{plan.description}</p>
              <ul className="mt-5 space-y-2 text-sm leading-6">
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <p className="mt-5 text-xs leading-5 text-soft">
                Daily limits — chat {plan.limits.chatDaily}, studio {plan.limits.studioDaily}, images{" "}
                {plan.limits.imageDaily}, diagrams {plan.limits.diagramDaily} (UTC reset).
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {plan.id === "free" ? (
                  <Link to={user ? "/app/chat" : "/register"}>
                    <Button type="button">{user ? "Open chat" : "Start free"}</Button>
                  </Link>
                ) : (
                  <Button type="button" disabled title="Checkout not live">
                    Premium checkout not live
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : !error ? (
        <p className="text-sm text-soft">Loading plans…</p>
      ) : null}
      {data ? (
        <p className="mt-8 max-w-2xl text-sm leading-6 text-soft">{data.paymentNotice}</p>
      ) : null}
    </div>
  );

  if (embedded) return body;
  return <PublicLayout>{body}</PublicLayout>;
}
