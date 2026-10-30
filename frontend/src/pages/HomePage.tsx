import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Briefcase, CalendarDays, GraduationCap, Mic, Paperclip, Send, Star, Utensils } from "lucide-react";
import { ReplyLanguageSelect } from "@/components/ReplyLanguageSelect";
import { SaharaOrb } from "@/components/SaharaOrb";
import { Alert, AiMark, Button } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { readReplyLanguage, writeReplyLanguage, type ReplyLanguage } from "@/lib/replyLanguage";
import type { Companion, Conversation, FavoriteReply } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

import { readStoredCompanionId, writeStoredCompanionId } from "@/lib/companions";

const DAILY_TIPS = [
  "Review one hard topic for 20 focused minutes — small sessions beat all-nighters.",
  "Write your next assignment outline before you draft. Structure first saves rewriting later.",
  "If you feel stuck, ask SAHARA to explain the idea in simple English or Roman Urdu.",
  "Save useful AI replies with the star in chat so you can find them again on Home.",
  "Drink water and stretch for two minutes between study blocks.",
  "Turn one lecture into five practice questions — then check your answers.",
  "Your profile photo is yours. The AI companion avatar is separate — customize both when you want.",
];

const spotlight = [
  { to: "/app/studio?mode=study", title: "Study Studio", body: "Assignments, PPT, notes, exam prep, and explanations.", icon: GraduationCap },
  { to: "/app/plan", title: "My day", body: "Tasks you save, or a plan you can ask SAHARA to shape.", icon: CalendarDays },
  { to: "/app/career", title: "Career", body: "CV, interview, and skill help. Live job ads are not connected.", icon: Briefcase },
];

const moreFeatures = [
  { to: "/app/food", title: "Food ideas", body: "Ask what to eat. SAHARA suggests a kind of meal from Gemini.", icon: Utensils },
  { to: "/app/journal", title: "Journal", body: "Private notes. They reach the AI only after you choose Share with AI.", icon: BookOpen },
];

const examples = [
  "I'm feeling low today.",
  "I want to learn programming.",
  "Please plan my day.",
  "Help me improve my CV.",
];

