import { useEffect, useState } from "react";
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  HeartHandshake,
  Home,
  Menu,
  MessageCircle,
  Plus,
  Presentation,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserRound,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { ChatHistory } from "@/components/ChatHistory";
import { UsageMeter } from "@/components/UsageMeter";
import { Mark, Wordmark } from "@/components/ui";

const primaryLinks = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/chat", label: "Chat", icon: MessageCircle },
  { to: "/app/studio", label: "Studio", icon: Sparkles },
  { to: "/app/plan", label: "My day", icon: CalendarDays },
  { to: "/app/career", label: "Career", icon: Briefcase },
];

const moreLinks = [
  { to: "/app/studio?mode=study", label: "Study", icon: GraduationCap },
  { to: "/app/studio?mode=assignment", label: "Assignment", icon: BookOpen },
  { to: "/app/studio?mode=ppt", label: "PPT Maker", icon: Presentation },
  { to: "/app/studio?mode=emotion", label: "Listen", icon: HeartHandshake },
  { to: "/app/conversations", label: "Conversations", icon: MessageCircle },
  { to: "/app/food", label: "Food ideas", icon: Utensils },
  { to: "/app/journal", label: "Journal", icon: BookOpen },
  { to: "/app/preferences", label: "Preferences", icon: SlidersHorizontal },
  { to: "/app/companion", label: "Companion", icon: UserRound },
  { to: "/app/profile", label: "Profile", icon: UserRound },
  { to: "/app/settings", label: "Settings", icon: Settings },
  { to: "/app/pricing", label: "Plans", icon: Wallet },
  { to: "/app/feedback", label: "Feedback", icon: Star },
];

const mobileLinks = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/chat", label: "Chat", icon: MessageCircle },
  { to: "/app/studio", label: "Studio", icon: Sparkles },
  { to: "/app/plan", label: "Day", icon: CalendarDays },
];

function active(pathname: string, to: string) {
  if (to === "/app") return pathname === "/app";
  if (to === "/app/chat") return pathname === "/app/chat" || pathname.startsWith("/app/chat/");
  if (to.startsWith("/app/studio")) return pathname === "/app/studio" || pathname.startsWith("/app/studio");
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sahara.sidebar") === "collapsed";
  });

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem("sahara.sidebar", collapsed ? "collapsed" : "open");
  }, [collapsed]);

  const itemClass = (current: boolean) =>
    `flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
      current
        ? "bg-accent-soft font-semibold text-ink shadow-[inset_3px_0_0_0_var(--accent),0_8px_20px_color-mix(in_srgb,var(--accent)_12%,transparent)]"
        : "text-soft hover:bg-muted hover:text-ink"
    } ${collapsed ? "justify-center px-2" : ""}`;

  const nav = (compact: boolean) => (
    <div className="flex h-full flex-col">
      <div className={`flex items-center px-4 py-4 ${compact ? "justify-center" : "justify-between"}`}>
        <NavLink to="/app" end aria-label="SAHARA home" className={compact ? "grid place-items-center" : ""}>
          {compact ? <Mark className="h-8 w-8 text-accent" /> : <Wordmark />}
        </NavLink>
        <button type="button" className="rounded-full p-2 md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="h-4 w-4" />
        </button>
      </div>
      <NavLink
        to="/app/chat"
        end
        title="New chat"
        className={`mb-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-on-accent shadow-[var(--shadow)] transition duration-150 hover:-translate-y-px hover:opacity-95 ${
          compact ? "mx-2 px-0" : "mx-4 px-4 py-2"
        }`}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {compact ? <span className="sr-only">New chat</span> : "New chat"}
      </NavLink>
      <div className="min-h-0 flex-1 overflow-hidden border-b border-line">
        <ChatHistory compact={compact} />
      </div>
      <nav className="max-h-[40%] min-h-0 overflow-auto px-3 py-3" aria-label="Dashboard">
        <ul className="space-y-1">
          {primaryLinks.map((link) => {
            const Icon = link.icon;
            const current = active(location.pathname, link.to);
            return (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.to === "/app"}
                  title={link.label}
                  aria-current={current ? "page" : undefined}
                  className={itemClass(current)}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${current ? "text-accent" : ""}`} aria-hidden="true" />
                  {compact ? <span className="sr-only">{link.label}</span> : link.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
        {!compact ? <p className="mt-4 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-soft">More</p> : <div className="mt-3 border-t border-line" />}
        <ul className={`space-y-1 ${compact ? "mt-3" : "mt-2"}`}>
          {moreLinks.map((link) => {
            const Icon = link.icon;
            const current = active(location.pathname, link.to);
            return (
              <li key={link.to}>
                <NavLink to={link.to} title={link.label} aria-current={current ? "page" : undefined} className={itemClass(current)}>
                  <Icon className={`h-4 w-4 shrink-0 ${current ? "text-accent" : ""}`} aria-hidden="true" />
                  {compact ? <span className="sr-only">{link.label}</span> : link.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={`border-t border-line p-4 ${compact ? "px-2" : ""}`}>
        {!compact ? <div className="mb-3"><UsageMeter /></div> : <div className="mb-3"><UsageMeter compact /></div>}
        {!compact ? (
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-muted text-sm font-semibold text-accent">
              {user?.avatar?.data ? (
                <img src={`data:${user.avatar.mimeType};base64,${user.avatar.data}`} alt="" className="h-full w-full object-cover" />
              ) : (
                (user?.name ?? "S").slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="truncate text-xs text-soft">{user?.email || user?.phone}</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-line bg-muted text-xs font-semibold text-accent" title={user?.name}>
            {user?.avatar?.data ? (
              <img src={`data:${user.avatar.mimeType};base64,${user.avatar.data}`} alt="" className="h-full w-full object-cover" />
            ) : (
              (user?.name ?? "S").slice(0, 1).toUpperCase()
            )}
            <span className="sr-only">{user?.name}</span>
          </div>
        )}
        <div className={`mt-3 flex gap-2 ${compact ? "flex-col items-center" : ""}`}>
          <button type="button" className="min-h-9 rounded-full border border-line px-3 py-1.5 text-xs transition hover:bg-muted" onClick={toggleTheme} title={theme === "dark" ? "Light" : "Dark"}>
            {compact ? (theme === "dark" ? "L" : "D") : theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            type="button"
            className="min-h-9 rounded-full border border-line px-3 py-1.5 text-xs transition hover:bg-muted"
            title="Sign out"
            onClick={() => {
              void logout().then(() => navigate("/"));
            }}
          >
            {compact ? "Out" : "Sign out"}
          </button>
        </div>
        <button
          type="button"
          className="mt-3 hidden min-h-9 w-full items-center justify-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs transition hover:bg-muted md:inline-flex"
          onClick={() => setCollapsed((value) => !value)}
          aria-pressed={collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {collapsed ? <span className="sr-only">Expand</span> : "Collapse"}
        </button>
      </div>
    </div>
  );

  return (
    <div className={`app-bg h-dvh overflow-hidden text-ink md:grid ${collapsed ? "md:grid-cols-[4.75rem_minmax(0,1fr)]" : "md:grid-cols-[17.5rem_minmax(0,1fr)]"}`}>
      <aside className="sidebar-glass relative z-10 hidden border-r border-line transition-[width] duration-200 md:block">{nav(collapsed)}</aside>
      <div className="relative z-10 flex h-dvh min-w-0 flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
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
          <aside className="absolute inset-y-0 left-0 w-[min(20rem,88vw)] border-r border-line bg-elevated shadow-[var(--shadow)]">{nav(false)}</aside>
        </div>
      ) : null}
    </div>
  );
}
