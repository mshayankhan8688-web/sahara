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

async function register(name: string, email: string) {
  const response = await request(app)
    .post("/api/auth/register")
    .set(header)
    .send({ name, email, password: "correct-horse" });
  assert.equal(response.status, 201);
  return response.body as { token: string; user: { id: string } };
}

async function seedConversation(userId: string, title: string) {
  const { Conversation } = await import("../models/Conversation.js");
  const { Message } = await import("../models/Message.js");
  const conversation = await Conversation.create({ userId, title });
  await Message.create({
    conversationId: conversation._id,
    userId,
    sender: "user",
    kind: "ai",
    content: `Hello from ${title}`,
  });
  await Message.create({
    conversationId: conversation._id,
    userId,
    sender: "assistant",
    kind: "ai",
    content: "Reply",
  });
  return conversation;
}

test("owner can delete a conversation and its messages permanently", async () => {
  const ada = await register("Ada Delete", `ada-del-${Date.now()}@example.com`);
  const conversation = await seedConversation(ada.user.id, "Keep me gone");

  const deleted = await request(app)
    .delete(`/api/conversations/${conversation._id.toString()}`)
    .set(header)
    .set("Authorization", `Bearer ${ada.token}`);
  assert.equal(deleted.status, 204);

  const { Conversation } = await import("../models/Conversation.js");
  const { Message } = await import("../models/Message.js");
  assert.equal(await Conversation.findById(conversation._id), null);
  assert.equal(await Message.countDocuments({ conversationId: conversation._id }), 0);

  const list = await request(app).get("/api/conversations").set("Authorization", `Bearer ${ada.token}`);
  assert.equal(list.status, 200);
  assert.equal(
    list.body.conversations.some((item: { id: string }) => item.id === conversation._id.toString()),
    false,
  );
});

test("deleting one chat preserves other chats for the same user", async () => {
  const ada = await register("Ada Keep", `ada-keep-${Date.now()}@example.com`);
  const keep = await seedConversation(ada.user.id, "Stay");
  const remove = await seedConversation(ada.user.id, "Remove");

  const deleted = await request(app)
    .delete(`/api/conversations/${remove._id.toString()}`)
    .set(header)
    .set("Authorization", `Bearer ${ada.token}`);
  assert.equal(deleted.status, 204);

  const list = await request(app).get("/api/conversations").set("Authorization", `Bearer ${ada.token}`);
  const ids = list.body.conversations.map((item: { id: string }) => item.id);
  assert.ok(ids.includes(keep._id.toString()));
  assert.equal(ids.includes(remove._id.toString()), false);
});

test("unauthorized delete is rejected", async () => {
  const ada = await register("Ada Auth", `ada-auth-${Date.now()}@example.com`);
  const conversation = await seedConversation(ada.user.id, "Protected");

  const anon = await request(app).delete(`/api/conversations/${conversation._id.toString()}`).set(header);
  assert.equal(anon.status, 401);

  const { Conversation } = await import("../models/Conversation.js");
  assert.ok(await Conversation.findById(conversation._id));
});

test("users cannot delete another user's conversation", async () => {
  const ada = await register("Ada Own", `ada-own-${Date.now()}@example.com`);
  const bilal = await register("Bilal Other", `bilal-own-${Date.now()}@example.com`);
  const conversation = await seedConversation(ada.user.id, "Ada private");

  const stolen = await request(app)
    .delete(`/api/conversations/${conversation._id.toString()}`)
    .set(header)
    .set("Authorization", `Bearer ${bilal.token}`);
  assert.equal(stolen.status, 404);
  assert.equal(stolen.body.code, "NOT_FOUND");

  const { Conversation } = await import("../models/Conversation.js");
  assert.ok(await Conversation.findById(conversation._id));
});

test("invalid and missing conversation ids return NOT_FOUND", async () => {
  const ada = await register("Ada Ids", `ada-ids-${Date.now()}@example.com`);

  const invalid = await request(app)
    .delete("/api/conversations/not-an-object-id")
    .set(header)
    .set("Authorization", `Bearer ${ada.token}`);
  assert.equal(invalid.status, 404);
  assert.equal(invalid.body.code, "NOT_FOUND");

  const missing = await request(app)
    .delete("/api/conversations/507f1f77bcf86cd799439011")
    .set(header)
    .set("Authorization", `Bearer ${ada.token}`);
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, "NOT_FOUND");
});

test("database deletion failure returns INTERNAL and keeps the conversation", async () => {
  const ada = await register("Ada Fail", `ada-fail-${Date.now()}@example.com`);
  const conversation = await seedConversation(ada.user.id, "Keep on failure");
  const { Conversation } = await import("../models/Conversation.js");
  const original = Conversation.findOneAndDelete;
  Conversation.findOneAndDelete = (() => {
    throw new Error("simulated delete failure");
  }) as unknown as typeof Conversation.findOneAndDelete;

  try {
    const failed = await request(app)
      .delete(`/api/conversations/${conversation._id.toString()}`)
      .set(header)
      .set("Authorization", `Bearer ${ada.token}`);
    assert.equal(failed.status, 500);
    assert.equal(failed.body.code, "INTERNAL");
    assert.ok(await Conversation.findById(conversation._id));
  } finally {
    Conversation.findOneAndDelete = original;
  }
});

test("deleted conversation stays gone after a fresh list fetch", async () => {
  const ada = await register("Ada Persist", `ada-persist-${Date.now()}@example.com`);
  const conversation = await seedConversation(ada.user.id, "Gone forever");

  const deleted = await request(app)
    .delete(`/api/conversations/${conversation._id.toString()}`)
    .set(header)
    .set("Authorization", `Bearer ${ada.token}`);
  assert.equal(deleted.status, 204);

  const again = await request(app).get("/api/conversations").set("Authorization", `Bearer ${ada.token}`);
  assert.equal(again.status, 200);
  assert.equal(
    again.body.conversations.some((item: { id: string }) => item.id === conversation._id.toString()),
    false,
  );
  const { Conversation } = await import("../models/Conversation.js");
  assert.equal(await Conversation.findById(conversation._id), null);
});
