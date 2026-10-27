import { Router } from "express";
import { asyncHandler } from "../http.js";
import { preferenceSchema } from "../lib/schemas.js";
import { emptyPreferences, Preference } from "../models/Preference.js";
import { requireUser } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

export const preferenceRouter = Router();
preferenceRouter.use(requireUser);

preferenceRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const doc = await Preference.findOne({ userId: req.user!.id }).lean();
    if (!doc) {
      res.json({ preferences: emptyPreferences });
      return;
    }
    res.json({
      preferences: {
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
        personalizationEnabled: doc.personalizationEnabled,
        saved: true,
      },
    });
  }),
);

preferenceRouter.put(
  "/",
  validateBody(preferenceSchema),
  asyncHandler(async (req, res) => {
    const doc = await Preference.findOneAndUpdate({ userId: req.user!.id }, { ...req.body, userId: req.user!.id }, { new: true, upsert: true });
    res.json({
      preferences: {
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
        personalizationEnabled: doc.personalizationEnabled,
        saved: true,
      },
    });
  }),
);

preferenceRouter.delete(
  "/",
  asyncHandler(async (req, res) => {
    await Preference.deleteOne({ userId: req.user!.id });
    res.json({ preferences: emptyPreferences });
  }),
);