export function HomePage() {
  useDocumentTitle("Home");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [language, setLanguage] = useState<ReplyLanguage>(() => readReplyLanguage());
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [companionId, setCompanionId] = useState(() => readStoredCompanionId());
  const [chats, setChats] = useState<Conversation[] | null>(null);
  const [chatError, setChatError] = useState("");
  const [favorites, setFavorites] = useState<FavoriteReply[]>([]);
  const [studyGoal, setStudyGoal] = useState<{
    topic: string;
    minutesPerDay: number;
    minutesDone: number;
    remaining: number;
  } | null>(null);
  const [goalTopic, setGoalTopic] = useState("");
  const [goalMinutes, setGoalMinutes] = useState(30);
  const [goalBusy, setGoalBusy] = useState(false);
  const dailyTip = useMemo(() => {
    const day = Math.floor(Date.now() / 86_400_000);
    return DAILY_TIPS[day % DAILY_TIPS.length] ?? DAILY_TIPS[0];
  }, []);

  useEffect(() => {
    api
      .conversations()
      .then((result) => setChats(result.conversations.slice(0, 4)))
      .catch((loadError) => {
        console.error("Failed to load recent chats", loadError);
        setChats([]);
        setChatError(loadError instanceof ApiError ? loadError.message : "Recent chats could not be loaded.");
      });
    api
      .favorites()
      .then((result) => setFavorites(result.favorites.slice(0, 4)))
      .catch((loadError) => {
        console.error("Failed to load favorites", loadError);
      });
    api
      .studyGoal()
      .then((result) => {
        setStudyGoal(result.goal);
        setGoalTopic(result.goal.topic);
        setGoalMinutes(result.goal.minutesPerDay);
      })
      .catch((loadError) => {
        console.error("Failed to load study goal", loadError);
      });
  }, []);

  useEffect(() => {
    api
      .companions()
      .then((result) => {
        setCompanions(result.companions);
        const saved = readStoredCompanionId();
        const match = result.companions.find((item) => item.id === saved);
        const fallback = match ?? result.companions.find((item) => item.isDefault) ?? result.companions[0];
        if (fallback) {
          setCompanionId(fallback.id);
          writeStoredCompanionId(fallback.id);
        }
      })
      .catch((loadError) => {
        console.error("Failed to load companions", loadError);
      });
  }, []);

  const openChat = (prompt: string) => {
    const text = prompt.trim();
    if (companionId) writeStoredCompanionId(companionId);
    navigate(text ? `/app/chat?prompt=${encodeURIComponent(text)}` : "/app/chat");
  };

  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <div className="home-shell h-full overflow-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="glass-panel home-hero relative overflow-hidden px-5 py-8 sm:px-8 sm:py-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">SAHARA</p>
                <AiMark />
              </div>
              <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl lg:text-6xl">
                Hello{firstName ? `, ${firstName}` : ""}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-soft sm:text-base">
                Ask one everyday question. Write in your language, or choose a reply language below. SAHARA is an AI, not a person, a therapist, or a doctor.
              </p>
              <div className="mt-5 flex flex-wrap items-end gap-3">
                <ReplyLanguageSelect
                  value={language}
                  onChange={(next) => {
                    setLanguage(next);
                    writeReplyLanguage(next);
                  }}
                />
                {companions.length > 0 ? (
                  <label className="text-xs text-soft">
                    Companion
                    <select
                      className="ml-2 min-h-10 rounded-full border border-line bg-muted px-3 py-1.5 text-sm text-ink"
                      value={companionId}
                      aria-label="Companion"
                      onChange={(event) => {
                        setCompanionId(event.target.value);
                        writeStoredCompanionId(event.target.value);
                      }}
                    >
                      {companions.map((companion) => (
                        <option key={companion.id} value={companion.id}>
                          {companion.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <SaharaOrb className="h-44 w-44 sm:h-56 sm:w-56 lg:h-64 lg:w-64" mood="idle" />
            </div>
          </div>

          <form
            className="composer-box home-composer mt-8 p-2 sm:p-3"
            onSubmit={(event) => {
              event.preventDefault();
              openChat(draft);
            }}
          >
            <label className="block min-w-0">
              <span className="sr-only">Message for chat</span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    openChat(draft);
                  }
                }}
                rows={2}
                placeholder="Ask SAHARA anything…"
                className="max-h-36 w-full resize-none bg-transparent px-3 py-2 text-base outline-none sm:text-sm"
              />
            </label>
            <div className="flex items-center justify-between gap-2 px-1 pb-1">
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" className="h-11 w-11 border-0 bg-transparent px-0 hover:bg-bg" aria-label="Attachments open in chat" onClick={() => openChat(draft)}>
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" className="h-11 w-11 border-0 bg-transparent px-0 hover:bg-bg" aria-label="Voice opens in chat" onClick={() => navigate("/app/chat?voice=1")}>
                  <Mic className="h-4 w-4" />
                </Button>
              </div>
              <Button type="submit" aria-label="Open chat" className="h-11 min-w-11 px-4">
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Open chat</span>
              </Button>
            </div>
          </form>
          <p className="mt-3 text-xs leading-5 text-soft">This opens chat and waits. Nothing is sent to Gemini until you press send there.</p>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="panel p-5">
            <h2 className="font-serif text-2xl">Today&apos;s tip</h2>
            <p className="mt-2 text-sm leading-6 text-soft">{dailyTip}</p>
          </div>
          <div className="panel p-5">
            <h2 className="font-serif text-2xl">Daily study goal</h2>
            <p className="mt-2 text-sm leading-6 text-soft">
              {studyGoal
                ? `${studyGoal.minutesDone} / ${studyGoal.minutesPerDay} minutes${studyGoal.topic ? ` · ${studyGoal.topic}` : ""}`
                : "Set a small daily target so you come back tomorrow."}
            </p>
            {studyGoal ? (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${Math.min(100, (studyGoal.minutesDone / Math.max(1, studyGoal.minutesPerDay)) * 100)}%` }}
                />
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="min-w-[10rem] flex-1 rounded-full border border-line bg-muted px-3 py-2 text-sm text-ink"
                placeholder="Topic (optional)"
                value={goalTopic}
                onChange={(event) => setGoalTopic(event.target.value)}
              />
              <select
                className="rounded-full border border-line bg-muted px-3 py-2 text-sm text-ink"
                value={goalMinutes}
                onChange={(event) => setGoalMinutes(Number(event.target.value))}
                aria-label="Minutes per day"
              >
                {[15, 30, 45, 60, 90, 120].map((value) => (
                  <option key={value} value={value}>
                    {value} min
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                className="min-h-10 px-3 text-xs"
                disabled={goalBusy}
                onClick={() => {
                  setGoalBusy(true);
                  void api
                    .saveStudyGoal({ topic: goalTopic.trim(), minutesPerDay: goalMinutes })
                    .then((result) => setStudyGoal(result.goal))
                    .catch((saveError) => console.error(saveError))
                    .finally(() => setGoalBusy(false));
                }}
              >
                Save goal
              </Button>
              <Button
                type="button"
                className="min-h-10 px-3 text-xs"
                disabled={goalBusy || !studyGoal}
                onClick={() => {
                  setGoalBusy(true);
                  void api
                    .addStudyProgress(15)
                    .then((result) => setStudyGoal(result.goal))
                    .catch((progressError) => console.error(progressError))
                    .finally(() => setGoalBusy(false));
                }}
              >
                +15 min
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-2xl sm:text-3xl">Try one of these</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {examples.map((prompt) => (
              <li key={prompt}>
                <button type="button" className="chip" onClick={() => openChat(prompt)}>
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="stage mt-8">
          <h2 className="font-serif text-2xl sm:text-3xl">Core tools</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {spotlight.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link key={feature.to} to={feature.to} className="panel depth-card feature-card flex min-h-44 flex-col p-5">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-serif text-2xl leading-tight">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-soft">{feature.body}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="stage mt-6 grid gap-3 sm:grid-cols-2">
          {moreFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.to} to={feature.to} className="panel depth-card flex min-h-32 flex-col p-5">
                <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                <h3 className="mt-3 font-serif text-xl leading-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-soft">{feature.body}</p>
              </Link>
            );
          })}
        </section>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl">Recent chats</h2>
              <Link to="/app/conversations" className="text-sm font-semibold text-accent">
                All chats
              </Link>
            </div>
            {chatError ? (
              <div className="mt-3">
                <Alert>{chatError}</Alert>
              </div>
            ) : null}
            {chats === null ? <p className="mt-4 text-sm text-soft">Loading your chats.</p> : null}
            {chats && chats.length === 0 && !chatError ? (
              <p className="mt-4 text-sm leading-6 text-soft">No saved chats yet. A conversation appears here after Gemini replies.</p>
            ) : null}
            {chats && chats.length > 0 ? (
              <ul className="mt-4 divide-y divide-line">
                {chats.map((chat) => (
                  <li key={chat.id}>
                    <Link to={`/app/chat/${chat.id}`} className="flex items-center justify-between gap-3 py-3 text-sm transition hover:text-accent">
                      <span className="truncate">{chat.title}</span>
                      <span className="shrink-0 text-xs text-soft">{new Date(chat.updatedAt).toLocaleDateString()}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          <section className="panel p-5">
            <h2 className="font-serif text-2xl">Saved replies</h2>
            <p className="mt-2 text-sm leading-6 text-soft">Star an AI reply in chat to keep it here.</p>
            {favorites.length === 0 ? (
              <p className="mt-4 text-sm text-soft">No saved replies yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {favorites.map((item) => (
                  <li key={item.id}>
                    <Link to={`/app/chat/${item.conversationId}`} className="block rounded-2xl border border-line p-3 transition hover:border-accent">
                      <span className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                        <Star className="h-3 w-3 fill-accent" />
                        Favorite
                      </span>
                      <p className="line-clamp-3 text-sm leading-6 text-soft">{item.content}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 border-t border-line pt-4">
              <h3 className="font-serif text-xl">Make it yours</h3>
              <p className="mt-2 text-sm leading-6 text-soft">Reply language stays on this device. Profile photo and AI companion are separate.</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link to="/app/profile" className="text-sm font-semibold text-accent">
                  Profile
                </Link>
                <Link to="/app/companion" className="text-sm font-semibold text-accent">
                  Companion
                </Link>
                <Link to="/app/feedback" className="text-sm font-semibold text-accent">
                  Feedback
                </Link>
              </div>
              <div className="mt-4">
                <ReplyLanguageSelect
                  value={language}
                  onChange={(next) => {
                    setLanguage(next);
                    writeReplyLanguage(next);
                  }}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
