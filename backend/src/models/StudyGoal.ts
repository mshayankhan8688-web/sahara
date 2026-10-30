import mongoose, { Schema } from "mongoose";

const studyGoalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    topic: { type: String, trim: true, maxlength: 120, default: "" },
    minutesPerDay: { type: Number, required: true, min: 5, max: 480, default: 30 },
    minutesDone: { type: Number, required: true, min: 0, max: 480, default: 0 },
    day: { type: String, required: true, maxlength: 10 },
  },
  { timestamps: true },
);

export type StudyGoalDocument = mongoose.InferSchemaType<typeof studyGoalSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const StudyGoal = mongoose.model("StudyGoal", studyGoalSchema);

export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
