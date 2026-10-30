/**
 * Seeds two conversations for a user id (argv[2]) against the local MONGODB_URI.
 * Prints JSON: { conversationId, otherId }
 */
import { readFileSync } from "node:fs";
import mongoose from "mongoose";

const userIdArg = process.argv[2];
if (!userIdArg || !mongoose.Types.ObjectId.isValid(userIdArg)) {
  console.error("usage: node --import tsx scripts/seed-chat-delete-e2e.mjs <userObjectId>");
  process.exit(1);
}

const envPath = new URL("../.env", import.meta.url);
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

await mongoose.connect(env.MONGODB_URI);
const userId = new mongoose.Types.ObjectId(userIdArg);
const conversations = mongoose.connection.collection("conversations");
const messages = mongoose.connection.collection("messages");

const active = await conversations.insertOne({
  userId,
  title: "Delete Active Chat",
  createdAt: new Date(),
  updatedAt: new Date(),
});
const other = await conversations.insertOne({
  userId,
  title: "Keep Other Chat",
  createdAt: new Date(),
  updatedAt: new Date(),
});

await messages.insertMany([
  {
    conversationId: active.insertedId,
    userId,
    sender: "user",
    kind: "ai",
    content: "Active chat body for delete e2e",
    places: [],
    createdAt: new Date(),
  },
  {
    conversationId: other.insertedId,
    userId,
    sender: "user",
    kind: "ai",
    content: "Other chat stays",
    places: [],
    createdAt: new Date(),
  },
]);

console.log(
  JSON.stringify({
    conversationId: active.insertedId.toString(),
    otherId: other.insertedId.toString(),
  }),
);
await mongoose.disconnect();
