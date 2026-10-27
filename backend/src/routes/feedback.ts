import { Router } from "express";
import { config } from "../config.js";
import { asyncHandler, HttpError } from "../http.js";
import { feedbackBodySchema } from "../lib/schemas.js";
import { reviewAuthorized } from "../lib/reviewSecret.js";
import { readSession } from "../lib/tokens.js";
import { Feedback } from "../models/Feedback.js";
import { User } from "../models/User.js";
import { feedbackLimiter, feedbackReviewLimiter } from "../middleware/limits.js";
import { validateBody } from "../middleware/validate.js";

export const feedbackRouter = Router();

feedbackRouter.post(
  "/",
  feedbackLimiter,
  validateBody(feedbackBodySchema),
  asyncHandler(async (req, res) => {
    let userId: string | undefined;
    const header = req.get("authorization");
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const token = bearer || req.cookies?.heartspace_session;
    if (typeof token === "string" && token.length > 0) {
      try {
        const session = readSession(token);
        const user = await User.findById(session.sub).select("_id tokenVersion");
        if (user && user.tokenVersion === session.ver) userId = user.id;
      } catch (error) {
        console.error("Feedback continued without a session", error);
      }
    }

    const saved = await Feedback.create({
      rating: req.body.rating,
      category: req.body.category,
      comment: req.body.comment,
      email: req.body.email ?? "",
      userId,
    });
    if (!saved.id) throw new HttpError(500, "Feedback was not saved.", "NOT_SAVED");
    res.status(201).json({ saved: true });
  }),
);

feedbackRouter.get(
  "/",
  feedbackReviewLimiter,
  asyncHandler(async (_req, res) => {
    if (!config.feedbackReviewSecret) {
      throw new HttpError(
        503,
        "Feedback review is not configured. Set FEEDBACK_REVIEW_SECRET on the API.",
        "FEEDBACK_REVIEW_NOT_CONFIGURED",
      );
    }
    if (!reviewAuthorized(_req.get("x-sahara-review"))) {
      throw new HttpError(401, "The review key was not accepted.", "REVIEW_DENIED");
    }
    const rows = await Feedback.find().sort({ createdAt: -1 }).limit(100).select("rating category comment email createdAt userId").lean();
    res.json({
      feedback: rows.map((row) => ({
        id: String(row._id),
        rating: row.rating,
        category: row.category,
        comment: row.comment,
        email: row.email ?? "",
        signedIn: Boolean(row.userId),
        createdAt: row.createdAt,
      })),
    });
  }),
);
