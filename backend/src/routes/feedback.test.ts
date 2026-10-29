import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import request from "supertest";
import type { Express } from "express";

const reviewKey = "test-review-key-123456";
let app: Express;
let memory: { stop: () => Promise<boolean> };

before(async () => {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const server = await MongoMemoryServer.create();
  memory = server;
  process.env.MONGODB_URI = server.getUri();
  process.env.JWT_SECRET = "test-secret-1234567890";
  process.env.FRONTEND_URL = "http://localhost:5173";
  process.env.NODE_ENV = "test";
  process.env.GEMINI_API_KEY = "";
  process.env.GOOGLE_PLACES_API_KEY = "";
  process.env.COOKIE_SAMESITE = "lax";
  process.env.COOKIE_SECURE = "false";
  process.env.FEEDBACK_REVIEW_SECRET = reviewKey;
  const { connectDb } = await import("../db.js");
  await connectDb();
  const { createApp } = await import("../app.js");
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  await memory.stop();
});

const header = { "x-heartspace-request": "1" };

test("saves feedback and shows it only with the review key", async () => {
  const blocked = await request(app).post("/api/feedback").send({
    rating: 4,
    category: "Design",
    comment: "The pages are clear enough to use.",
  });
  assert.equal(blocked.status, 403);

  const invalid = await request(app).post("/api/feedback").set(header).send({
    rating: 4,
    category: "Design",
    comment: "short",
  });
  assert.equal(invalid.status, 400);

  const saved = await request(app).post("/api/feedback").set(header).send({
    rating: 5,
    category: "AI Chat",
    comment: "The reply came back and I could continue the thread.",
    email: "",
    company: "",
  });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.saved, true);
  assert.equal(saved.body.email, undefined);

  const hidden = await request(app).get("/api/feedback");
  assert.equal(hidden.status, 401);

  const denied = await request(app).get("/api/feedback").set("x-sahara-review", "wrong-review-key");
  assert.equal(denied.status, 401);

  const review = await request(app).get("/api/feedback").set("x-sahara-review", reviewKey);
  assert.equal(review.status, 200);
  assert.equal(review.body.feedback.length, 1);
  assert.equal(review.body.feedback[0].category, "AI Chat");
  assert.equal(review.body.feedback[0].rating, 5);
  assert.equal(review.body.feedback[0].comment.includes("continue the thread"), true);

  const summary = await request(app).get("/api/feedback/summary");
  assert.equal(summary.status, 200);
  assert.equal(summary.body.count, 1);
  assert.equal(summary.body.average, 5);
  assert.equal(summary.body.stars[5], 1);
  assert.equal(summary.body.stars[1], 0);
  assert.equal(summary.body.comment, undefined);
  assert.equal(summary.body.feedback, undefined);
});
