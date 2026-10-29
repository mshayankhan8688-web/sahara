import { Router } from "express";
import { asyncHandler } from "../http.js";
import { studioExportSchema, studioGenerateSchema } from "../lib/schemas.js";
import { requireUser } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/limits.js";
import { validateBody } from "../middleware/validate.js";
import { exportStudioDocument, generateStudioContent } from "../services/studio.js";
import { consumeUsage } from "../services/usage.js";

export const studioRouter = Router();
studioRouter.use(requireUser);

studioRouter.post(
  "/generate",
  chatLimiter,
  validateBody(studioGenerateSchema),
  asyncHandler(async (req, res) => {
    const usage = await consumeUsage(req.user!.id, "studio");
    const result = await generateStudioContent({
      userId: req.user!.id,
      mode: req.body.mode,
      prompt: req.body.prompt,
      title: req.body.title,
      subject: req.body.subject,
      level: req.body.level,
      assignmentType: req.body.assignmentType,
      wordCount: req.body.wordCount,
      writingStyle: req.body.writingStyle,
      slideCount: req.body.slideCount,
      includeSpeakerNotes: req.body.includeSpeakerNotes,
      companionId: req.body.companionId,
      language: req.body.replyLanguage,
      attachment: req.body.attachment,
    });
    res.json({ ...result, usage });
  }),
);

studioRouter.post(
  "/export",
  chatLimiter,
  validateBody(studioExportSchema),
  asyncHandler(async (req, res) => {
    const file = await exportStudioDocument({
      format: req.body.format,
      title: req.body.title,
      content: req.body.content,
      presentation: req.body.presentation,
    });
    res.json({
      filename: file.filename,
      mimeType: file.mimeType,
      data: file.buffer.toString("base64"),
    });
  }),
);
