import { parseAttachment, type ChatAttachment } from "../lib/attachment.js";
import { HttpError } from "../http.js";
import { Companion, professionalStyle } from "../models/Companion.js";
import { Conversation } from "../models/Conversation.js";
import { JournalEntry } from "../models/JournalEntry.js";
import { Message } from "../models/Message.js";
import { Preference } from "../models/Preference.js";
import { User } from "../models/User.js";
import { asObjectId } from "../lib/objectId.js";
import type { ChatMode } from "../lib/modes.js";
import { inferChatMode } from "../lib/modes.js";
import { extractOfficeText } from "../lib/officeText.js";
import { composeReply } from "./gemini.js";
import type { ReplyLanguage } from "../lib/replyLanguage.js";
import { titleFrom } from "../lib/titleFrom.js";
import type { PreferenceView, SearchStatus } from "./prompt.js";

export async function loadPreferences(userId: string): Promise<PreferenceView | null> {
  const doc = await Preference.findOne({ userId }).lean();
  if (!doc || !doc.personalizationEnabled) return null;
  return {
    favoriteCuisines: doc.favoriteCuisines,
    favoriteFoods: doc.favoriteFoods,
    dislikes: doc.dislikes,
    vegetarian: doc.vegetarian,
    vegan: doc.vegan,
    halal: doc.halal,
    allergies: doc.allergies,
    dietaryRestrictions: doc.dietaryRestrictions,
    budget: doc.budget,
    spiceLevel: doc.spiceLevel,
    personalizationEnabled: true,
  };
}

export async function createChatReply(input: {
  userId: string;
  conversationId?: string;
  companionId?: string;
  content: string;
  journalId?: string;
  attachment?: { name: string; mimeType: string; data: string };
  replyLanguage?: ReplyLanguage;
  mode?: ChatMode;
}) {
  const user = await User.findById(input.userId);
  if (!user) throw new HttpError(401, "Sign in again.", "UNAUTHENTICATED");

  let conversation = null;
  if (input.conversationId) {
    conversation = await Conversation.findOne({ _id: asObjectId(input.conversationId), userId: input.userId });
    if (!conversation) throw new HttpError(404, "That conversation was not found.", "NOT_FOUND");
  }

  const companionId = input.companionId ?? conversation?.companionId?.toString();
  const companion = companionId
    ? await Companion.findOne({ _id: asObjectId(companionId), userId: input.userId })
    : await Companion.findOne({ userId: input.userId, isDefault: true });
  if (!companion) throw new HttpError(400, "Choose a companion first.", "NO_COMPANION");
  if (companion.style.includes("Reply only in professional English.") || companion.style.includes("Match the language the person wrote: clear English")) {
    const stale = await Companion.find({
      userId: input.userId,
      $or: [{ style: /Reply only in professional English/ }, { style: /Match the language the person wrote: clear English/ }],
    });
    for (const item of stale) {
      item.style = professionalStyle(item.style);
      await item.save();
    }
    companion.style = professionalStyle(companion.style);
  }

  let attachment: ChatAttachment | undefined;
  let officeExtra = "";
  if (input.attachment) {
    const office = await extractOfficeText(input.attachment);
    if (office) {
      officeExtra = `\n\n---\nExtracted text from ${office.name}:\n${office.text}`;
    } else {
      attachment = parseAttachment(input.attachment);
    }
  }
  const spoken = input.content.trim();
  let latest = spoken || (attachment || officeExtra ? "I attached a file. Please read it." : "");
  if (!latest) throw new HttpError(400, "Write a message or attach a file.", "EMPTY_MESSAGE");
  latest += officeExtra;
  if (input.journalId) {
    const entry = await JournalEntry.findOne({ _id: asObjectId(input.journalId), userId: input.userId });
    if (!entry || !entry.content.trim()) throw new HttpError(404, "That journal entry was not found.", "NOT_FOUND");
    latest = `${latest}\n\n---\nShared journal entry:\n${entry.content.trim()}`;
  }

  const historyDocs = conversation
    ? await Message.find({ conversationId: conversation._id, userId: input.userId }).sort({ createdAt: 1 }).limit(20).lean()
    : [];
  const history = historyDocs.map((message) => ({
    sender: message.sender as "user" | "assistant",
    content: message.content,
  }));

  const status: SearchStatus = "not_requested";
  const mode: ChatMode = input.mode ?? inferChatMode(spoken || latest);

  const preferences = await loadPreferences(input.userId);
  const kind = "ai" as const;
  const content = await composeReply({
    companionName: companion.name,
    companionStyle: companion.style,
    preferences,
    history,
    latest,
    attachment,
    search: { status, results: [] },
    replyLanguage: input.replyLanguage,
    mode,
  });

  if (!conversation) {
    conversation = await Conversation.create({
      userId: input.userId,
      companionId: companion._id,
      title: titleFrom(spoken || attachment?.name || "New chat"),
    });
  } else if (history.length === 0) {
    conversation.title = titleFrom(spoken || attachment?.name || "New chat");
  }
  conversation.updatedAt = new Date();
  await conversation.save();

  const storedUserContent = (
    spoken ||
    (attachment || officeExtra ? `Attached ${attachment?.name ?? input.attachment?.name ?? "file"}` : "")
  ).slice(0, 4000);
  const userMessage = await Message.create({
    conversationId: conversation._id,
    userId: input.userId,
    sender: "user",
    kind: "ai",
    content: storedUserContent,
    attachment,
    places: [],
  });
  const assistantMessage = await Message.create({
    conversationId: conversation._id,
    userId: input.userId,
    sender: "assistant",
    kind,
    content,
    places: [],
  });

  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      companionId: companion.id,
      updatedAt: conversation.updatedAt,
    },
    userMessage: serializeMessage(userMessage),
    assistantMessage: serializeMessage(assistantMessage),
  };
}

function serializeMessage(message: {
  id?: string;
  _id: { toString(): string };
  sender: string;
  kind?: string;
  content: string;
  attachment?: { name?: string | null; mimeType?: string | null; data?: string | null } | null;
  places?: unknown;
  createdAt?: Date;
}) {
  const name = message.attachment?.name;
  const mimeType = message.attachment?.mimeType;
  const data = message.attachment?.data;
  const attachment = name && mimeType && data ? { name, mimeType, data } : undefined;
  return {
    id: message.id ?? message._id.toString(),
    sender: message.sender,
    kind: message.kind ?? "ai",
    content: message.content,
    attachment,
    places: Array.isArray(message.places) ? message.places : [],
    createdAt: message.createdAt,
  };
}
