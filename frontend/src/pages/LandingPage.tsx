import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { PublicLayout } from "@/components/PublicLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const features = [
  ["01", "Talk or speak", "Type, or use the microphone. The browser turns speech into text you can edit. SAHARA can read a reply aloud. It is not a live phone call."],
  ["02", "Study and work", "Ask for a simple explanation, practice questions, CV notes, or interview practice. Live job ads are not connected."],
  ["03", "Plan the day", "Tasks are saved on your account. You can mark them done."],
  ["04", "Find a real place", "Search a city and area, or share location once. Cards show only what the place search returns."],
];

export function LandingPage() {
  useDocumentTitle("SAHARA");
  const { user } = useAuth();
  const reduce = useReducedMotion();
  const chat = user ? "/app/chat" : "/register";
  const food = user ? "/app/food" : "/register";

  return (
    <PublicLayout>
      <div>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-8 lg:grid-cols-[1.15fr_0.85fr] lg:pt-16">
          <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-soft">For everyday questions, study, and nearby places</p>
            <h1 className="mt-4 max-w-xl font-serif text-4xl leading-tight sm:text-6xl">Your Everyday Life, Made Easier.</h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-soft">
              SAHARA helps you talk, study, plan a day, and look up real places. Write in your language, or choose one in chat. It stays an AI.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={chat} className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent">
                Start chatting
              </Link>
              <Link to={food} className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2.5 text-sm font-semibold">
                Find food
              </Link>
              <a href="#features" className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2.5 text-sm font-semibold">
                Explore features
              </a>
            </div>
          </motion.div>
          <aside className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-soft">Example conversation, not a live reply</p>
            <div className="mt-5 space-y-4 text-sm leading-6">
              <p>I'm feeling low today, and I'm hungry. What should I eat?</p>
              <p className="border-l border-accent pl-4 text-soft">
                Sorry your mood is off. We can look at something tasty. Is it pizza, a burger, or Pakistani food? If you share an area, a real search can look for places nearby.
              </p>
              <p>I would like a burger. I also get acidity.</p>
              <p className="border-l border-accent pl-4 text-soft">
                Spicy, oily food and some sauces can bother acidity. A milder option is worth considering, and the ingredients still need a check. If it keeps happening, a doctor is the right person to ask.
              </p>
            </div>
          </aside>
        </section>
        <section id="features" className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-2">
            {features.map(([index, title, body]) => (
              <article key={index} className="panel p-5">
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
              <h2 className="font-serif text-4xl">How a place gets on the page</h2>
              <ol className="mt-6 space-y-4 text-sm leading-6 text-soft">
                <li>1. You ask for food, or for a place.</li>
                <li>2. If a place is needed, you allow location once or type a city.</li>
                <li>3. The server asks the restaurant provider. Cards show only what comes back.</li>
                <li>4. Gemini can explain those results. It is not allowed to invent the rest.</li>
              </ol>
            </div>
            <div className="rounded-[1.75rem] border border-dashed border-line p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-soft">Restaurant card</p>
              <p className="mt-4 font-serif text-3xl">Waiting for a search</p>
              <p className="mt-3 text-sm leading-6 text-soft">
                Name, address, rating, price, hours, and photos appear here only after a real search returns them. SAHARA does not draw sample restaurants.
              </p>
            </div>
          </div>
        </section>
        <section id="privacy" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-serif text-4xl">What is sent, and what stays put</h2>
            <div className="mt-6 grid gap-6 text-sm leading-6 text-soft md:grid-cols-3">
              <p>Chat messages, and a journal entry only after you press Share with AI, are sent to Google Gemini to write the reply.</p>
              <p>A restaurant search sends the food query and, if you allow it, your location to Google Places or, when that key is not set, to OpenStreetMap. Precise location is not saved unless you explicitly save it.</p>
              <p>Passwords are stored as hashes. Other people cannot open your chats, journal, tasks, or preferences. SAHARA is not a clinic and not a halal certifier.</p>
            </div>
          </div>
        </section>
        <section id="about" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-serif text-4xl">About SAHARA</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-soft">
              SAHARA is a place to ask an everyday question, study, plan a day, or look up a real restaurant. It stays an AI. There is no public signup count, and sample restaurants are not drawn on this page.
            </p>
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
