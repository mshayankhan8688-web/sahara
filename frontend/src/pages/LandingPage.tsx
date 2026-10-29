import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { SaharaOrb } from "@/components/SaharaOrb";
import { PublicLayout } from "@/components/PublicLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { RatingSummary } from "@/pages/FeedbackForm";

const features = [
  ["01", "Talk or speak", "Type, or use the microphone. The browser turns speech into text you can edit. SAHARA can read a reply aloud. It is not a live phone call."],
  ["02", "Study and work", "Ask for a simple explanation, practice questions, CV notes, or interview practice. Live job ads are not connected."],
  ["03", "Plan the day", "Tasks are saved on your account. You can mark them done."],
  ["04", "Food ideas", "Ask what to eat. SAHARA suggests a kind of meal from Gemini — general ideas, not a restaurant finder."],
];

export function LandingPage() {
  useDocumentTitle("SAHARA");
  const { user } = useAuth();
  const reduce = useReducedMotion();
  const chat = user ? "/app/chat" : "/register";
  const study = user ? "/app/study" : "/register";

  return (
    <PublicLayout>
      <div>
        <section className="home-shell mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-8 lg:grid-cols-[1.15fr_0.85fr] lg:pt-16">
          <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">SAHARA</p>
            <h1 className="mt-4 max-w-xl font-serif text-4xl leading-tight sm:text-6xl">Your Everyday Life, Made Easier.</h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-soft">
              SAHARA helps you talk, study, and plan a day. Write in your language, or choose one in chat. It stays an AI.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={chat} className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-[var(--shadow)] transition hover:-translate-y-px">
                Start chatting
              </Link>
              <Link to={study} className="inline-flex items-center justify-center rounded-full border border-line bg-elevated/60 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:border-accent">
                Help me study
              </Link>
              <a href="#features" className="inline-flex items-center justify-center rounded-full border border-line px-5 py-2.5 text-sm font-semibold transition hover:border-accent">
                Explore features
              </a>
            </div>
          </motion.div>
          <aside className="flex flex-col items-center gap-6">
            <SaharaOrb className="h-56 w-56 sm:h-80 sm:w-80" mood="idle" />
            <div className="panel w-full p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-soft">Example conversation, not a live reply</p>
              <div className="mt-5 space-y-4 text-sm leading-6">
                <p>I'm feeling low today. Can you help me plan a gentle afternoon?</p>
                <p className="rounded-2xl border border-line bg-muted/50 px-4 py-3 text-soft">
                  A short walk, one small task, and a quiet break can be enough. What time do you have free, and what feels doable today?
                </p>
                <p>I also want to revise for an exam tomorrow.</p>
                <p className="rounded-2xl border border-line bg-muted/50 px-4 py-3 text-soft">
                  Pick one topic, study it for twenty minutes, then write three questions you still cannot answer. SAHARA can quiz you after that.
                </p>
              </div>
            </div>
          </aside>
        </section>
        <section id="features" className="border-t border-line">
          <div className="stage mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-2">
            {features.map(([index, title, body]) => (
              <article key={index} className="panel depth-card p-5">
                <p className="text-xs tracking-[0.16em] text-accent">{index}</p>
                <h2 className="mt-2 font-serif text-4xl">{title}</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-soft">{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 lg:grid-cols-2">
            <div>
              <h2 className="font-serif text-4xl">How a reply is written</h2>
              <ol className="mt-6 space-y-4 text-sm leading-6 text-soft">
                <li>1. You type, or the browser turns your speech into text you can edit.</li>
                <li>2. That message is sent to Gemini so it can write the reply.</li>
                <li>3. The reply stays on the page. You can ask it to read the reply aloud.</li>
                <li>4. Study, day plans, career notes, journal, and food ideas all use the same AI path.</li>
              </ol>
            </div>
            <div className="rounded-[1.75rem] border border-dashed border-line p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-soft">AI only</p>
              <p className="mt-4 font-serif text-3xl">Gemini writes the answer</p>
              <p className="mt-3 text-sm leading-6 text-soft">
                SAHARA is a chat and planning assistant. Food ideas are general meal suggestions, not nearby restaurant search.
              </p>
            </div>
          </div>
        </section>
        <section id="privacy" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-serif text-4xl">What is sent, and what stays put</h2>
            <div className="mt-6 grid gap-6 text-sm leading-6 text-soft md:grid-cols-3">
              <p>Chat messages, and a journal entry only after you press Share with AI, are sent to Google Gemini to write the reply.</p>
              <p>Tasks, plans, preferences, and journal drafts stay on your account. Voice stays in the browser; SAHARA does not store a recording.</p>
              <p>Passwords are stored as hashes. Other people cannot open your chats, journal, tasks, or preferences. SAHARA is not a clinic and not a halal certifier.</p>
            </div>
          </div>
        </section>
        <section id="about" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-serif text-4xl">About SAHARA</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-soft">
              SAHARA is a place to ask an everyday question, study, or plan a day. It stays an AI. There is no public signup count.
            </p>
            <div className="mt-6 max-w-xl">
              <RatingSummary />
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <Link to="/about" className="font-semibold">Read more</Link>
              <Link to="/feedback" className="font-semibold">Send feedback</Link>
              <Link to="/privacy" className="font-semibold">Privacy</Link>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
