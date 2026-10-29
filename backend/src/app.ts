import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { aiConfigured, config, placesConfigured, paymentsConfigured as paymentsLive } from "./config.js";
import { isAllowedOrigin } from "./lib/origin.js";
import { errorHandler } from "./http.js";
import { authRouter } from "./routes/auth.js";
import { messageRouter, conversationRouter } from "./routes/chat.js";
import { companionRouter } from "./routes/companions.js";
import { foodRouter } from "./routes/food.js";
import { journalRouter } from "./routes/journal.js";
import { preferenceRouter } from "./routes/preferences.js";
import { guideRouter, planRouter, taskRouter } from "./routes/life.js";
import { feedbackRouter } from "./routes/feedback.js";
import { photoRouter, restaurantRouter } from "./routes/restaurants.js";
import { studioRouter } from "./routes/studio.js";
import { imageRouter } from "./routes/images.js";
import { billingRouter } from "./routes/billing.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin, config.frontendUrl) ? origin ?? true : false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "6mb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.get("x-heartspace-request") !== "1") {
      res.status(403).json({ message: "This request was blocked.", code: "CSRF" });
      return;
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: mongoose.connection.readyState === 1,
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      aiConfigured,
      placesConfigured,
      paymentsConfigured: paymentsLive,
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/companions", companionRouter);
  app.use("/api/conversations", conversationRouter);
  app.use("/api/chat", messageRouter);
  app.use("/api/journal", journalRouter);
  app.use("/api/preferences", preferenceRouter);
  app.use("/api/food", foodRouter);
  app.use("/api/restaurants/photo", photoRouter);
  app.use("/api/restaurants", restaurantRouter);
  app.use("/api/tasks", taskRouter);
  app.use("/api/plans", planRouter);
  app.use("/api/guide", guideRouter);
  app.use("/api/studio", studioRouter);
  app.use("/api/images", imageRouter);
  app.use("/api/feedback", feedbackRouter);
  app.use((_req, res) => {
    res.status(404).json({ message: "That route does not exist.", code: "NOT_FOUND" });
  });
  app.use(errorHandler);
  return app;
}
