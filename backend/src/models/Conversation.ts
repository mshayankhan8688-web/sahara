import mongoose, { Schema } from "mongoose";

const conversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    companionId: { type: Schema.Types.ObjectId, ref: "Companion" },
    title: { type: String, required: true, maxlength: 80 },
  },
  { timestamps: true },
);

export const Conversation = mongoose.model("Conversation", conversationSchema);
