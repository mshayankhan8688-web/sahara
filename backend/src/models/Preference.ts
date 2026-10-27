import mongoose, { Schema } from "mongoose";

const preferenceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    favoriteCuisines: { type: [String], default: [] },
    favoriteFoods: { type: [String], default: [] },
    dislikes: { type: [String], default: [] },
    vegetarian: { type: Boolean, default: false },
    vegan: { type: Boolean, default: false },
    halal: { type: Boolean, default: false },
    allergies: { type: [String], default: [] },
    dietaryRestrictions: { type: [String], default: [] },
    budget: { type: String, enum: ["any", "low", "medium", "high"], default: "any" },
    spiceLevel: { type: String, enum: ["any", "mild", "medium", "hot"], default: "any" },
    personalizationEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Preference = mongoose.model("Preference", preferenceSchema);

export const emptyPreferences = {
  favoriteCuisines: [] as string[],
  favoriteFoods: [] as string[],
  dislikes: [] as string[],
  vegetarian: false,
  vegan: false,
  halal: false,
  allergies: [] as string[],
  dietaryRestrictions: [] as string[],
  budget: "any" as const,
  spiceLevel: "any" as const,
  personalizationEnabled: true,
  saved: false,
};
