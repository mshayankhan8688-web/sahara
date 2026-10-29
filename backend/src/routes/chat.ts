import { Router } from "express";
import { createChatReply } from "../services/chat.js";
import { asyncHandler, HttpError } from "../http.js";
import { asObjectId, routeParam } from "../lib/objectId.js";
import { chatSchema, conversationTitleSchema } from "../lib/schemas.js";
import { signPhoto } from "../lib/tokens.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { requireUser } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/limits.js";
import { validateBody } from "../middleware/validate.js";
import { consumeUsage } from "../services/usage.js";

export const conversationRouter = Router();
conversationRouter.use(requireUser);

conversationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const conversations = await Conversation.find({ userId: req.user!.id }).sort({ updatedAt: -1 }).limit(100).lean();
    const ids = conversations.map((conversation) => conversation._id);
    const previews = ids.length
      ? await Message.aggregate<{ _id: { toString(): string }; content: string }>([
          { $match: { conversationId: { $in: ids }, userId: asObjectId(req.user!.id) } },
          { $sort: { createdAt: -1 } },
          { $group: { _id: "$conversationId", content: { $first: "$content" } } },
        ])
      : [];
    const previewById = new Map(previews.map((row) => [row._id.toString(), row.content]));
    res.json({
      conversations: conversations.map((conversation) => {
        const preview = previewById.get(conversation._id.toString()) ?? "";
        return {
          id: conversation._id.toString(),
          title: conversation.title,
          companionId: conversation.companionId?.toString() ?? null,
          preview: preview.replace(/\s+/g, " ").trim().slice(0, 80),
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        };
      }),
    });
  }),
);

conversationRouter.patch(
  "/:id",
  validateBody(conversationTitleSchema),
  asyncHandler(async (req, res) => {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: asObjectId(routeParam(req.params.id)), userId: req.user!.id },
      { $set: { title: req.body.title } },
      { new: true },
    ).lean();
    if (!conversation) throw new HttpError(404, "That conversation was not found.", "NOT_FOUND");
    res.json({
      conversation: {
        id: conversation._id.toString(),
        title: conversation.title,
        companionId: conversation.companionId?.toString() ?? null,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  }),
);

conversationRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const conversation = await Conversation.findOne({ _id: asObjectId(routeParam(req.params.id)), userId: req.user!.id }).lean();
    if (!conversation) throw new HttpError(404, "That conversation was not found.", "NOT_FOUND");
    const messages = await Message.find({ conversationId: conversation._id, userId: req.user!.id }).sort({ createdAt: 1 }).lean();
    res.json({
      conversation: {
        id: conversation._id.toString(),
        title: conversation.title,
        companionId: conversation.companionId?.toString() ?? null,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: messages.map((message) => ({
        id: message._id.toString(),
        sender: message.sender,
        kind: message.kind ?? "ai",
        content: message.content,
        attachment:
          message.attachment?.name && message.attachment.mimeType && message.attachment.data
            ? { name: message.attachment.name, mimeType: message.attachment.mimeType, data: message.attachment.data }
            : undefined,
        places: Array.isArray(message.places)
          ? message.places.map((place) => {
              if (!place || typeof place !== "object") return place;
              const photoName = "photoName" in place && typeof place.photoName === "string" ? place.photoName : undefined;
              return { ...place, photoToken: photoName ? signPhoto(photoName) : undefined };
            })
          : [],
        createdAt: message.createdAt,
      })),
    });
  }),
);

conversationRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const conversation = await Conversation.findOneAndDelete({ _id: asObjectId(routeParam(req.params.id)), userId: req.user!.id });
    if (!conversation) throw new HttpError(404, "That conversation was not found.", "NOT_FOUND");
    await Message.deleteMany({ conversationId: conversation._id, userId: req.user!.id });
    res.status(204).end();
  }),
);

export const messageRouter = Router();
messageRouter.use(requireUser);

messageRouter.post(
  "/message",
  chatLimiter,
  validateBody(chatSchema),
  asyncHandler(async (req, res) => {
    const usage = await consumeUsage(req.user!.id, "chat");
    const result = await createChatReply({ userId: req.user!.id, ...req.body });
    res.json({ ...result, usage });
  }),
);
