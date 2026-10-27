import { useEffect, useState } from "react";
import { BookOpen, Briefcase, CalendarDays, GraduationCap, Home, MapPinned, Menu, MessageCircle, MessageSquare, Plus, Settings, SlidersHorizontal, UserRound, Utensils, X } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Wordmark } from "@/components/ui";

const primaryLinks = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/chat", label: "Chat", icon: MessageCircle },
  { to: "/app/study", label: "Study", icon: GraduationCap },
  { to: "/app/plan", label: "My day", icon: CalendarDays },
  { to: "/app/career", label: "Career", icon: Briefcase },
  { to: "/app/restaurants", label: "Places", icon: MapPinned },
];

const moreLinks = [
  { to: "/app/conversations", label: "Conversations", icon: MessageCircle },
  { to: "/app/food", label: "Food ideas", icon: Utensils },
  { to: "/app/journal", label: "Journal", icon: BookOpen },
  { to: "/app/preferences", label: "Preferences", icon: SlidersHorizontal },
  { to: "/app/companion", label: "Companion", icon: UserRound },
  { to: "/app/profile", label: "Profile", icon: UserRound },
  { to: "/app/settings", label: "Settings", icon: Settings },
  { to: "/app/feedback", label: "Send feedback", icon: MessageSquare },
];

const mobileLinks = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/chat", label: "Chat", icon: MessageCircle },
  { to: "/app/plan", label: "Day", icon: CalendarDays },
  { to: "/app/restaurants", label: "Places", icon: MapPinned },
];

function active(pathname: string, to: string) {
  if (to === "/app") return pathname === "/app";
  if (to === "/app/chat") return pathname === "/app/chat" || pathname.startsWith("/app/chat/");
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const itemClass = (current: boolean) =>
    `flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
      current ? "bg-accent-soft font-semibold text-ink" : "text-soft hover:bg-muted hover:text-ink"
    }`;

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-4">
        <NavLink to="/app" end aria-label="SAHARA home">
          <Wordmark />
        </NavLink>
        <button type="button" className="rounded-full p-2 md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="h-4 w-4" />
        </button>
      </div>
      <NavLink to="/app/chat" className="mx-4 mb-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition hover:opacity-90">
        <Plus className="h-4 w-4" aria-hidden="true" />
        New chat
      </NavLink>
      <nav className="min-h-0 flex-1 overflow-auto px-3" aria-label="Dashboard">
        <ul className="space-y-1">
          {primaryLinks.map((link) => {
            const Icon = link.icon;
            const current = active(location.pathname, link.to);
            return (
              <li key={link.to}>
                <NavLink to={link.to} end={link.to === "/app"} aria-current={current ? "page" : undefined} className={itemClass(current)}>
                  <Icon className={`h-4 w-4 ${current ? "text-accent" : ""}`} aria-hidden="true" />
                  {link.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-soft">More</p>
        <ul className="mt-2 space-y-1">
          {moreLinks.map((link) => {
            const Icon = link.icon;
            const current = active(location.pathname, link.to);
            return (
              <li key={link.to}>
                <NavLink to={link.to} aria-current={current ? "page" : undefined} className={itemClass(current)}>
                  <Icon className={`h-4 w-4 ${current ? "text-accent" : ""}`} aria-hidden="true" />
                  {link.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-line p-4">
        <p className="truncate text-sm font-semibold">{user?.name}</p>
        <p className="truncate text-xs text-soft">{user?.email || user?.phone}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" className="min-h-9 rounded-full border border-line px-3 py-1.5 text-xs transition hover:bg-muted" onClick={toggleTheme}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            type="button"
            className="min-h-9 rounded-full border border-line px-3 py-1.5 text-xs transition hover:bg-muted"
            onClick={() => {
              void logout().then(() => navigate("/"));
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-dvh overflow-hidden bg-bg text-ink md:grid md:grid-cols-[17.5rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-elevated md:block">{nav}</aside>
      <div className="flex h-dvh min-w-0 flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="flex items-center justify-between border-b border-line bg-elevated/90 px-4 py-3 backdrop-blur md:hidden">
          <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <Wordmark />
          <button type="button" className="min-h-11 rounded-full px-2 text-xs" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-elevated/95 backdrop-blur md:hidden" aria-label="Primary">
        {mobileLinks.map((link) => {
          const Icon = link.icon;
          const current = active(location.pathname, link.to);
          return (
            <NavLink key={link.to} to={link.to} end={link.to === "/app"} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${current ? "font-semibold text-accent" : "text-soft"}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {link.label}
            </NavLink>
          );
        })}
      </nav>
      {open ? (
        <div className="fixed inset-0 z-30 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(20rem,88vw)] border-r border-line bg-elevated shadow-[var(--shadow)]">{nav}</aside>
        </div>
      ) : null}
    </div>
  );
}
