import mongoose, { Schema } from "mongoose";

const usageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    day: { type: String, required: true, maxlength: 10 },
    chatCount: { type: Number, required: true, default: 0, min: 0 },
    studioCount: { type: Number, required: true, default: 0, min: 0 },
    imageCount: { type: Number, required: true, default: 0, min: 0 },
    diagramCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

usageSchema.index({ userId: 1, day: 1 }, { unique: true });

export type UsageDocument = mongoose.InferSchemaType<typeof usageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Usage = mongoose.model("Usage", usageSchema);
