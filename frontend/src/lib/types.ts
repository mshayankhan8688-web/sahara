export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  createdAt: string;
  savedLocation: { label: string; hasCoordinates: boolean } | null;
};

export type Companion = {
  id: string;
  name: string;
  description: string;
  style: string;
  isDefault: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  companionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlaceMatch = {
  label: string;
  latitude: number;
  longitude: number;
  kind?: string;
};

export type Restaurant = {
  id: string;
  name: string;
  address?: string;
  distanceKm?: number;
  rating?: number;
  ratingCount?: number;
  priceLabel?: string;
  openNow?: boolean;
  weekdayHours?: string[];
  website?: string;
  mapsUrl?: string;
  photoToken?: string;
  photoCredit?: string;
  primaryType?: string;
  servesVegetarianFood?: boolean;
  summary?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
};

export type Task = {
  id: string;
  title: string;
  notes: string;
  dueOn: string;
  priority: "low" | "medium" | "high";
  done: boolean;
  createdAt: string;
};

export type SavedPlan = {
  id: string;
  kind: "study" | "career" | "day";
  title: string;
  content: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  sender: "user" | "assistant";
  kind: "ai" | "notice";
  content: string;
  attachment?: { name: string; mimeType: string; data: string };
  places: Restaurant[];
  createdAt: string;
};

export type JournalEntry = {
  id: string;
  content: string;
  moodTag: string;
  status: "draft" | "saved";
  createdAt: string;
  updatedAt: string;
};

export type Preferences = {
  favoriteCuisines: string[];
  favoriteFoods: string[];
  dislikes: string[];
  vegetarian: boolean;
  vegan: boolean;
  halal: boolean;
  allergies: string[];
  dietaryRestrictions: string[];
  budget: "any" | "low" | "medium" | "high";
  spiceLevel: "any" | "mild" | "medium" | "hot";
  personalizationEnabled: boolean;
  saved: boolean;
};

export type Health = {
  ok: boolean;
  database: string;
  aiConfigured: boolean;
  placesConfigured: boolean;
};
