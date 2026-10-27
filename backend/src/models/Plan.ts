import mongoose, { Schema } from "mongoose";

const planSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["study", "career", "day"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, maxlength: 8000 },
  },
  { timestamps: true },
);

export const Plan = mongoose.model("Plan", planSchema);
