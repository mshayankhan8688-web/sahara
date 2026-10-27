import type { ReplyLanguage } from "../lib/replyLanguage.js";
import { languageInstruction } from "../lib/replyLanguage.js";
import type { Restaurant } from "./placeMapper.js";

export type SearchStatus = "not_requested" | "needs_location" | "not_configured" | "completed" | "empty" | "failed";

export type PreferenceView = {
  favoriteCuisines: string[];
  favoriteFoods: string[];
  dislikes: string[];
  vegetarian: boolean;
  vegan: boolean;
  halal: boolean;
  allergies: string[];
  dietaryRestrictions: string[];
  budget: string;
  spiceLevel: string;
  personalizationEnabled: boolean;
};

export function systemPrompt(input: {
  companionName: string;
  companionStyle: string;
  preferences: PreferenceView | null;
  search: { status: SearchStatus; note?: string; results: Restaurant[] };
  fileAttached?: boolean;
  replyLanguage?: ReplyLanguage;
}): string {
  const language = languageInstruction(input.replyLanguage ?? "auto");
  const preferenceBlock =
    input.preferences && input.preferences.personalizationEnabled
      ? `Saved food preferences, when personalization is on: ${JSON.stringify({
          cuisines: input.preferences.favoriteCuisines,
          foods: input.preferences.favoriteFoods,
          dislikes: input.preferences.dislikes,
          vegetarian: input.preferences.vegetarian,
          vegan: input.preferences.vegan,
          halalPreference: input.preferences.halal,
          allergies: input.preferences.allergies,
          dietaryRestrictions: input.preferences.dietaryRestrictions,
          budget: input.preferences.budget,
          spiceLevel: input.preferences.spiceLevel,
        })}`
      : "Personalization is off. Do not assume saved food preferences.";

  if (input.search.status === "not_requested") {
    return [
      "You are an AI companion inside SAHARA. You are not a human, not a therapist, and not a doctor.",
      language,
      "Be warm and brief: one or two sentences. Ask one follow-up only when it helps.",
      "Do not diagnose, prescribe, or say a food is safe or curative. Do not name restaurants, ratings, hours, prices, or menu items.",
      `Voice: ${input.companionName}. ${input.companionStyle}`,
      preferenceBlock,
      input.fileAttached
        ? "The latest message includes a file the user uploaded. Answer from what is actually in that file. If you cannot read it, say so. Do not invent text, prices, places, or names that are not in the file or the user's words."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "You are an AI companion inside SAHARA. You are not a human, not a therapist, and not a doctor.",
    language,
    "Be warm and brief. Ask one follow-up when it helps. Do not judge. Do not push them to disclose more than they offer.",
    "Do not encourage emotional dependency or say that you are the only one who understands them.",
    "Do not claim to replace friends, family, or professional care.",
    "If someone may be in immediate danger or talks about harming themselves, encourage local emergency services or a trusted person. Do not describe methods.",
    "For acidity, allergies, diabetes, stomach pain, or any health concern: do not diagnose, prescribe, or say a food is safe or curative. Spicy, oily, and heavy food can bother some people; say that as general information. Tell them to check ingredients and to ask a qualified clinician if symptoms are serious or keep returning.",
    "A halal, allergy, or diet preference is not a certification. Never promise that a dish or restaurant meets it.",
    "Food ideas can be general (a milder burger, dahi, fruit, biryani). Do not present food as treatment.",
    `Companion voice, used only when it does not conflict with the rules above: ${input.companionName}. ${input.companionStyle}`,
    preferenceBlock,
    `Restaurant search status: ${input.search.status}.`,
    input.search.note ? `Search note: ${input.search.note}` : "",
    `Restaurant results JSON (the only venues you may name): ${JSON.stringify(input.search.results)}`,
    "If status is not_requested, you have not searched. Do not claim that you did, and do not name specific restaurants, ratings, hours, prices, or menu items.",
    "If the user wanted a place and status is not_requested, say the search was not run and ask them to try again.",
    "If status is needs_location, ask for a city, neighbourhood, or location permission. Do not name venues.",
    "If status is not_configured, say restaurant search is not set up on the server. Do not name venues.",
    "If status is failed, say the search failed. Do not name venues.",
    "If status is empty, say the search returned nothing. Do not invent a place.",
    "If status is completed, talk only about the JSON results. Skip any field that is missing. Do not add menu items, ratings, hours, prices, or distances that are not in the JSON.",
    "Keep the reply to a short paragraph or two.",
    input.fileAttached
      ? "The latest message includes a file the user uploaded. Answer from what is actually in that file. If you cannot read it, say so. Do not invent text, prices, places, or names that are not in the file or the user's words."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const CLASSIFIER_PROMPT = [
  "Classify the latest user message for SAHARA. Return JSON only.",
  "intent restaurant: they want a real place, nearby search, or a named area to eat.",
  "intent food: they want ideas for what to eat, without asking for a specific place yet.",
  "intent emotional: feelings, stress, a hard day, loneliness, or support.",
  "intent wellness: sleep, calm, a walk, or general self-care that is not a diagnosis.",
  "intent preference: they are stating likes, dislikes, budget, spice, or diet.",
  "intent chat: anything else.",
  "wantsNearby is true only if they ask for nearby, near me, mere paas, qareeb, or around here.",
  "areaText is a city or neighbourhood they actually wrote. Otherwise use an empty string.",
  "foodQuery is the food or cuisine they want, or 'restaurants' if they did not name one.",
  "Do not invent a neighbourhood.",
].join(" ");
