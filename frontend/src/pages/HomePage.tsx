import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Briefcase, CalendarDays, GraduationCap, MapPinned, MessageCircle, Utensils } from "lucide-react";
import { ReplyLanguageSelect } from "@/components/ReplyLanguageSelect";
import { api, ApiError } from "@/lib/api";
import { readReplyLanguage, writeReplyLanguage, type ReplyLanguage } from "@/lib/replyLanguage";
import type { Conversation } from "@/lib/types";
import { Alert, Button } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const features = [
  { to: "/app/study", title: "Study", body: "Explanations, a timetable, or practice questions.", icon: GraduationCap },
  { to: "/app/plan", title: "My day", body: "Tasks you save, or a plan you can ask SAHARA to shape.", icon: CalendarDays },
  { to: "/app/career", title: "Career", body: "CV, interview, and skill help. Live job ads are not connected.", icon: Briefcase },
  { to: "/app/restaurants", title: "Places", body: "Search a real city or area, or use your location once.", icon: MapPinned },
  { to: "/app/food", title: "Food ideas", body: "Ask for a meal idea. Restaurant names appear only after a search.", icon: Utensils },
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

  const openChat = (prompt: string) => {
    const text = prompt.trim();
    navigate(text ? `/app/chat?prompt=${encodeURIComponent(text)}` : "/app/chat");
  };

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">SAHARA</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">Hello{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-soft">
          Ask one everyday question. Write in your language, or choose a reply language below. SAHARA is an AI, not a person, a therapist, or a doctor.
        </p>

        <form
          className="panel mt-8 p-4 sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            openChat(draft);
          }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessageCircle className="h-4 w-4 text-accent" aria-hidden="true" />
            Talk to SAHARA
          </div>
          <label className="mt-3 block">
            <span className="sr-only">Message for chat</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              placeholder="What do you want help with?"
              className="w-full resize-none rounded-2xl border border-line bg-muted px-4 py-3 text-base outline-none focus:border-accent sm:text-sm"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-5 text-soft">This opens the chat and waits. Nothing is sent until you press send there.</p>
            <Button type="submit">Open chat</Button>
          </div>
        </form>

        <section className="mt-8">
          <h2 className="font-serif text-2xl">Try one of these</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {examples.map((prompt) => (
              <li key={prompt}>
                <button type="button" className="rounded-full border border-line bg-elevated px-3 py-2 text-left text-sm transition hover:border-accent" onClick={() => openChat(prompt)}>
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.to} to={feature.to} className="panel flex min-h-36 flex-col p-5 transition hover:border-accent">
                <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                <h2 className="mt-4 font-serif text-2xl leading-tight">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-soft">{feature.body}</p>
              </Link>
            );
          })}
        </section>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl">Recent chats</h2>
              <Link to="/app/conversations" className="text-sm font-semibold text-accent">All chats</Link>
            </div>
            {chatError ? <div className="mt-3"><Alert>{chatError}</Alert></div> : null}
            {chats === null ? <p className="mt-4 text-sm text-soft">Loading your chats.</p> : null}
            {chats && chats.length === 0 && !chatError ? (
              <p className="mt-4 text-sm leading-6 text-soft">No saved chats yet. A conversation appears here after Gemini replies.</p>
            ) : null}
            {chats && chats.length > 0 ? (
              <ul className="mt-4 divide-y divide-line">
                {chats.map((chat) => (
                  <li key={chat.id}>
                    <Link to={`/app/chat/${chat.id}`} className="flex items-center justify-between gap-3 py-3 text-sm">
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
            <div className="mt-4">
              <ReplyLanguageSelect
                value={language}
                onChange={(next) => {
                  setLanguage(next);
                  writeReplyLanguage(next);
                }}
              />
            </div>
            <Link to="/app/feedback" className="mt-5 inline-flex text-sm font-semibold text-accent">Send feedback</Link>
          </section>
        </div>
      </div>
    </div>
  );
}
