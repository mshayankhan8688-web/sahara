import mongoose, { Schema } from "mongoose";

const journalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    content: { type: String, default: "", maxlength: 8000 },
    moodTag: { type: String, default: "", maxlength: 40 },
    status: { type: String, enum: ["draft", "saved"], default: "draft" },
  },
  { timestamps: true },
);

export const JournalEntry = mongoose.model("JournalEntry", journalSchema);
