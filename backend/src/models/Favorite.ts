import mongoose, { Schema } from "mongoose";

const favoriteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    content: { type: String, required: true, maxlength: 4000 },
  },
  { timestamps: true },
);

favoriteSchema.index({ userId: 1, messageId: 1 }, { unique: true });
favoriteSchema.index({ userId: 1, createdAt: -1 });

export type FavoriteDocument = mongoose.InferSchemaType<typeof favoriteSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Favorite = mongoose.model("Favorite", favoriteSchema);
