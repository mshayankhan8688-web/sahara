import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { config } from "../config.js";
import { asyncHandler, HttpError } from "../http.js";
import { normalizePhone, readIdentifier } from "../lib/contact.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { signSession } from "../lib/tokens.js";
import { Companion, DEFAULT_COMPANION } from "../models/Companion.js";
import { Feedback } from "../models/Feedback.js";
import { Conversation } from "../models/Conversation.js";
import { JournalEntry } from "../models/JournalEntry.js";
import { Message } from "../models/Message.js";
import { PasswordReset } from "../models/PasswordReset.js";
import { Plan } from "../models/Plan.js";
import { Task } from "../models/Task.js";
import { Preference } from "../models/Preference.js";
import { User } from "../models/User.js";
import { requireUser } from "../middleware/auth.js";
import { authLimiter } from "../middleware/limits.js";
import { validateBody } from "../middleware/validate.js";
import { deleteSchema, forgotSchema, locationSchema, loginSchema, passwordSchema, profileSchema, registerSchema, resetSchema } from "../lib/schemas.js";
import { sendResetCode } from "../services/resetDelivery.js";

export const authRouter = Router();

function publicUser(user: {
  id?: string;
  _id: { toString(): string };
  name: string;
  email?: string | null;
  phone?: string | null;
  createdAt?: Date;
  savedLocation?: { label?: string | null; latitude?: number | null; longitude?: number | null } | null;
}) {
  const location = user.savedLocation?.label
    ? { label: user.savedLocation.label, hasCoordinates: typeof user.savedLocation.latitude === "number" }
    : null;
  return {
    id: user.id ?? user._id.toString(),
    name: user.name,
    email: user.email ?? "",
    phone: user.phone ?? null,
    createdAt: user.createdAt,
    savedLocation: location,
  };
}

function sendSession(res: import("express").Response, userId: string, tokenVersion: number) {
  const token = signSession(userId, tokenVersion);
  res.cookie("heartspace_session", token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  return token;
}

authRouter.post(
  "/register",
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const email = typeof req.body.email === "string" ? req.body.email.toLowerCase() : undefined;
    const phone = typeof req.body.phone === "string" ? normalizePhone(req.body.phone) : undefined;
    if (req.body.phone && !phone) throw new HttpError(400, "Enter a valid phone number.", "INVALID_PHONE");
    if (email && (await User.findOne({ email }))) {
      throw new HttpError(409, "An account with that email already exists.", "EMAIL_TAKEN");
    }
    if (phone && (await User.findOne({ phone }))) {
      throw new HttpError(409, "An account with that phone number already exists.", "PHONE_TAKEN");
    }
    const user = await User.create({
      name: req.body.name,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      passwordHash: await hashPassword(req.body.password),
    });
    await Companion.create({ userId: user._id, ...DEFAULT_COMPANION, isDefault: true });
    const token = sendSession(res, user.id, user.tokenVersion);
    res.status(201).json({ user: publicUser(user), token });
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const identifier = readIdentifier(req.body.email);
    const user = identifier
      ? identifier.channel === "email"
        ? await User.findOne({ email: identifier.destination })
        : await User.findOne({ phone: identifier.destination })
      : null;
    if (!user || !(await verifyPassword(req.body.password, user.passwordHash))) {
      throw new HttpError(401, "Email, phone, or password is incorrect.", "INVALID_LOGIN");
    }
    const token = sendSession(res, user.id, user.tokenVersion);
    res.json({ user: publicUser(user), token });
  }),
);

function hashCode(code: string): string {
  return createHash("sha256").update(`${config.jwtSecret}:${code}`).digest("hex");
}

function sameCode(stored: string, given: string): boolean {
  const left = Buffer.from(stored);
  const right = Buffer.from(given);
  return left.length === right.length && timingSafeEqual(left, right);
}

