import { parseAttachment, type ChatAttachment } from "../lib/attachment.js";
import { HttpError } from "../http.js";
import { Companion, migrateCompanionStyleIfNeeded, professionalStyle } from "../models/Companion.js";
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

/** Avoid identical sidebar titles when possible (does not rename old chats). */
async function ensureUniqueTitle(userId: string, base: string, excludeId?: string): Promise<string> {
  const safe = base.slice(0, 80) || "New chat";
  const clash = async (title: string) => {
    const query: Record<string, unknown> = { userId: asObjectId(userId), title };
    if (excludeId) query._id = { $ne: asObjectId(excludeId) };
    return Boolean(await Conversation.exists(query));
  };
  if (!(await clash(safe))) return safe;
  for (let n = 2; n <= 9; n += 1) {
    const candidate = `${safe.slice(0, 74)} (${n})`;
    if (!(await clash(candidate))) return candidate;
  }
  return `${safe.slice(0, 70)}…`;
}

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
  regenerateOfMessageId?: string;
}) {
  const user = await User.findById(input.userId);
  if (!user) throw new HttpError(401, "Sign in again.", "UNAUTHENTICATED");

  let conversation = null;
  let regeneratingAssistantId: string | null = null;
  let existingUserMessage: Awaited<ReturnType<typeof Message.findOne>> = null;

  if (input.regenerateOfMessageId) {
    const oldAssistant = await Message.findOne({
      _id: asObjectId(input.regenerateOfMessageId),
      userId: input.userId,
      sender: "assistant",
      kind: "ai",
    });
    if (!oldAssistant) throw new HttpError(404, "That reply was not found.", "NOT_FOUND");
    conversation = await Conversation.findOne({ _id: oldAssistant.conversationId, userId: input.userId });
    if (!conversation) throw new HttpError(404, "That conversation was not found.", "NOT_FOUND");
    existingUserMessage = await Message.findOne({
      conversationId: conversation._id,
      userId: input.userId,
      sender: "user",
      createdAt: { $lte: oldAssistant.createdAt },
    }).sort({ createdAt: -1 });
    if (!existingUserMessage) throw new HttpError(400, "Nothing to regenerate.", "NO_USER_TURN");
    regeneratingAssistantId = oldAssistant._id.toString();
    await Message.deleteOne({ _id: oldAssistant._id, userId: input.userId });
  } else if (input.conversationId) {
    conversation = await Conversation.findOne({ _id: asObjectId(input.conversationId), userId: input.userId });
    if (!conversation) throw new HttpError(404, "That conversation was not found.", "NOT_FOUND");
  }

  const companionId = input.companionId ?? conversation?.companionId?.toString();
  const companion = companionId
    ? await Companion.findOne({ _id: asObjectId(companionId), userId: input.userId })
    : await Companion.findOne({ userId: input.userId, isDefault: true });
  if (!companion) throw new HttpError(400, "Choose a companion first.", "NO_COMPANION");
  // Soft-upgrade language rules + legacy default Safa voice. Does not touch Message/Conversation docs.
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
  const companionStyle = await migrateCompanionStyleIfNeeded(companion);

  let attachment: ChatAttachment | undefined;
  let officeExtra = "";
  if (input.attachment) {
    const office = await extractOfficeText(input.attachment);
    if (office) {
      officeExtra = `\n\n---\nExtracted text from ${office.name}:\n${office.text}`;
    } else {
      attachment = parseAttachment(input.attachment);
    }
  } else if (regeneratingAssistantId && existingUserMessage?.attachment?.data) {
    const stored = existingUserMessage.attachment;
    if (stored.name && stored.mimeType && stored.data) {
      const office = await extractOfficeText({ name: stored.name, mimeType: stored.mimeType, data: stored.data });
      if (office) {
        officeExtra = `\n\n---\nExtracted text from ${office.name}:\n${office.text}`;
      } else {
        attachment = parseAttachment({ name: stored.name, mimeType: stored.mimeType, data: stored.data });
      }
    }
  }

  const spoken = (input.content.trim() || (regeneratingAssistantId ? existingUserMessage?.content ?? "" : "")).trim();
  let latest = spoken || (attachment || officeExtra ? "I attached a file. Please read it." : "");
  if (!latest) throw new HttpError(400, "Write a message or attach a file.", "EMPTY_MESSAGE");
  latest += officeExtra;
  if (input.journalId && !regeneratingAssistantId) {
    const entry = await JournalEntry.findOne({ _id: asObjectId(input.journalId), userId: input.userId });
    if (!entry || !entry.content.trim()) throw new HttpError(404, "That journal entry was not found.", "NOT_FOUND");
    latest = `${latest}\n\n---\nShared journal entry:\n${entry.content.trim()}`;
  }

  const historyDocs = conversation
    ? await Message.find({ conversationId: conversation._id, userId: input.userId }).sort({ createdAt: 1 }).limit(20).lean()
    : [];
  // When regenerating, drop the trailing user turn from history — it is re-supplied as `latest`.
  const historySource =
    regeneratingAssistantId && historyDocs.length && historyDocs[historyDocs.length - 1]?.sender === "user"
      ? historyDocs.slice(0, -1)
      : historyDocs;
  const history = historySource.map((message) => ({
    sender: message.sender as "user" | "assistant",
    content: message.content,
  }));

  const status: SearchStatus = "not_requested";
  const mode: ChatMode = input.mode ?? inferChatMode(spoken || latest);

  const preferences = await loadPreferences(input.userId);
  const kind = "ai" as const;
  const content = await composeReply({
    companionName: companion.name,
    companionStyle,
    preferences,
    history,
    latest,
    attachment,
    search: { status, results: [] },
    replyLanguage: input.replyLanguage,
    mode,
  });

  const baseTitle = titleFrom(spoken || attachment?.name || "New chat");
  const uniqueTitle = await ensureUniqueTitle(input.userId, baseTitle, conversation?._id?.toString());
  if (!conversation) {
    conversation = await Conversation.create({
      userId: input.userId,
      companionId: companion._id,
      title: uniqueTitle,
    });
  } else if (historyDocs.length === 0 && !regeneratingAssistantId) {
    conversation.title = uniqueTitle;
  }
  conversation.updatedAt = new Date();
  await conversation.save();

  let userMessage = existingUserMessage;
  if (!regeneratingAssistantId) {
    const storedUserContent = (
      spoken ||
      (attachment || officeExtra ? `Attached ${attachment?.name ?? input.attachment?.name ?? "file"}` : "")
    ).slice(0, 4000);
    userMessage = await Message.create({
      conversationId: conversation._id,
      userId: input.userId,
      sender: "user",
      kind: "ai",
      content: storedUserContent,
      attachment,
      places: [],
    });
  }
  if (!userMessage) throw new HttpError(500, "Could not save the message.", "INTERNAL");

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
    replacedMessageId: regeneratingAssistantId ?? undefined,
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
