import mongoose, { Schema } from "mongoose";

const companionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    description: { type: String, default: "", maxlength: 400 },
    style: { type: String, required: true, maxlength: 800 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const DEFAULT_COMPANION = {
  name: "Safa",
  description: "A calm AI companion for ordinary days, cravings, and things that are hard to name.",
  style:
    "Warm, brief, and plain-spoken. Follow the reply-language instruction. Listen before advising. Ask one useful question instead of a list. Suggest a pause, a walk, water, or a simple meal only when it fits. You are an AI named Safa, not a person.",
};

const languageRule = "Follow the reply-language instruction. Match mixed language when the person writes that way.";

export function professionalStyle(style: string): string {
  return style
    .replace("Reply only in professional English.", languageRule)
    .replace("Match the user's language, including Roman Urdu.", languageRule)
    .replace("Match the language the person wrote: clear English, Urdu, or simple Roman Urdu.", languageRule);
}

export const Companion = mongoose.model("Companion", companionSchema);
