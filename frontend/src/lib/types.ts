export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  createdAt: string;
  planId?: "free" | "premium";
  planExpiresAt?: string | null;
  avatar?: { mimeType: string; data: string } | null;
};

export type UsageBucket = {
  kind: "chat" | "studio" | "image" | "diagram";
  used: number;
  limit: number;
  remaining: number;
};

export type UsageSnapshot = {
  planId: "free" | "premium";
  planName: string;
  day: string;
  resetsAt: string;
  paymentsConfigured: boolean;
  buckets: UsageBucket[];
};

export type BillingPlan = {
  id: "free" | "premium";
  name: string;
  description: string;
  monthlyPricePkr: number | null;
  annualPricePkr: number | null;
  limits: {
    chatDaily: number;
    studioDaily: number;
    imageDaily: number;
    diagramDaily: number;
  };
  features: string[];
  premiumOnly: boolean;
};

export type BillingPlansResponse = {
  currency: string;
  paymentsConfigured: boolean;
  paymentNotice: string;
  plans: BillingPlan[];
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
  preview?: string;
  createdAt: string;
  updatedAt: string;
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
  placesConfigured?: boolean;
  paymentsConfigured?: boolean;
};
