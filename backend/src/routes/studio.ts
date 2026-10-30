import { Router } from "express";
import { asyncHandler } from "../http.js";
import { studioExportSchema, studioGenerateSchema } from "../lib/schemas.js";
import { requireUser } from "../middleware/auth.js";
import { chatLimiter, exportLimiter } from "../middleware/limits.js";
import { validateBody } from "../middleware/validate.js";
import { exportStudioDocument, generateStudioContent } from "../services/studio.js";
import { withUsage } from "../services/usage.js";

export const studioRouter = Router();
studioRouter.use(requireUser);

studioRouter.post(
  "/generate",
  chatLimiter,
  validateBody(studioGenerateSchema),
  asyncHandler(async (req, res) => {
    const { result, usage } = await withUsage(req.user!.id, "studio", () =>
      generateStudioContent({
        userId: req.user!.id,
        mode: req.body.mode,
        prompt: req.body.prompt,
        title: req.body.title,
        subject: req.body.subject,
        level: req.body.level,
        assignmentType: req.body.assignmentType,
        wordCount: req.body.wordCount,
        writingStyle: req.body.writingStyle,
        studyFormat: req.body.studyFormat,
        documentType: req.body.documentType,
        audience: req.body.audience,
        presentationStyle: req.body.presentationStyle,
        slideCount: req.body.slideCount,
        includeSpeakerNotes: req.body.includeSpeakerNotes,
        companionId: req.body.companionId,
        language: req.body.replyLanguage,
        attachment: req.body.attachment,
      }),
    );
    res.json({ ...result, usage });
  }),
);

studioRouter.post(
  "/export",
  exportLimiter,
  validateBody(studioExportSchema),
  asyncHandler(async (req, res) => {
    const { result: file, usage } = await withUsage(req.user!.id, "studio", () =>
      exportStudioDocument({
        format: req.body.format,
        title: req.body.title,
        content: req.body.content,
        presentation: req.body.presentation,
      }),
    );
    res.json({
      filename: file.filename,
      mimeType: file.mimeType,
      data: file.buffer.toString("base64"),
      usage,
    });
  }),
);
