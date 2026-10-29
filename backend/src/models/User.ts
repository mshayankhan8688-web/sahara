import mongoose, { Schema } from "mongoose";

const savedLocationSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  { _id: false },
);

const avatarSchema = new Schema(
  {
    mimeType: { type: String, required: true, maxlength: 40 },
    data: { type: String, required: true, maxlength: 1_600_000 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, required: true },
    tokenVersion: { type: Number, required: true, default: 0 },
    /** free | premium — Premium requires verified payment or a manual grant. */
    planTier: { type: String, enum: ["free", "premium"], required: true, default: "free" },
    planExpiresAt: { type: Date, default: null },
    avatar: { type: avatarSchema, default: null },
    savedLocation: { type: savedLocationSchema, default: null },
  },
  { timestamps: true },
);

export type SavedLocation = {
  label: string;
  latitude?: number;
  longitude?: number;
};

export type UserDocument = mongoose.InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
  savedLocation?: SavedLocation | null;
};

export const User = mongoose.model("User", userSchema);
