import { Router } from "express";
import { asyncHandler, HttpError } from "../http.js";
import { asObjectId, routeParam } from "../lib/objectId.js";
import { companionSchema } from "../lib/schemas.js";
import { Companion } from "../models/Companion.js";
import { requireUser } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

export const companionRouter = Router();
companionRouter.use(requireUser);

function present(companion: { id?: string; _id: { toString(): string }; name: string; description?: string; style: string; isDefault?: boolean }) {
  return {
    id: companion.id ?? companion._id.toString(),
    name: companion.name,
    description: companion.description ?? "",
    style: companion.style,
    isDefault: Boolean(companion.isDefault),
  };
}

companionRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const companions = await Companion.find({ userId: req.user!.id }).sort({ createdAt: 1 });
    res.json({ companions: companions.map(present) });
  }),
);

companionRouter.post(
  "/",
  validateBody(companionSchema),
  asyncHandler(async (req, res) => {
    const count = await Companion.countDocuments({ userId: req.user!.id });
    const companion = await Companion.create({
      userId: req.user!.id,
      name: req.body.name,
      description: req.body.description,
      style: req.body.style,
      isDefault: count === 0,
    });
    res.status(201).json({ companion: present(companion) });
  }),
);

companionRouter.put(
  "/:id",
  validateBody(companionSchema),
  asyncHandler(async (req, res) => {
    const companion = await Companion.findOneAndUpdate(
      { _id: asObjectId(routeParam(req.params.id)), userId: req.user!.id },
      { name: req.body.name, description: req.body.description, style: req.body.style },
      { new: true },
    );
    if (!companion) throw new HttpError(404, "That companion was not found.", "NOT_FOUND");
    res.json({ companion: present(companion) });
  }),
);

companionRouter.post(
  "/:id/default",
  asyncHandler(async (req, res) => {
    const companion = await Companion.findOne({ _id: asObjectId(routeParam(req.params.id)), userId: req.user!.id });
    if (!companion) throw new HttpError(404, "That companion was not found.", "NOT_FOUND");
    await Companion.updateMany({ userId: req.user!.id }, { isDefault: false });
    companion.isDefault = true;
    await companion.save();
    res.json({ companion: present(companion) });
  }),
);

companionRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const count = await Companion.countDocuments({ userId: req.user!.id });
    if (count <= 1) throw new HttpError(400, "Keep at least one companion.", "LAST_COMPANION");
    const companion = await Companion.findOneAndDelete({ _id: asObjectId(routeParam(req.params.id)), userId: req.user!.id });
    if (!companion) throw new HttpError(404, "That companion was not found.", "NOT_FOUND");
    if (companion.isDefault) {
      await Companion.updateOne({ userId: req.user!.id }, { isDefault: true });
    }
    res.status(204).end();
  }),
);
