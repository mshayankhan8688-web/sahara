import { Router } from "express";
import { asyncHandler, HttpError } from "../http.js";
import { asObjectId, routeParam } from "../lib/objectId.js";
import { journalSchema } from "../lib/schemas.js";
import { JournalEntry } from "../models/JournalEntry.js";
import { requireUser } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

export const journalRouter = Router();
journalRouter.use(requireUser);

function present(entry: { id?: string; _id: { toString(): string }; content?: string; moodTag?: string; status?: string; createdAt?: Date; updatedAt?: Date }) {
  return {
    id: entry.id ?? entry._id.toString(),
    content: entry.content ?? "",
    moodTag: entry.moodTag ?? "",
    status: entry.status ?? "draft",
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

journalRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const filter: Record<string, unknown> = { userId: req.user!.id };
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ content: new RegExp(escaped, "i") }, { moodTag: new RegExp(escaped, "i") }];
    }
    const entries = await JournalEntry.find(filter).sort({ updatedAt: -1 }).limit(100);
    res.json({ entries: entries.map(present) });
  }),
);

journalRouter.post(
  "/",
  validateBody(journalSchema),
  asyncHandler(async (req, res) => {
    if (req.body.status === "saved" && !req.body.content.trim()) {
      throw new HttpError(400, "Write something before saving.", "EMPTY_JOURNAL");
    }
    const entry = await JournalEntry.create({ userId: req.user!.id, ...req.body });
    res.status(201).json({ entry: present(entry) });
  }),
);

journalRouter.put(
  "/:id",
  validateBody(journalSchema),
  asyncHandler(async (req, res) => {
    if (req.body.status === "saved" && !req.body.content.trim()) {
      throw new HttpError(400, "Write something before saving.", "EMPTY_JOURNAL");
    }
    const entry = await JournalEntry.findOneAndUpdate(
      { _id: asObjectId(routeParam(req.params.id)), userId: req.user!.id },
      req.body,
      { new: true },
    );
    if (!entry) throw new HttpError(404, "That journal entry was not found.", "NOT_FOUND");
    res.json({ entry: present(entry) });
  }),
);

journalRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const entry = await JournalEntry.findOneAndDelete({ _id: asObjectId(routeParam(req.params.id)), userId: req.user!.id });
    if (!entry) throw new HttpError(404, "That journal entry was not found.", "NOT_FOUND");
    res.status(204).end();
  }),
);
