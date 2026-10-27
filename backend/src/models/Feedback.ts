import mongoose, { Schema } from "mongoose";
import { feedbackCategories } from "../lib/schemas.js";

const feedbackSchema = new Schema(
  {
    rating: { type: Number, required: true, min: 1, max: 5 },
    category: { type: String, enum: feedbackCategories, required: true },
    comment: { type: String, required: true, maxlength: 2000 },
    email: { type: String, default: "", maxlength: 120 },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const Feedback = mongoose.model("Feedback", feedbackSchema);
