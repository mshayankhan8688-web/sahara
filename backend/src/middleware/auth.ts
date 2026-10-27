import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../http.js";
import { readSession } from "../lib/tokens.js";
import { User } from "../models/User.js";

export async function requireUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.get("authorization");
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const token = bearer || req.cookies?.heartspace_session;
    if (!token || typeof token !== "string") throw new HttpError(401, "Sign in to continue.", "UNAUTHENTICATED");
    const session = readSession(token);
    const user = await User.findById(session.sub).select("_id tokenVersion");
    if (!user || user.tokenVersion !== session.ver) throw new HttpError(401, "Sign in again.", "UNAUTHENTICATED");
    req.user = { id: user.id, tokenVersion: user.tokenVersion };
    next();
  } catch (error) {
    next(error);
  }
}
