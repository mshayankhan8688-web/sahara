import { Router } from "express";
import { asyncHandler, HttpError } from "../http.js";
import { asObjectId, routeParam } from "../lib/objectId.js";
import { guideSchema, planSchema, taskPatchSchema, taskSchema } from "../lib/schemas.js";
import { requireUser } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/limits.js";
import { validateBody } from "../middleware/validate.js";
import { Plan } from "../models/Plan.js";
import { Task } from "../models/Task.js";
import { writeGuide } from "../services/guide.js";

function taskJson(task: { _id: { toString(): string }; title: string; notes?: string; dueOn?: string; priority?: string; done?: boolean; createdAt?: Date }) {
  return {
    id: task._id.toString(),
    title: task.title,
    notes: task.notes ?? "",
    dueOn: task.dueOn ?? "",
    priority: task.priority ?? "medium",
    done: Boolean(task.done),
    createdAt: task.createdAt,
  };
}

export const taskRouter = Router();
taskRouter.use(requireUser);

taskRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tasks = await Task.find({ userId: req.user!.id }).sort({ done: 1, createdAt: -1 }).limit(100).lean();
    res.json({ tasks: tasks.map(taskJson) });
  }),
);

taskRouter.post(
  "/",
  validateBody(taskSchema),
  asyncHandler(async (req, res) => {
    const task = await Task.create({ userId: req.user!.id, ...req.body });
    res.status(201).json({ task: taskJson(task) });
  }),
);

taskRouter.patch(
  "/:id",
  validateBody(taskPatchSchema),
  asyncHandler(async (req, res) => {
    const task = await Task.findOneAndUpdate({ _id: asObjectId(routeParam(req.params.id)), userId: req.user!.id }, req.body, { new: true });
    if (!task) throw new HttpError(404, "That task was not found.", "NOT_FOUND");
    res.json({ task: taskJson(task) });
  }),
);

taskRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const task = await Task.findOneAndDelete({ _id: asObjectId(routeParam(req.params.id)), userId: req.user!.id });
    if (!task) throw new HttpError(404, "That task was not found.", "NOT_FOUND");
    res.status(204).end();
  }),
);

export const planRouter = Router();
planRouter.use(requireUser);

planRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
    const filter = kind ? { userId: req.user!.id, kind } : { userId: req.user!.id };
    const plans = await Plan.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    res.json({
      plans: plans.map((plan) => ({
        id: plan._id.toString(),
        kind: plan.kind,
        title: plan.title,
        content: plan.content,
        createdAt: plan.createdAt,
      })),
    });
  }),
);

planRouter.post(
  "/",
  validateBody(planSchema),
  asyncHandler(async (req, res) => {
    const plan = await Plan.create({ userId: req.user!.id, ...req.body });
    res.status(201).json({
      plan: { id: plan.id, kind: plan.kind, title: plan.title, content: plan.content, createdAt: plan.createdAt },
    });
  }),
);

planRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const plan = await Plan.findOneAndDelete({ _id: asObjectId(routeParam(req.params.id)), userId: req.user!.id });
    if (!plan) throw new HttpError(404, "That saved plan was not found.", "NOT_FOUND");
    res.status(204).end();
  }),
);

export const guideRouter = Router();
guideRouter.use(requireUser);

guideRouter.post(
  "/",
  chatLimiter,
  validateBody(guideSchema),
  asyncHandler(async (req, res) => {
    const content = await writeGuide(req.user!.id, req.body.kind, req.body.prompt, req.body.replyLanguage);
    res.json({ content });
  }),
);
