import { Router } from "express";
import { paymentsConfigured } from "../config.js";
import { asyncHandler } from "../http.js";
import { getPlans } from "../lib/plans.js";
import { requireUser } from "../middleware/auth.js";
import { getUsageSnapshot } from "../services/usage.js";

export const billingRouter = Router();

billingRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    const plans = Object.values(getPlans()).map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      monthlyPricePkr: plan.monthlyPricePkr,
      annualPricePkr: plan.annualPricePkr,
      limits: plan.limits,
      features: plan.features,
      premiumOnly: plan.premiumOnly,
    }));
    res.json({
      currency: "PKR",
      paymentsConfigured,
      paymentNotice: paymentsConfigured
        ? "Checkout is available for Premium."
        : "Plan prices are configured, but live payment checkout is not enabled yet. Nobody is charged.",
      plans,
    });
  }),
);

billingRouter.get(
  "/usage",
  requireUser,
  asyncHandler(async (req, res) => {
    const usage = await getUsageSnapshot(req.user!.id);
    res.json({ usage });
  }),
);

billingRouter.get(
  "/status",
  requireUser,
  asyncHandler(async (req, res) => {
    const usage = await getUsageSnapshot(req.user!.id);
    res.json({
      planId: usage.planId,
      planName: usage.planName,
      paymentsConfigured,
      canCheckout: false,
      checkoutNotice: paymentsConfigured
        ? "Payment provider wiring is incomplete until merchant credentials are verified."
        : "Premium checkout is not live. Limits still apply on the Free plan.",
      usage,
    });
  }),
);
