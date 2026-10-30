import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import request from "supertest";
import type { Express } from "express";

let app: Express;
let memory: { stop: () => Promise<boolean> };
let consumeUsage: typeof import("../services/usage.js").consumeUsage;
let withUsage: typeof import("../services/usage.js").withUsage;
let getUsageSnapshot: typeof import("../services/usage.js").getUsageSnapshot;
let usageDayKey: typeof import("../lib/plans.js").usageDayKey;
let User: typeof import("../models/User.js").User;
let Usage: typeof import("../models/Usage.js").Usage;
let freeChatDaily: number;
let freeImageDaily: number;

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
  process.env.PAYMENTS_ENABLED = "false";
  const { connectDb } = await import("../db.js");
  await connectDb();
  const configMod = await import("../config.js");
  freeChatDaily = configMod.config.freeChatDaily;
  freeImageDaily = configMod.config.freeImageDaily;
  ({ consumeUsage, withUsage, getUsageSnapshot } = await import("../services/usage.js"));
  ({ usageDayKey } = await import("../lib/plans.js"));
  ({ User } = await import("../models/User.js"));
  ({ Usage } = await import("../models/Usage.js"));
  const { createApp } = await import("../app.js");
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  await memory.stop();
});

const header = { "x-heartspace-request": "1" };

test("billing plans are public and payments stay off", async () => {
  const plans = await request(app).get("/api/billing/plans");
  assert.equal(plans.status, 200);
  assert.equal(plans.body.paymentsConfigured, false);
  assert.equal(plans.body.currency, "PKR");
  assert.ok(Array.isArray(plans.body.plans));
  assert.equal(plans.body.plans.length, 2);
  const free = plans.body.plans.find((plan: { id: string }) => plan.id === "free");
  assert.equal(free.limits.chatDaily, freeChatDaily);
  assert.equal(free.monthlyPricePkr, null);
  const premium = plans.body.plans.find((plan: { id: string }) => plan.id === "premium");
  assert.equal(typeof premium.monthlyPricePkr, "number");
});

test("usage meter enforces daily limits and respects premium grant", async () => {
  const registered = await request(app)
    .post("/api/auth/register")
    .set(header)
    .send({ name: "Limit User", email: `limit-${Date.now()}@example.com`, password: "correct-horse" });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.user.planId, "free");
  const token = registered.body.token as string;
  const userId = registered.body.user.id as string;

  await Usage.findOneAndUpdate(
    { userId, day: usageDayKey() },
    {
      $set: {
        userId,
        day: usageDayKey(),
        chatCount: freeChatDaily,
        studioCount: 0,
        imageCount: freeImageDaily,
        diagramCount: 0,
      },
    },
    { upsert: true },
  );

  await assert.rejects(() => consumeUsage(userId, "chat"), (error: unknown) => {
    assert.ok(error && typeof error === "object" && "code" in error && "status" in error);
    assert.equal((error as { code?: string; status?: number }).code, "USAGE_LIMIT");
    assert.equal((error as { status?: number }).status, 429);
    return true;
  });

  await assert.rejects(() => consumeUsage(userId, "image"), (error: unknown) => {
    assert.equal((error as { code?: string }).code, "USAGE_LIMIT");
    return true;
  });

  const usage = await request(app).get("/api/billing/usage").set("Authorization", `Bearer ${token}`);
  assert.equal(usage.status, 200);
  assert.equal(usage.body.usage.planId, "free");
  assert.equal(usage.body.usage.buckets.find((b: { kind: string }) => b.kind === "chat").remaining, 0);

  await User.findByIdAndUpdate(userId, { planTier: "premium", planExpiresAt: null });
  const premiumUse = await consumeUsage(userId, "chat");
  assert.equal(premiumUse.planId, "premium");
  assert.ok((premiumUse.buckets.find((b) => b.kind === "chat")?.remaining ?? -1) >= 0);

  const status = await request(app).get("/api/billing/status").set("Authorization", `Bearer ${token}`);
  assert.equal(status.status, 200);
  assert.equal(status.body.planId, "premium");
  assert.equal(status.body.canCheckout, false);
  assert.equal(status.body.paymentsConfigured, false);
});

test("withUsage refunds the reserved unit when work fails", async () => {
  const registered = await request(app)
    .post("/api/auth/register")
    .set(header)
    .send({ name: "Refund User", email: `refund-${Date.now()}@example.com`, password: "correct-horse" });
  assert.equal(registered.status, 201);
  const userId = registered.body.user.id as string;

  const before = await getUsageSnapshot(userId);
  const chatBefore = before.buckets.find((bucket) => bucket.kind === "chat")?.used ?? 0;

  await assert.rejects(
    () =>
      withUsage(userId, "chat", async () => {
        throw new Error("simulated AI failure");
      }),
    /simulated AI failure/,
  );

  const after = await getUsageSnapshot(userId);
  assert.equal(after.buckets.find((bucket) => bucket.kind === "chat")?.used ?? -1, chatBefore);

  const ok = await withUsage(userId, "chat", async () => ({ ok: true }));
  assert.equal(ok.result.ok, true);
  assert.equal(ok.usage.buckets.find((bucket) => bucket.kind === "chat")?.used ?? -1, chatBefore + 1);
});
