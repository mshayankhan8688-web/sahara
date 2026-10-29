import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Briefcase, CalendarDays, GraduationCap, Mic, Paperclip, Send, Utensils } from "lucide-react";
import { ReplyLanguageSelect } from "@/components/ReplyLanguageSelect";
import { SaharaOrb } from "@/components/SaharaOrb";
import { Alert, AiMark, Button } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { readReplyLanguage, writeReplyLanguage, type ReplyLanguage } from "@/lib/replyLanguage";
import type { Companion, Conversation } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const COMPANION_KEY = "sahara.companionId";

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
  const [companionId, setCompanionId] = useState(() => localStorage.getItem(COMPANION_KEY) ?? "");
  const [chats, setChats] = useState<Conversation[] | null>(null);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    api
      .conversations()
      .then((result) => setChats(result.conversations.slice(0, 4)))
      .catch((loadError) => {
        console.error("Failed to load recent chats", loadError);
        setChats([]);
        setChatError(loadError instanceof ApiError ? loadError.message : "Recent chats could not be loaded.");
      });
  }, []);

  useEffect(() => {
    api
      .companions()
      .then((result) => {
        setCompanions(result.companions);
        const saved = localStorage.getItem(COMPANION_KEY);
        const match = result.companions.find((item) => item.id === saved);
        const fallback = match ?? result.companions.find((item) => item.isDefault) ?? result.companions[0];
        if (fallback) {
          setCompanionId(fallback.id);
          localStorage.setItem(COMPANION_KEY, fallback.id);
        }
      })
      .catch((loadError) => {
        console.error("Failed to load companions", loadError);
      });
  }, []);

  const openChat = (prompt: string) => {
    const text = prompt.trim();
    if (companionId) localStorage.setItem(COMPANION_KEY, companionId);
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
                        localStorage.setItem(COMPANION_KEY, event.target.value);
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
            <h2 className="font-serif text-2xl">Make it yours</h2>
            <p className="mt-2 text-sm leading-6 text-soft">The reply language is saved on this device and used in chat, study, and food ideas.</p>
            <Link to="/app/feedback" className="mt-3 inline-flex text-sm font-semibold text-accent">
              Send feedback
            </Link>
            <div className="mt-4">
              <ReplyLanguageSelect
                value={language}
                onChange={(next) => {
                  setLanguage(next);
                  writeReplyLanguage(next);
                }}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
