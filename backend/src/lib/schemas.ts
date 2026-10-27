import { z } from "zod";
import { replyLanguages } from "./replyLanguage.js";

const list = z.array(z.string().trim().min(1).max(40)).max(20);

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Use at least 2 characters.").max(60),
    email: z.string().trim().email("Enter a valid email.").max(120).optional(),
    phone: z.string().trim().min(8, "Enter a valid phone number.").max(20).optional(),
    password: z.string().min(8, "Use at least 8 characters.").max(72),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Enter an email or a phone number.",
    path: ["email"],
  });

export const forgotSchema = z.object({
  identifier: z.string().trim().min(3, "Enter the email or phone number on the account.").max(120),
});

export const resetSchema = z.object({
  identifier: z.string().trim().min(3).max(120),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
  password: z.string().min(8, "Use at least 8 characters.").max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().min(3, "Enter your email or phone number.").max(120),
  password: z.string().min(1, "Enter your password."),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.union([z.string().trim().email("Enter a valid email.").max(120), z.literal("")]),
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  nextPassword: z.string().min(8, "Use at least 8 characters.").max(72),
});

export const deleteSchema = z.object({
  password: z.string().min(1),
  confirm: z.literal("DELETE", { errorMap: () => ({ message: "Type DELETE to confirm." }) }),
});

export const locationSchema = z
  .object({
    label: z.string().trim().min(2).max(80),
    latitude: z.number().gte(-90).lte(90).optional(),
    longitude: z.number().gte(-180).lte(180).optional(),
    savePrecise: z.boolean(),
  })
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
    message: "Send latitude and longitude together.",
  })
  .refine((value) => !value.savePrecise || value.latitude !== undefined, {
    message: "Precise location needs coordinates.",
  });

export const companionSchema = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(400).default(""),
  style: z.string().trim().min(10, "Describe how they should speak.").max(800),
});

export const chatSchema = z
  .object({
    conversationId: z.string().trim().optional(),
    companionId: z.string().trim().optional(),
    content: z.string().trim().max(4000).default(""),
    journalId: z.string().trim().optional(),
    attachment: z
      .object({
        name: z.string().trim().min(1).max(120),
        mimeType: z.string().trim().min(1).max(80),
        data: z.string().trim().min(1).max(4_200_000),
      })
      .optional(),
    location: z
      .object({
        latitude: z.number().gte(-90).lte(90).optional(),
        longitude: z.number().gte(-180).lte(180).optional(),
        useSaved: z.boolean().optional(),
      })
      .optional(),
    replyLanguage: z.enum(replyLanguages).default("auto"),
  })
  .refine((value) => value.content.length > 0 || Boolean(value.attachment), {
    message: "Write a message or attach a file.",
    path: ["content"],
  });

export const foodSchema = z.object({
  note: z.string().trim().min(1).max(500),
  replyLanguage: z.enum(replyLanguages).default("auto"),
});

export const geocodeSchema = z.object({
  query: z.string().trim().min(1, "Type a city or area.").max(80),
});

export const reverseSchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
});

export const searchSchema = z.object({
  query: z.string().trim().min(1, "Say what you want to eat.").max(120),
  area: z.string().trim().max(80).optional(),
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  useSaved: z.boolean().optional(),
  minRating: z.number().gte(0).lte(5).optional(),
  price: z.enum(["inexpensive", "moderate", "expensive", "very_expensive"]).optional(),
  openNow: z.boolean().optional(),
  category: z.enum(["food", "cafe", "pharmacy", "grocery", "shop"]).optional(),
});

export const journalSchema = z.object({
  content: z.string().max(8000).default(""),
  moodTag: z.string().trim().max(40).default(""),
  status: z.enum(["draft", "saved"]),
});

export const preferenceSchema = z.object({
  favoriteCuisines: list.default([]),
  favoriteFoods: list.default([]),
  dislikes: list.default([]),
  vegetarian: z.boolean().default(false),
  vegan: z.boolean().default(false),
  halal: z.boolean().default(false),
  allergies: list.default([]),
  dietaryRestrictions: list.default([]),
  budget: z.enum(["any", "low", "medium", "high"]).default("any"),
  spiceLevel: z.enum(["any", "mild", "medium", "hot"]).default("any"),
  personalizationEnabled: z.boolean().default(true),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Write the task.").max(140),
  notes: z.string().trim().max(1000).default(""),
  dueOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-26.").or(z.literal("")).default(""),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

export const taskPatchSchema = taskSchema.partial().extend({
  done: z.boolean().optional(),
});

export const guideSchema = z.object({
  kind: z.enum(["study", "career", "day"]),
  prompt: z.string().trim().min(2, "Say what you need.").max(4000),
  replyLanguage: z.enum(replyLanguages).default("auto"),
});

export const planSchema = z.object({
  kind: z.enum(["study", "career", "day"]),
  title: z.string().trim().min(2).max(120),
  content: z.string().trim().min(1).max(8000),
});

export const feedbackCategories = ["General", "AI Chat", "Location", "Restaurant Search", "Voice", "Design", "Other"] as const;

export const feedbackBodySchema = z.object({
  rating: z.number().int().min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5."),
  category: z.enum(feedbackCategories, { message: "Choose a feedback category." }),
  comment: z.string().trim().min(8, "Write at least 8 characters.").max(2000, "Keep feedback under 2,000 characters."),
  email: z.union([z.string().trim().email("Enter a valid email, or leave it blank.").max(120), z.literal("")]).optional(),
  company: z.literal("").optional(),
});
