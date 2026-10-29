import { HttpError } from "../http.js";
import { asObjectId } from "../lib/objectId.js";
import {
  getPlans,
  limitFor,
  nextUtcResetIso,
  planOf,
  usageDayKey,
  type PlanId,
  type UsageKind,
} from "../lib/plans.js";
import { Usage } from "../models/Usage.js";
import { User } from "../models/User.js";
import { paymentsConfigured } from "../config.js";

const countField: Record<UsageKind, "chatCount" | "studioCount" | "imageCount" | "diagramCount"> = {
  chat: "chatCount",
  studio: "studioCount",
  image: "imageCount",
  diagram: "diagramCount",
};

export function effectivePlanTier(
  planTier: string | null | undefined,
  planExpiresAt: Date | null | undefined,
  now = new Date(),
): PlanId {
  if (planTier !== "premium") return "free";
  if (planExpiresAt && planExpiresAt.getTime() <= now.getTime()) return "free";
  return "premium";
}

export type UsageBucket = {
  kind: UsageKind;
  used: number;
  limit: number;
  remaining: number;
};

export type UsageSnapshot = {
  planId: PlanId;
  planName: string;
  day: string;
  resetsAt: string;
  paymentsConfigured: boolean;
  buckets: UsageBucket[];
};

function bucketsFromCounts(
  planId: PlanId,
  counts: { chatCount: number; studioCount: number; imageCount: number; diagramCount: number },
): UsageBucket[] {
  const kinds: UsageKind[] = ["chat", "studio", "image", "diagram"];
  return kinds.map((kind) => {
    const used = counts[countField[kind]] ?? 0;
    const limit = limitFor(planId, kind);
    return { kind, used, limit, remaining: Math.max(0, limit - used) };
  });
}

export async function resolveUserPlan(userId: string): Promise<PlanId> {
  const user = await User.findById(asObjectId(userId)).select("planTier planExpiresAt").lean();
  if (!user) throw new HttpError(401, "Sign in again.", "UNAUTHENTICATED");
  return effectivePlanTier(user.planTier, user.planExpiresAt ?? null);
}

export async function getUsageSnapshot(userId: string): Promise<UsageSnapshot> {
  const planId = await resolveUserPlan(userId);
  const day = usageDayKey();
  const row = await Usage.findOne({ userId: asObjectId(userId), day }).lean();
  const counts = {
    chatCount: row?.chatCount ?? 0,
    studioCount: row?.studioCount ?? 0,
    imageCount: row?.imageCount ?? 0,
    diagramCount: row?.diagramCount ?? 0,
  };
  return {
    planId,
    planName: planOf(planId).name,
    day,
    resetsAt: nextUtcResetIso(),
    paymentsConfigured,
    buckets: bucketsFromCounts(planId, counts),
  };
}

export async function consumeUsage(userId: string, kind: UsageKind): Promise<UsageSnapshot> {
  const planId = await resolveUserPlan(userId);
  const limit = limitFor(planId, kind);
  const day = usageDayKey();
  const field = countField[kind];
  const oid = asObjectId(userId);

  await Usage.updateOne(
    { userId: oid, day },
    {
      $setOnInsert: {
        userId: oid,
        day,
        chatCount: 0,
        studioCount: 0,
        imageCount: 0,
        diagramCount: 0,
      },
    },
    { upsert: true },
  );

  if (limit <= 0) {
    throw usageLimitError(planId, kind, 0, limit);
  }

  const updated = await Usage.findOneAndUpdate(
    { userId: oid, day, [field]: { $lt: limit } },
    { $inc: { [field]: 1 } },
    { new: true },
  ).lean();

  if (!updated) {
    const current = await Usage.findOne({ userId: oid, day }).lean();
    throw usageLimitError(planId, kind, current?.[field] ?? limit, limit);
  }

  return {
    planId,
    planName: planOf(planId).name,
    day,
    resetsAt: nextUtcResetIso(),
    paymentsConfigured,
    buckets: bucketsFromCounts(planId, {
      chatCount: updated.chatCount,
      studioCount: updated.studioCount,
      imageCount: updated.imageCount,
      diagramCount: updated.diagramCount,
    }),
  };
}

function usageLimitError(planId: PlanId, kind: UsageKind, used: number, limit: number): HttpError {
  const resetsAt = nextUtcResetIso();
  const label =
    kind === "chat"
      ? "chat replies"
      : kind === "studio"
        ? "Studio generations"
        : kind === "image"
          ? "AI images"
          : "diagrams";
  const upgradeHint = planId === "free" && paymentsConfigured
    ? " Upgrade to Premium for higher daily limits."
    : planId === "free"
      ? " Premium checkout is not live yet; limits protect API cost."
      : "";
  return new HttpError(
    429,
    `Daily ${label} limit reached (${used}/${limit}). Resets at ${resetsAt} (UTC midnight).${upgradeHint}`,
    "USAGE_LIMIT",
    {
      kind,
      used,
      limit,
      remaining: 0,
      planId,
      resetsAt,
      paymentsConfigured,
      plans: Object.values(getPlans()).map((plan) => ({
        id: plan.id,
        name: plan.name,
        monthlyPricePkr: plan.monthlyPricePkr,
        annualPricePkr: plan.annualPricePkr,
      })),
    },
  );
}
