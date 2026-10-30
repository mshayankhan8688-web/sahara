import type {
  BillingPlansResponse,
  ChatMessage,
  Companion,
  Conversation,
  Health,
  JournalEntry,
  PasswordResetStatus,
  Preferences,
  SavedPlan,
  Task,
  UsageSnapshot,
  User,
} from "@/lib/types";

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
  details?: Record<string, unknown>;

  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
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
  const body = (await response.json().catch(() => null)) as {
    message?: string;
    code?: string;
    details?: Record<string, unknown>;
  } | null;
  if (!response.ok) {
    throw new ApiError(body?.message ?? "The request failed.", response.status, body?.code, body?.details);
  }
  return body as T;
}

export const api = {
  health: () => request<Health>("/api/health"),
  register: (body: { name: string; email?: string; phone?: string; password: string }) =>
    request<{ user: User; token: string }>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ user: User; token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  passwordResetStatus: () => request<PasswordResetStatus>("/api/auth/password-reset-status"),
  forgotPassword: (body: { identifier: string }) =>
    request<{
      message: string;
      channel: "email" | "phone";
      delivery?: "email" | "sms" | "local";
      localCode?: string;
    }>("/api/auth/forgot", { method: "POST", body: JSON.stringify(body) }),
  resetPassword: (body: { identifier: string; code: string; password: string }) =>
    request<{ message: string }>("/api/auth/reset", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/api/auth/me"),
  updateMe: (body: {
    name: string;
    email: string;
    avatar?: { mimeType: string; data: string };
    clearAvatar?: boolean;
  }) => request<{ user: User }>("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  changePassword: (body: { currentPassword: string; nextPassword: string }) =>
    request<{ token: string }>("/api/auth/password", { method: "POST", body: JSON.stringify(body) }),
  deleteAccount: (body: { password: string; confirm: "DELETE" }) =>
    request<void>("/api/auth/account", { method: "DELETE", body: JSON.stringify(body) }),
  companions: () => request<{ companions: Companion[] }>("/api/companions"),
  createCompanion: (body: { name: string; description: string; style: string; appearance?: Companion["appearance"] }) =>
    request<{ companion: Companion }>("/api/companions", { method: "POST", body: JSON.stringify(body) }),
  updateCompanion: (id: string, body: { name: string; description: string; style: string; appearance?: Companion["appearance"] }) =>
    request<{ companion: Companion }>(`/api/companions/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  defaultCompanion: (id: string) => request<{ companion: Companion }>(`/api/companions/${id}/default`, { method: "POST" }),
  deleteCompanion: (id: string) => request<void>(`/api/companions/${id}`, { method: "DELETE" }),
  conversations: () => request<{ conversations: Conversation[] }>("/api/conversations"),
  conversation: (id: string) => request<{ conversation: Conversation; messages: ChatMessage[] }>(`/api/conversations/${id}`),
  renameConversation: (id: string, title: string) =>
    request<{ conversation: Conversation }>(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  deleteConversation: (id: string) => request<void>(`/api/conversations/${id}`, { method: "DELETE" }),
  sendMessage: (body: {
    conversationId?: string;
    companionId?: string;
    content: string;
    journalId?: string;
    attachment?: { name: string; mimeType: string; data: string };
    replyLanguage?: string;
    mode?: string;
    regenerateOfMessageId?: string;
  }) =>
    request<{
      conversation: Conversation;
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
      replacedMessageId?: string;
    }>("/api/chat/message", { method: "POST", body: JSON.stringify(body) }),
  favorites: () =>
    request<{
      favorites: { id: string; messageId: string; conversationId: string; content: string; createdAt: string }[];
    }>("/api/favorites"),
  addFavorite: (body: { messageId: string; conversationId: string; content: string }) =>
    request<{ favorite: { id: string; messageId: string; conversationId: string; content: string; createdAt: string } }>(
      "/api/favorites",
      { method: "POST", body: JSON.stringify(body) },
    ),
  removeFavorite: (messageId: string) => request<void>(`/api/favorites/${messageId}`, { method: "DELETE" }),
  studyGoal: () =>
    request<{
      goal: { topic: string; minutesPerDay: number; minutesDone: number; day: string; remaining: number };
    }>("/api/study-goal"),
  saveStudyGoal: (body: { topic: string; minutesPerDay: number; minutesDone?: number }) =>
    request<{
      goal: { topic: string; minutesPerDay: number; minutesDone: number; day: string; remaining: number };
    }>("/api/study-goal", { method: "PUT", body: JSON.stringify(body) }),
  addStudyProgress: (minutes: number) =>
    request<{
      goal: { topic: string; minutesPerDay: number; minutesDone: number; day: string; remaining: number };
    }>("/api/study-goal/progress", { method: "POST", body: JSON.stringify({ minutes }) }),
  studioGenerate: (body: {
    mode: string;
    prompt: string;
    title?: string;
    subject?: string;
    level?: string;
    assignmentType?: "essay" | "assignment" | "report" | "outline" | "short-answer" | "detailed-answer";
    wordCount?: number;
    writingStyle?: "simple" | "academic";
    studyFormat?: "explain" | "quiz" | "mcq" | "summary" | "study-plan";
    documentType?: "notes" | "summary" | "report" | "study-guide" | "qa";
    audience?: "school" | "university" | "professional";
    presentationStyle?: "minimal" | "academic" | "bold";
    slideCount?: number;
    includeSpeakerNotes?: boolean;
    companionId?: string;
    replyLanguage?: string;
    attachment?: { name: string; mimeType: string; data: string };
  }) =>
    request<{
      mode: string;
      title: string;
      content: string;
      presentation?: { title: string; slides: { title: string; bullets: string[]; notes?: string }[] };
    }>("/api/studio/generate", { method: "POST", body: JSON.stringify(body) }),
  studioExport: (body: {
    format: "pptx" | "docx" | "pdf";
    title: string;
    content: string;
    presentation?: { title: string; slides: { title: string; bullets: string[]; notes?: string }[] };
  }) =>
    request<{ filename: string; mimeType: string; data: string }>("/api/studio/export", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  generateImage: (body: {
    conversationId?: string;
    companionId?: string;
    prompt: string;
    style?: string;
    purpose?: "general" | "study" | "presentation" | "poster";
  }) =>
    request<{
      conversation: Conversation;
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
      image: { name: string; mimeType: string; model: string };
    }>("/api/images/generate", { method: "POST", body: JSON.stringify(body) }),
  editImage: (body: {
    conversationId?: string;
    companionId?: string;
    prompt: string;
    image: { name: string; mimeType: string; data: string };
  }) =>
    request<{
      conversation: Conversation;
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
      image: { name: string; mimeType: string; model: string };
    }>("/api/images/edit", { method: "POST", body: JSON.stringify(body) }),
  generateDiagram: (body: {
    conversationId?: string;
    companionId?: string;
    prompt: string;
    kind?: "flowchart" | "network" | "er" | "uml" | "cycle" | "labeled";
  }) =>
    request<{
      conversation: Conversation;
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
      image: { name: string; mimeType: string; model: string };
    }>("/api/images/diagram", { method: "POST", body: JSON.stringify(body) }),
  recommend: (note: string, replyLanguage?: string) =>
    request<{ content: string; saved: boolean; notice: string }>("/api/food/recommend", {
      method: "POST",
      body: JSON.stringify({ note, replyLanguage }),
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
  feedbackSummary: () =>
    request<{ count: number; average: number | null; stars: Record<"1" | "2" | "3" | "4" | "5", number> }>("/api/feedback/summary"),
  reviewFeedback: (reviewKey: string) =>
    request<{ feedback: { id: string; rating: number; category: string; comment: string; email: string; signedIn: boolean; createdAt: string }[] }>(
      "/api/feedback",
      { headers: { "X-Sahara-Review": reviewKey } },
    ),
  billingPlans: () => request<BillingPlansResponse>("/api/billing/plans"),
  billingUsage: () => request<{ usage: UsageSnapshot }>("/api/billing/usage"),
  billingStatus: () =>
    request<{
      planId: string;
      planName: string;
      paymentsConfigured: boolean;
      canCheckout: boolean;
      checkoutNotice: string;
      usage: UsageSnapshot;
    }>("/api/billing/status"),
};
