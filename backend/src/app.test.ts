import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import request from "supertest";
import type { Express } from "express";

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
  const { connectDb } = await import("./db.js");
  await connectDb();
  const { createApp } = await import("./app.js");
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  await memory.stop();
});

const header = { "x-heartspace-request": "1" };

test("registers, isolates journal entries, and refuses unconfigured AI and places", async () => {
  const ada = await request(app)
    .post("/api/auth/register")
    .set(header)
    .send({ name: "Ada Noor", email: "ada@example.com", password: "correct-horse" });
  assert.equal(ada.status, 201);
  assert.equal(typeof ada.body.token, "string");

  const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${ada.body.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, "ada@example.com");

  const blocked = await request(app).post("/api/auth/login").send({ email: "ada@example.com", password: "correct-horse" });
  assert.equal(blocked.status, 403);

  const wrong = await request(app)
    .post("/api/auth/login")
    .set(header)
    .send({ email: "ada@example.com", password: "wrong-password" });
  assert.equal(wrong.status, 401);

  const entry = await request(app)
    .post("/api/journal")
    .set(header)
    .set("Authorization", `Bearer ${ada.body.token}`)
    .send({ content: "A private note", moodTag: "quiet", status: "saved" });
  assert.equal(entry.status, 201);

  const bilal = await request(app)
    .post("/api/auth/register")
    .set(header)
    .send({ name: "Bilal", email: "bilal@example.com", password: "another-secret" });
  assert.equal(bilal.status, 201);
  const stolen = await request(app).get("/api/journal").set("Authorization", `Bearer ${bilal.body.token}`);
  assert.equal(stolen.status, 200);
  assert.equal(stolen.body.entries.length, 0);

  const chat = await request(app)
    .post("/api/chat/message")
    .set(header)
    .set("Authorization", `Bearer ${ada.body.token}`)
    .send({ content: "Yaar aaj mood off hai." });
  assert.equal(chat.status, 503);
  assert.equal(chat.body.code, "AI_NOT_CONFIGURED");

  const places = await request(app)
    .post("/api/restaurants/search")
    .set(header)
    .set("Authorization", `Bearer ${ada.body.token}`)
    .send({ query: "burger", area: "Gulberg" });
  assert.equal(places.status, 503);
  assert.equal(places.body.code, "PLACES_NOT_CONFIGURED");

  const resetStatus = await request(app).get("/api/auth/password-reset-status");
  assert.equal(resetStatus.status, 200);
  assert.equal(resetStatus.body.emailDeliveryConfigured, false);
  assert.equal(resetStatus.body.smsDeliveryConfigured, false);
  assert.equal(resetStatus.body.localDevFallback, false);
  assert.equal(resetStatus.body.emailReady, false);
  assert.ok(Array.isArray(resetStatus.body.requiredEnv.email));

  const forgotUnknown = await request(app).post("/api/auth/forgot").set(header).send({ identifier: "missing@example.com" });
  assert.equal(forgotUnknown.status, 503);
  assert.equal(forgotUnknown.body.code, "EMAIL_NOT_CONFIGURED");

  const forgot = await request(app).post("/api/auth/forgot").set(header).send({ identifier: "ada@example.com" });
  assert.equal(forgot.status, 503);
  assert.equal(forgot.body.code, "EMAIL_NOT_CONFIGURED");

  const noor = await request(app)
    .post("/api/auth/register")
    .set(header)
    .send({ name: "Noor", phone: "03001234567", password: "correct-horse" });
  assert.equal(noor.status, 201);
  assert.equal(noor.body.user.phone, "+923001234567");

  const phoneLogin = await request(app)
    .post("/api/auth/login")
    .set(header)
    .send({ email: "03001234567", password: "correct-horse" });
  assert.equal(phoneLogin.status, 200);

  const text = await request(app).post("/api/auth/forgot").set(header).send({ identifier: "+923001234567" });
  assert.equal(text.status, 503);
  assert.equal(text.body.code, "SMS_NOT_CONFIGURED");

  const task = await request(app)
    .post("/api/tasks")
    .set(header)
    .set("Authorization", `Bearer ${ada.body.token}`)
    .send({ title: "Read one chapter", priority: "high" });
  assert.equal(task.status, 201);
  const tasks = await request(app).get("/api/tasks").set("Authorization", `Bearer ${ada.body.token}`);
  assert.equal(tasks.status, 200);
  assert.equal(tasks.body.tasks.length, 1);
  const hidden = await request(app).get("/api/tasks").set("Authorization", `Bearer ${bilal.body.token}`);
  assert.equal(hidden.body.tasks.length, 0);

  const guest = await request(app).get("/api/conversations");
  assert.equal(guest.status, 401);
});
