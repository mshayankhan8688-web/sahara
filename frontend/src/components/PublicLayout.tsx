import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Wordmark } from "@/components/ui";

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const start = user ? "/app" : "/register";

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5">
        <Link to="/" aria-label="SAHARA home">
          <Wordmark />
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Site">
          <Link to="/about" className="rounded-full px-3 py-2 text-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            About
          </Link>
          <Link to="/feedback" className="rounded-full px-3 py-2 text-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            Feedback
          </Link>
          <Link to="/login" className="rounded-full px-3 py-2 text-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            Login
          </Link>
          <Link to={start} className="rounded-full bg-accent px-4 py-2 font-semibold text-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            Start chatting
          </Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="border-t border-line px-5 py-8 text-sm text-soft">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p>SAHARA. An AI assistant, not a person.</p>
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <Link to="/about" className="text-ink">About</Link>
            <Link to="/privacy" className="text-ink">Privacy</Link>
            <Link to="/feedback" className="text-ink">Send feedback</Link>
            <Link to={start} className="text-ink">Get started</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
