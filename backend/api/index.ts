import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../src/app.js";
import { connectDb } from "../src/db.js";

const app = createApp();
let connecting: Promise<void> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!connecting) {
    connecting = connectDb().catch((error: unknown) => {
      connecting = undefined;
      throw error;
    });
  }
  await connecting;
  app(req, res);
}
