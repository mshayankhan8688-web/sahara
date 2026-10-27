import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { HttpError } from "../http.js";

type SessionPayload = { sub: string; ver: number };

export function signSession(userId: string, tokenVersion: number): string {
  return jwt.sign({ sub: userId, ver: tokenVersion }, config.jwtSecret, { expiresIn: "7d" });
}

export function readSession(token: string): SessionPayload {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === "string" || typeof payload.sub !== "string" || typeof payload.ver !== "number") {
      throw new HttpError(401, "Sign in again.", "UNAUTHENTICATED");
    }
    return { sub: payload.sub, ver: payload.ver };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "Sign in again.", "UNAUTHENTICATED");
  }
}

export function signPhoto(photoName: string): string {
  return jwt.sign({ photo: photoName }, config.jwtSecret, { expiresIn: "20m" });
}

export function readPhoto(token: string): string {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === "string" || typeof payload.photo !== "string") {
      throw new HttpError(400, "This photo link has expired.", "PHOTO_EXPIRED");
    }
    return payload.photo;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "This photo link has expired.", "PHOTO_EXPIRED");
  }
}
