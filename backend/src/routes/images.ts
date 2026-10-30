import { Router } from "express";
import { asyncHandler } from "../http.js";
import { imageDiagramSchema, imageEditSchema, imageGenerateSchema } from "../lib/schemas.js";
import { requireUser } from "../middleware/auth.js";
import { imageLimiter } from "../middleware/limits.js";
import { validateBody } from "../middleware/validate.js";
import { createDiagramReply, createEditedImageReply, createGeneratedImageReply } from "../services/imageChat.js";
import { withUsage } from "../services/usage.js";

export const imageRouter = Router();
imageRouter.use(requireUser);

imageRouter.post(
  "/generate",
  imageLimiter,
  validateBody(imageGenerateSchema),
  asyncHandler(async (req, res) => {
    const { result, usage } = await withUsage(req.user!.id, "image", () =>
      createGeneratedImageReply({
        userId: req.user!.id,
        conversationId: req.body.conversationId,
        companionId: req.body.companionId,
        prompt: req.body.prompt,
        style: req.body.style,
        purpose: req.body.purpose,
      }),
    );
    res.json({ ...result, usage });
  }),
);

imageRouter.post(
  "/edit",
  imageLimiter,
  validateBody(imageEditSchema),
  asyncHandler(async (req, res) => {
    const { result, usage } = await withUsage(req.user!.id, "image", () =>
      createEditedImageReply({
        userId: req.user!.id,
        conversationId: req.body.conversationId,
        companionId: req.body.companionId,
        prompt: req.body.prompt,
        image: req.body.image,
      }),
    );
    res.json({ ...result, usage });
  }),
);

imageRouter.post(
  "/diagram",
  imageLimiter,
  validateBody(imageDiagramSchema),
  asyncHandler(async (req, res) => {
    const { result, usage } = await withUsage(req.user!.id, "diagram", () =>
      createDiagramReply({
        userId: req.user!.id,
        conversationId: req.body.conversationId,
        companionId: req.body.companionId,
        prompt: req.body.prompt,
        kind: req.body.kind,
      }),
    );
    res.json({ ...result, usage });
  }),
);
