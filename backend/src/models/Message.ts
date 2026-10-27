import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sender: { type: String, enum: ["user", "assistant"], required: true },
    kind: { type: String, enum: ["ai", "notice"], default: "ai" },
    content: { type: String, required: true, maxlength: 12000 },
    attachment: {
      name: { type: String, maxlength: 80 },
      mimeType: { type: String, maxlength: 80 },
      data: { type: String, maxlength: 4_500_000 },
    },
    places: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Message = mongoose.model("Message", messageSchema);
