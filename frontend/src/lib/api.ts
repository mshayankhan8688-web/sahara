import type { ChatMessage, Companion, Conversation, Health, JournalEntry, PlaceMatch, Preferences, Restaurant, SavedPlan, Task, User } from "@/lib/types";

const TOKEN_KEY = "heartspace.token";

export function apiBase(): string {
  return (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
}

export function authToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = apiBase();
  if (!base) {
    throw new ApiError("The SAHARA API address is missing. Set VITE_API_URL and rebuild the site.", 0, "API_URL_MISSING");
  }
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  headers.set("X-HeartSpace-Request", "1");
  const token = authToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, headers, credentials: "include" });
  } catch (error) {
    console.error("HeartSpace API unreachable", error);
    throw new ApiError("Could not reach SAHARA. Check your connection and try again.", 0, "NETWORK");
  }

  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
  if (!response.ok) {
    throw new ApiError(body?.message ?? "The request failed.", response.status, body?.code);
  }
  return body as T;
}

export const api = {
  health: () => request<Health>("/api/health"),
  register: (body: { name: string; email?: string; phone?: string; password: string }) =>
    request<{ user: User; token: string }>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ user: User; token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  forgotPassword: (body: { identifier: string }) =>
    request<{ message: string; channel: "email" | "phone" }>("/api/auth/forgot", { method: "POST", body: JSON.stringify(body) }),
  resetPassword: (body: { identifier: string; code: string; password: string }) =>
    request<{ message: string }>("/api/auth/reset", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/api/auth/me"),
  updateMe: (body: { name: string; email: string }) =>
    request<{ user: User }>("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  changePassword: (body: { currentPassword: string; nextPassword: string }) =>
    request<{ token: string }>("/api/auth/password", { method: "POST", body: JSON.stringify(body) }),
  saveLocation: (body: { label: string; latitude?: number; longitude?: number; savePrecise: boolean }) =>
    request<{ user: User }>("/api/auth/location", { method: "PUT", body: JSON.stringify(body) }),
  clearLocation: () => request<{ user: User }>("/api/auth/location", { method: "DELETE" }),
  deleteAccount: (body: { password: string; confirm: "DELETE" }) =>
    request<void>("/api/auth/account", { method: "DELETE", body: JSON.stringify(body) }),
  companions: () => request<{ companions: Companion[] }>("/api/companions"),
  createCompanion: (body: { name: string; description: string; style: string }) =>
    request<{ companion: Companion }>("/api/companions", { method: "POST", body: JSON.stringify(body) }),
  updateCompanion: (id: string, body: { name: string; description: string; style: string }) =>
    request<{ companion: Companion }>(`/api/companions/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  defaultCompanion: (id: string) => request<{ companion: Companion }>(`/api/companions/${id}/default`, { method: "POST" }),
  deleteCompanion: (id: string) => request<void>(`/api/companions/${id}`, { method: "DELETE" }),
  conversations: () => request<{ conversations: Conversation[] }>("/api/conversations"),
  conversation: (id: string) => request<{ conversation: Conversation; messages: ChatMessage[] }>(`/api/conversations/${id}`),
  deleteConversation: (id: string) => request<void>(`/api/conversations/${id}`, { method: "DELETE" }),
  sendMessage: (body: {
    conversationId?: string;
    companionId?: string;
    content: string;
    journalId?: string;
    attachment?: { name: string; mimeType: string; data: string };
    location?: { latitude?: number; longitude?: number; useSaved?: boolean };
    replyLanguage?: string;
  }) =>
    request<{ conversation: Conversation; userMessage: ChatMessage; assistantMessage: ChatMessage & { distanceNote?: string } }>(
      "/api/chat/message",
      { method: "POST", body: JSON.stringify(body) },
    ),
  recommend: (note: string, replyLanguage?: string) =>
    request<{ content: string; saved: boolean; notice: string }>("/api/food/recommend", {
      method: "POST",
      body: JSON.stringify({ note, replyLanguage }),
    }),
  geocodePlaces: (query: string) =>
    request<{ results: PlaceMatch[] }>("/api/restaurants/geocode", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
  reversePlace: (body: { latitude: number; longitude: number }) =>
    request<{ label: string | null }>("/api/restaurants/reverse", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  searchRestaurants: (body: {
    query: string;
    area?: string;
    latitude?: number;
    longitude?: number;
    useSaved?: boolean;
    minRating?: number;
    price?: "inexpensive" | "moderate" | "expensive" | "very_expensive";
    openNow?: boolean;
    category?: "food" | "cafe" | "pharmacy" | "grocery" | "shop";
  }) =>
    request<{ source: string; disclaimer: string; distanceNote: string | null; results: Restaurant[] }>("/api/restaurants/search", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  journal: (q?: string) => request<{ entries: JournalEntry[] }>(`/api/journal${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createJournal: (body: { content: string; moodTag: string; status: "draft" | "saved" }) =>
    request<{ entry: JournalEntry }>("/api/journal", { method: "POST", body: JSON.stringify(body) }),
  updateJournal: (id: string, body: { content: string; moodTag: string; status: "draft" | "saved" }) =>
    request<{ entry: JournalEntry }>(`/api/journal/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteJournal: (id: string) => request<void>(`/api/journal/${id}`, { method: "DELETE" }),
  preferences: () => request<{ preferences: Preferences }>("/api/preferences"),
  savePreferences: (body: Omit<Preferences, "saved">) =>
    request<{ preferences: Preferences }>("/api/preferences", { method: "PUT", body: JSON.stringify(body) }),
  deletePreferences: () => request<{ preferences: Preferences }>("/api/preferences", { method: "DELETE" }),
  tasks: () => request<{ tasks: Task[] }>("/api/tasks"),
  createTask: (body: { title: string; notes?: string; dueOn?: string; priority?: Task["priority"] }) =>
    request<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: string, body: Partial<Pick<Task, "title" | "notes" | "dueOn" | "priority" | "done">>) =>
    request<{ task: Task }>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTask: (id: string) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
  plans: (kind?: string) => request<{ plans: SavedPlan[] }>(`/api/plans${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`),
  savePlan: (body: { kind: SavedPlan["kind"]; title: string; content: string }) =>
    request<{ plan: SavedPlan }>("/api/plans", { method: "POST", body: JSON.stringify(body) }),
  deletePlan: (id: string) => request<void>(`/api/plans/${id}`, { method: "DELETE" }),
  guide: (body: { kind: "study" | "career" | "day"; prompt: string; replyLanguage?: string }) =>
    request<{ content: string }>("/api/guide", { method: "POST", body: JSON.stringify(body) }),
  sendFeedback: (body: { rating: number; category: string; comment: string; email?: string; company?: string }) =>
    request<{ saved: boolean }>("/api/feedback", { method: "POST", body: JSON.stringify(body) }),
  reviewFeedback: (reviewKey: string) =>
    request<{ feedback: { id: string; rating: number; category: string; comment: string; email: string; signedIn: boolean; createdAt: string }[] }>(
      "/api/feedback",
      { headers: { "X-Sahara-Review": reviewKey } },
    ),
};

export function photoUrl(token?: string): string | undefined {
  if (!token || !apiBase()) return undefined;
  return `${apiBase()}/api/restaurants/photo?token=${encodeURIComponent(token)}`;
}
