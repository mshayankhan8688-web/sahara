import mongoose, { Schema } from "mongoose";

const passwordResetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);
