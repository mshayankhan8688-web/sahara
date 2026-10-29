import type { IncomingMessage, ServerResponse } from "node:http";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { connectDb } from "../src/db.js";

const app = createApp();
let connecting: Promise<void> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (mongoose.connection.readyState !== 1) {
    connecting ??= connectDb().finally(() => {
      connecting = undefined;
    });
    await connecting;
  }
  app(req, res);
}
