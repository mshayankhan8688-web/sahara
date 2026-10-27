import { parseAttachment, type ChatAttachment } from "../lib/attachment.js";
import { HttpError } from "../http.js";
import { Companion, professionalStyle } from "../models/Companion.js";
import { Conversation } from "../models/Conversation.js";
import { JournalEntry } from "../models/JournalEntry.js";
import { Message } from "../models/Message.js";
import { Preference } from "../models/Preference.js";
import { User } from "../models/User.js";
import { asObjectId } from "../lib/objectId.js";
import { signPhoto } from "../lib/tokens.js";
import { classifyIntent, composeReply, type Intent } from "./gemini.js";
import { searchRestaurants } from "./places.js";
import type { Restaurant } from "./placeMapper.js";
import type { ReplyLanguage } from "../lib/replyLanguage.js";
import type { PreferenceView, SearchStatus } from "./prompt.js";

type LocationInput = { latitude?: number; longitude?: number; useSaved?: boolean };

function titleFrom(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean.length <= 48) return clean || "New chat";
  return `${clean.slice(0, 48).trimEnd()}…`;
}

function mentioned(corpus: string, area: string): boolean {
  const needle = area.trim().toLowerCase();
  return needle.length >= 2 && corpus.toLowerCase().includes(needle);
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
  location?: LocationInput;
  replyLanguage?: ReplyLanguage;
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

  const attachment: ChatAttachment | undefined = input.attachment ? parseAttachment(input.attachment) : undefined;
  const spoken = input.content.trim();
  let latest = spoken || (attachment ? "I attached a file. Please read it." : "");
  if (!latest) throw new HttpError(400, "Write a message or attach a file.", "EMPTY_MESSAGE");
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

  const transcript = [...history, { sender: "user" as const, content: latest }]
    .slice(-6)
    .map((message) => `${message.sender}: ${message.content}`)
    .join("\n");

  let intent: Intent = { intent: "chat", foodQuery: "", areaText: "", wantsNearby: false, openNow: false };
  const mayWantAPlace =
    /restaurant|nearby|near me|\baround\b|qareeb|\bpaas\b|cafe|coffee|burger|pizza|biryani|khana|khaana|khane|\bbhook\b|hungry|dinner|lunch|breakfast|nashta|\bmenu\b|delivery|halal|\bfood\b|\beat\b/i.test(
      latest,
    );
  try {
    if (mayWantAPlace) intent = await classifyIntent(transcript);
  } catch (error) {
    if (error instanceof HttpError && error.code === "AI_NOT_CONFIGURED") throw error;
    console.error("Intent classification failed", error);
    intent = { intent: "chat", foodQuery: "", areaText: "", wantsNearby: false, openNow: false };
  }

  const corpus = transcript;
  const area = intent.areaText && mentioned(corpus, intent.areaText) ? intent.areaText.trim() : undefined;
  const wantsPlace = intent.intent === "restaurant" || (intent.intent === "food" && intent.wantsNearby);
  const saved = user.savedLocation;
  const shared =
    input.location && typeof input.location.latitude === "number" && typeof input.location.longitude === "number"
      ? { latitude: input.location.latitude, longitude: input.location.longitude }
      : undefined;
  const savedCoords =
    input.location?.useSaved && typeof saved?.latitude === "number" && typeof saved.longitude === "number"
      ? { latitude: saved.latitude, longitude: saved.longitude }
      : undefined;
  const origin = shared ?? savedCoords;
  const savedArea = input.location?.useSaved && saved?.label ? saved.label : undefined;

  let status: SearchStatus = "not_requested";
  let note: string | undefined;
  let results: Restaurant[] = [];
  let distanceNote: string | undefined;

  if (wantsPlace) {
    const searchArea = area ?? (!origin ? savedArea : undefined);
    if (!origin && !searchArea) {
      status = "needs_location";
      note = "No city or coordinates were available for this turn.";
    } else {
      try {
        const found = await searchRestaurants({
          query: intent.foodQuery || "restaurants",
          latitude: origin?.latitude,
          longitude: origin?.longitude,
          area: searchArea,
          minRating: intent.minRating,
          price: intent.price,
          openNow: intent.openNow,
        });
        results = found.results;
        distanceNote = found.distanceNote;
        status = results.length > 0 ? "completed" : "empty";
      } catch (error) {
        console.error("Chat restaurant search failed", error);
        status = error instanceof HttpError && error.code === "PLACES_NOT_CONFIGURED" ? "not_configured" : "failed";
        note = error instanceof HttpError ? error.message : "Restaurant search failed.";
      }
    }
  }

  const preferences = await loadPreferences(input.userId);
  let kind: "ai" | "notice" = "ai";
  let content: string;
  try {
    content = await composeReply({
      companionName: companion.name,
      companionStyle: companion.style,
      preferences,
      history,
      latest,
      attachment,
      search: { status, note, results },
      replyLanguage: input.replyLanguage,
    });
  } catch (error) {
    if (status === "completed" || status === "empty") {
      kind = "notice";
      content = "The AI explanation didn't come back. The places below are from the restaurant search and were not written by the model.";
    } else {
      throw error;
    }
  }

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

  const userMessage = await Message.create({
    conversationId: conversation._id,
    userId: input.userId,
    sender: "user",
    kind: "ai",
    content: spoken ? latest : `Attached ${attachment?.name ?? "file"}`,
    attachment,
    places: [],
  });
  const assistantMessage = await Message.create({
    conversationId: conversation._id,
    userId: input.userId,
    sender: "assistant",
    kind,
    content,
    places: results,
  });

  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      companionId: companion.id,
      updatedAt: conversation.updatedAt,
    },
    userMessage: serializeMessage(userMessage),
    assistantMessage: {
      ...serializeMessage(assistantMessage),
      places: results.map((place) => ({ ...place, photoToken: place.photoName ? signPhoto(place.photoName) : undefined })),
      distanceNote,
    },
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
