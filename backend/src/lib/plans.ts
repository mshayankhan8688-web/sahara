import { config } from "../config.js";

export const planIds = ["free", "premium"] as const;
export type PlanId = (typeof planIds)[number];

export type UsageKind = "chat" | "studio" | "image" | "diagram";

export type PlanLimits = {
  chatDaily: number;
  studioDaily: number;
  imageDaily: number;
  diagramDaily: number;
};

export type PlanDefinition = {
  id: PlanId;
  name: string;
  description: string;
  monthlyPricePkr: number | null;
  annualPricePkr: number | null;
  limits: PlanLimits;
  features: string[];
  /** Features advertised as Premium-only (still enforced by limits + flags). */
  premiumOnly: boolean;
};

/** Central plan configuration — change env vars; do not scatter prices in the UI. */
export function getPlans(): Record<PlanId, PlanDefinition> {
  return {
    free: {
      id: "free",
      name: "Free",
      description: "Useful everyday AI chat, study help, and diagrams with daily limits.",
      monthlyPricePkr: null,
      annualPricePkr: null,
      limits: {
        chatDaily: config.freeChatDaily,
        studioDaily: config.freeStudioDaily,
        imageDaily: config.freeImageDaily,
        diagramDaily: config.freeDiagramDaily,
      },
      features: [
        "AI chat with Gemini",
        "Study explanations and exam help",
        "Emotional companion (not a therapist)",
        "Educational SVG diagrams",
        "Chat history on your account",
        "Limited Studio drafts each day",
      ],
      premiumOnly: false,
    },
    premium: {
      id: "premium",
      name: "Premium",
      description: "Higher limits for assignments, PPT/DOCX/PDF exports, and AI images when configured.",
      monthlyPricePkr: config.premiumMonthlyPkr,
      annualPricePkr: config.premiumAnnualPkr,
      limits: {
        chatDaily: config.premiumChatDaily,
        studioDaily: config.premiumStudioDaily,
        imageDaily: config.premiumImageDaily,
        diagramDaily: config.premiumDiagramDaily,
      },
      features: [
        "Everything in Free",
        "Higher daily AI and Studio limits",
        "Assignment and PPT workflows",
        "DOCX / PDF / PPTX downloads",
        "AI image generation when Gemini image quota is available",
        "Priority rate room within server limits",
      ],
      premiumOnly: true,
    },
  };
}

export function planOf(id: PlanId | string | null | undefined): PlanDefinition {
  const plans = getPlans();
  if (id === "premium") return plans.premium;
  return plans.free;
}

export function limitFor(planId: PlanId, kind: UsageKind): number {
  const plan = planOf(planId);
  switch (kind) {
    case "chat":
      return plan.limits.chatDaily;
    case "studio":
      return plan.limits.studioDaily;
    case "image":
      return plan.limits.imageDaily;
    case "diagram":
      return plan.limits.diagramDaily;
  }
}

/** UTC calendar day key YYYY-MM-DD */
export function usageDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function nextUtcResetIso(date = new Date()): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0));
  return next.toISOString();
}
