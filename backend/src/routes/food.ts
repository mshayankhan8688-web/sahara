import { Router } from "express";
import { asyncHandler, HttpError } from "../http.js";
import { foodSchema } from "../lib/schemas.js";
import { Companion } from "../models/Companion.js";
import { Preference } from "../models/Preference.js";
import { requireUser } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/limits.js";
import { validateBody } from "../middleware/validate.js";
import { composeReply } from "../services/gemini.js";
import { withUsage } from "../services/usage.js";

export const foodRouter = Router();

foodRouter.post(
  "/recommend",
  requireUser,
  chatLimiter,
  validateBody(foodSchema),
  asyncHandler(async (req, res) => {
    const companion = await Companion.findOne({ userId: req.user!.id, isDefault: true });
    if (!companion) throw new HttpError(400, "Choose a companion first.", "NO_COMPANION");
    const doc = await Preference.findOne({ userId: req.user!.id }).lean();
    const preferences =
      doc && doc.personalizationEnabled
        ? {
            favoriteCuisines: doc.favoriteCuisines,
            favoriteFoods: doc.favoriteFoods,
            dislikes: doc.dislikes,
            vegetarian: doc.vegetarian,
            vegan: doc.vegan,
            halal: doc.halal,
            allergies: doc.allergies,
            dietaryRestrictions: doc.dietaryRestrictions,
            budget: doc.budget,
            spiceLevel: doc.spiceLevel,
            personalizationEnabled: true,
          }
        : null;
    const { result: content, usage } = await withUsage(req.user!.id, "chat", () =>
      composeReply({
        companionName: companion.name,
        companionStyle: companion.style,
        preferences,
        history: [],
        latest: req.body.note,
        search: { status: "not_requested", results: [] },
        replyLanguage: req.body.replyLanguage,
      }),
    );
    res.json({
      content,
      saved: false,
      notice: "This is a general Gemini suggestion. It is not medical advice.",
      usage,
    });
  }),
);
