import { Router } from "express";
import { asyncHandler } from "../http.js";
import { asObjectId } from "../lib/objectId.js";
import { studyGoalProgressSchema, studyGoalSchema } from "../lib/schemas.js";
import { StudyGoal, utcDayKey } from "../models/StudyGoal.js";
import { requireUser } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

export const studyGoalRouter = Router();
studyGoalRouter.use(requireUser);

function serialize(goal: {
  topic: string;
  minutesPerDay: number;
  minutesDone: number;
  day: string;
  updatedAt?: Date;
}) {
  return {
    topic: goal.topic,
    minutesPerDay: goal.minutesPerDay,
    minutesDone: goal.minutesDone,
    day: goal.day,
    remaining: Math.max(0, goal.minutesPerDay - goal.minutesDone),
    updatedAt: goal.updatedAt,
  };
}

async function loadOrCreate(userId: ReturnType<typeof asObjectId>) {
  const day = utcDayKey();
  let goal = await StudyGoal.findOne({ userId });
  if (!goal) {
    goal = await StudyGoal.create({ userId, topic: "", minutesPerDay: 30, minutesDone: 0, day });
    return goal;
  }
  if (goal.day !== day) {
    goal.day = day;
    goal.minutesDone = 0;
    await goal.save();
  }
  return goal;
}

studyGoalRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const goal = await loadOrCreate(asObjectId(req.user!.id));
    res.json({ goal: serialize(goal) });
  }),
);

studyGoalRouter.put(
  "/",
  validateBody(studyGoalSchema),
  asyncHandler(async (req, res) => {
    const userId = asObjectId(req.user!.id);
    const day = utcDayKey();
    const existing = await StudyGoal.findOne({ userId });
    const resetDone = !existing || existing.day !== day;
    const minutesDone =
      typeof req.body.minutesDone === "number"
        ? Math.min(req.body.minutesDone, req.body.minutesPerDay)
        : resetDone
          ? 0
          : existing.minutesDone;
    const goal = await StudyGoal.findOneAndUpdate(
      { userId },
      {
        $set: {
          topic: req.body.topic ?? "",
          minutesPerDay: req.body.minutesPerDay,
          minutesDone,
          day,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json({ goal: serialize(goal!) });
  }),
);

studyGoalRouter.post(
  "/progress",
  validateBody(studyGoalProgressSchema),
  asyncHandler(async (req, res) => {
    const goal = await loadOrCreate(asObjectId(req.user!.id));
    goal.minutesDone = Math.min(goal.minutesPerDay, goal.minutesDone + req.body.minutes);
    await goal.save();
    res.json({ goal: serialize(goal) });
  }),
);
