import mongoose, { Schema } from "mongoose";

const taskSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    notes: { type: String, default: "", maxlength: 1000 },
    dueOn: { type: String, default: "" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    done: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Task = mongoose.model("Task", taskSchema);
