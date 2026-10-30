import { Router } from "express";
import { asyncHandler, HttpError } from "../http.js";
import { asObjectId, routeParam } from "../lib/objectId.js";
import { favoriteSchema } from "../lib/schemas.js";
import { Favorite } from "../models/Favorite.js";
import { Message } from "../models/Message.js";
import { requireUser } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

export const favoriteRouter = Router();
favoriteRouter.use(requireUser);

favoriteRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = asObjectId(req.user!.id);
    const favorites = await Favorite.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({
      favorites: favorites.map((item) => ({
        id: item._id.toString(),
        messageId: item.messageId.toString(),
        conversationId: item.conversationId.toString(),
        content: item.content,
        createdAt: item.createdAt,
      })),
    });
  }),
);

favoriteRouter.post(
  "/",
  validateBody(favoriteSchema),
  asyncHandler(async (req, res) => {
    const userId = asObjectId(req.user!.id);
    const messageId = asObjectId(req.body.messageId);
    const conversationId = asObjectId(req.body.conversationId);
    const message = await Message.findOne({
      _id: messageId,
      conversationId,
      userId,
      sender: "assistant",
      kind: "ai",
    }).lean();
    if (!message) throw new HttpError(404, "That reply was not found.", "NOT_FOUND");

    const content = String(req.body.content || message.content).trim().slice(0, 4000);
    const favorite = await Favorite.findOneAndUpdate(
      { userId, messageId },
      { $set: { conversationId, content } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    if (!favorite) throw new HttpError(500, "Could not save that favorite.", "INTERNAL");

    const count = await Favorite.countDocuments({ userId });
    if (count > 50) {
      const oldest = await Favorite.find({ userId }).sort({ createdAt: 1 }).limit(count - 50).select("_id").lean();
      if (oldest.length) {
        await Favorite.deleteMany({ _id: { $in: oldest.map((row) => row._id) }, userId });
      }
    }

    res.status(201).json({
      favorite: {
        id: favorite._id.toString(),
        messageId: favorite.messageId.toString(),
        conversationId: favorite.conversationId.toString(),
        content: favorite.content,
        createdAt: favorite.createdAt,
      },
    });
  }),
);

favoriteRouter.delete(
  "/:messageId",
  asyncHandler(async (req, res) => {
    const userId = asObjectId(req.user!.id);
    const messageId = asObjectId(routeParam(req.params.messageId));
    await Favorite.deleteOne({ userId, messageId });
    res.status(204).end();
  }),
);
