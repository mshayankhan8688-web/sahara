import { Router } from "express";
import { asyncHandler } from "../http.js";
import { imageDiagramSchema, imageEditSchema, imageGenerateSchema } from "../lib/schemas.js";
import { requireUser } from "../middleware/auth.js";
import { imageLimiter } from "../middleware/limits.js";
import { validateBody } from "../middleware/validate.js";
import { createDiagramReply, createEditedImageReply, createGeneratedImageReply } from "../services/imageChat.js";
import { consumeUsage } from "../services/usage.js";

export const imageRouter = Router();
imageRouter.use(requireUser);

imageRouter.post(
  "/generate",
  imageLimiter,
  validateBody(imageGenerateSchema),
  asyncHandler(async (req, res) => {
    const usage = await consumeUsage(req.user!.id, "image");
    const result = await createGeneratedImageReply({
      userId: req.user!.id,
      conversationId: req.body.conversationId,
      companionId: req.body.companionId,
      prompt: req.body.prompt,
      style: req.body.style,
      purpose: req.body.purpose,
    });
    res.json({ ...result, usage });
  }),
);

imageRouter.post(
  "/edit",
  imageLimiter,
  validateBody(imageEditSchema),
  asyncHandler(async (req, res) => {
    const usage = await consumeUsage(req.user!.id, "image");
    const result = await createEditedImageReply({
      userId: req.user!.id,
      conversationId: req.body.conversationId,
      companionId: req.body.companionId,
      prompt: req.body.prompt,
      image: req.body.image,
    });
    res.json({ ...result, usage });
  }),
);

imageRouter.post(
  "/diagram",
  imageLimiter,
  validateBody(imageDiagramSchema),
  asyncHandler(async (req, res) => {
    const usage = await consumeUsage(req.user!.id, "diagram");
    const result = await createDiagramReply({
      userId: req.user!.id,
      conversationId: req.body.conversationId,
      companionId: req.body.companionId,
      prompt: req.body.prompt,
      kind: req.body.kind,
    });
    res.json({ ...result, usage });
  }),
);
