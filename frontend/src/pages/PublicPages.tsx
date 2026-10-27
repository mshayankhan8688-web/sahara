import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/PublicLayout";
import { FeedbackForm } from "@/pages/FeedbackForm";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function AboutPage() {
  useDocumentTitle("About");
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-soft">About</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">An assistant for ordinary days</h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-soft">
          <p>
            SAHARA is for people who want a plain conversation about study, a day plan, a career question, or a nearby place. Replies come from Google Gemini and follow the language of your latest message, unless you choose a language.
          </p>
          <p>
            Restaurant cards come from a place search. If Google Places is not connected, SAHARA asks OpenStreetMap. Missing ratings, prices, hours, and photos stay blank.
          </p>
          <p>
            SAHARA is not a person, a therapist, a doctor, or a halal certifier. It does not show live job ads, and it does not invent companies, restaurants, or counts of users.
          </p>
          <p>
            An account keeps your chats, tasks, and journal on the server. A journal entry is sent to the AI only after you press Share with AI.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link to="/register" className="font-semibold text-ink">Create an account</Link>
          <Link to="/privacy" className="font-semibold text-ink">Privacy</Link>
          <Link to="/feedback" className="font-semibold text-ink">Send feedback</Link>
        </div>
      </article>
    </PublicLayout>
  );
}

export function PrivacyPage() {
  useDocumentTitle("Privacy");
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-soft">Privacy</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">What SAHARA stores and sends</h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-soft">
          <p>There are no ads and no extra tracking scripts on this site.</p>
          <p>An account stores your name, an email or phone number, and a password hash. Chats, tasks, plans, preferences, and journal entries stay on your account. Other people cannot open them.</p>
          <p>A chat message, and a file you attach, is sent to Google Gemini so it can write the reply. A journal entry is included only after you press Share with AI.</p>
          <p>Restaurant search sends the query and, if you allow it, a location to Google Places or to OpenStreetMap. Precise coordinates are saved only when you tick save. You can clear a saved place from the account settings.</p>
          <p>Voice stays in the browser. SAHARA does not store a recording. Speech recognition and spoken replies depend on the browser.</p>
          <p>Feedback stores the rating, category, comment, the time it was sent, and an email only if you type one. If you are signed in, the note is tied to the account so it can be removed when you delete the account. Feedback is not shown on the public site. The owner can read it only with a private review key.</p>
          <p>The browser keeps a session cookie named heartspace_session, and may keep a sign-in token, theme, and speech preference in local storage.</p>
          <p>You can delete the account from Settings. That removes the account data, including feedback sent while signed in.</p>
        </div>
      </article>
    </PublicLayout>
  );
}

export function FeedbackPage() {
  useDocumentTitle("Feedback");
  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-soft">Feedback</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">Tell us what to fix</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-soft">
          A rating and a short note are enough. Email is optional. The note is saved only after the server confirms it.
        </p>
        <div className="mt-8">
          <FeedbackForm />
        </div>
      </section>
    </PublicLayout>
  );
}