authRouter.post(
  "/forgot",
  authLimiter,
  validateBody(forgotSchema),
  asyncHandler(async (req, res) => {
    const identifier = readIdentifier(req.body.identifier);
    if (!identifier) throw new HttpError(400, "Enter a valid email or phone number.", "INVALID_IDENTIFIER");
    const user =
      identifier.channel === "email"
        ? await User.findOne({ email: identifier.destination })
        : await User.findOne({ phone: identifier.destination });
    const sent = identifier.channel === "email"
      ? "If that email has an account, the code is on its way."
      : "If that phone number has an account, the code is on its way.";
    if (!user) {
      res.json({ message: sent, channel: identifier.channel });
      return;
    }
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await PasswordReset.deleteMany({ userId: user._id });
    await PasswordReset.create({
      userId: user._id,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    try {
      await sendResetCode(identifier.channel, identifier.destination, code);
    } catch (error) {
      await PasswordReset.deleteMany({ userId: user._id });
      throw error;
    }
    res.json({ message: sent, channel: identifier.channel });
  }),
);

authRouter.post(
  "/reset",
  authLimiter,
  validateBody(resetSchema),
  asyncHandler(async (req, res) => {
    const identifier = readIdentifier(req.body.identifier);
    if (!identifier) throw new HttpError(400, "Enter a valid email or phone number.", "INVALID_IDENTIFIER");
    const user =
      identifier.channel === "email"
        ? await User.findOne({ email: identifier.destination })
        : await User.findOne({ phone: identifier.destination });
    const reset = user
      ? await PasswordReset.findOne({ userId: user._id, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 })
      : null;
    if (!user || !reset || reset.attempts >= 5 || !sameCode(reset.codeHash, hashCode(req.body.code))) {
      if (reset && reset.attempts < 5) {
        reset.attempts += 1;
        if (reset.attempts >= 5) await reset.deleteOne();
        else await reset.save();
      }
      throw new HttpError(400, "That code is incorrect or expired.", "INVALID_CODE");
    }
    user.passwordHash = await hashPassword(req.body.password);
    user.tokenVersion += 1;
    await user.save();
    await PasswordReset.deleteMany({ userId: user._id });
    res.json({ message: "Password updated. You can log in." });
  }),
);

authRouter.post(
  "/logout",
  requireUser,
  asyncHandler(async (req, res) => {
    await User.updateOne({ _id: req.user!.id }, { $inc: { tokenVersion: 1 } });
    res.clearCookie("heartspace_session", { path: "/" });
    res.status(204).end();
  }),
);

authRouter.get(
  "/me",
  requireUser,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw new HttpError(401, "Sign in again.", "UNAUTHENTICATED");
    res.json({ user: publicUser(user) });
  }),
);

authRouter.patch(
  "/me",
  requireUser,
  validateBody(profileSchema),
  asyncHandler(async (req, res) => {
    const email = req.body.email.toLowerCase();
    const current = await User.findById(req.user!.id);
    if (!current) throw new HttpError(401, "Sign in again.", "UNAUTHENTICATED");
    if (!email && !current.phone) throw new HttpError(400, "Enter an email or keep a phone number on the account.", "CONTACT_REQUIRED");
    if (email) {
      const taken = await User.findOne({ email, _id: { $ne: current._id } });
      if (taken) throw new HttpError(409, "An account with that email already exists.", "EMAIL_TAKEN");
      current.email = email;
    } else {
      current.set("email", undefined);
    }
    current.name = req.body.name;
    await current.save();
    res.json({ user: publicUser(current) });
  }),
);

authRouter.post(
  "/password",
  requireUser,
  validateBody(passwordSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user || !(await verifyPassword(req.body.currentPassword, user.passwordHash))) {
      throw new HttpError(400, "Current password is incorrect.", "INVALID_PASSWORD");
    }
    user.passwordHash = await hashPassword(req.body.nextPassword);
    user.tokenVersion += 1;
    await user.save();
    const token = sendSession(res, user.id, user.tokenVersion);
    res.json({ token });
  }),
);

authRouter.put(
  "/location",
  requireUser,
  validateBody(locationSchema),
  asyncHandler(async (req, res) => {
    const savedLocation = req.body.savePrecise
      ? { label: req.body.label, latitude: req.body.latitude, longitude: req.body.longitude }
      : { label: req.body.label };
    const user = await User.findByIdAndUpdate(req.user!.id, { savedLocation }, { new: true });
    if (!user) throw new HttpError(401, "Sign in again.", "UNAUTHENTICATED");
    res.json({ user: publicUser(user) });
  }),
);

authRouter.delete(
  "/location",
  requireUser,
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.user!.id, { savedLocation: null }, { new: true });
    if (!user) throw new HttpError(401, "Sign in again.", "UNAUTHENTICATED");
    res.json({ user: publicUser(user) });
  }),
);

authRouter.delete(
  "/account",
  requireUser,
  validateBody(deleteSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user || !(await verifyPassword(req.body.password, user.passwordHash))) {
      throw new HttpError(400, "Password is incorrect.", "INVALID_PASSWORD");
    }
    const userId = user._id;
    await Message.deleteMany({ userId });
    await Conversation.deleteMany({ userId });
    await JournalEntry.deleteMany({ userId });
    await Preference.deleteMany({ userId });
    await Companion.deleteMany({ userId });
    await PasswordReset.deleteMany({ userId });
    await Task.deleteMany({ userId });
    await Plan.deleteMany({ userId });
    await Feedback.deleteMany({ userId });
    await user.deleteOne();
    res.clearCookie("heartspace_session", { path: "/" });
    res.status(204).end();
  }),
);
