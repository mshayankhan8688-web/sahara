import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { CONVERSATIONS_CHANGED, formatChatTime, notifyConversationsChanged } from "@/lib/conversations";
import type { Conversation } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui";

function activeConversationId(pathname: string): string {
  if (!pathname.startsWith("/app/chat/")) return "";
  const rest = pathname.slice("/app/chat/".length);
  return rest.split(/[/?#]/)[0] ?? "";
}

export function ChatHistory({ compact = false }: { compact?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<Conversation[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const loadGeneration = useRef(0);
  const noticeTimer = useRef<number | null>(null);

  const filtered = items.filter((item) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${item.title} ${item.preview ?? ""}`.toLowerCase().includes(needle);
  });

  const activeId = activeConversationId(location.pathname);

  const load = () => {
    const generation = ++loadGeneration.current;
    api
      .conversations()
      .then((result) => {
        if (generation !== loadGeneration.current) return;
        setItems(result.conversations);
      })
      .catch((loadError) => {
        if (generation !== loadGeneration.current) return;
        console.error("Failed to load chat history", loadError);
        setError(loadError instanceof ApiError ? loadError.message : "Chat history could not be loaded.");
      });
  };

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener(CONVERSATIONS_CHANGED, onChange);
    return () => {
      window.removeEventListener(CONVERSATIONS_CHANGED, onChange);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!menuId) return;
    const onPointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuId(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuId(null);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuId]);

  const saveRename = async (id: string) => {
    const title = renameValue.trim();
    if (!title) return;
    try {
      await api.renameConversation(id, title);
      setRenameId(null);
      setMenuId(null);
      notifyConversationsChanged();
      load();
    } catch (renameError) {
      console.error("Failed to rename conversation", renameError);
      setError(renameError instanceof ApiError ? renameError.message : "Could not rename that chat.");
    }
  };

  const openDeleteConfirm = (item: Conversation) => {
    setMenuId(null);
    setPendingDelete(item);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    const target = pendingDelete;
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      await api.deleteConversation(target.id);
      // Invalidate in-flight list fetches so a stale response cannot restore the deleted chat.
      loadGeneration.current += 1;
      setItems((current) => current.filter((item) => item.id !== target.id));
      setPendingDelete(null);
      setMenuId(null);
      setNotice(`Deleted “${target.title}”.`);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(""), 2800);
      if (activeId === target.id) navigate("/app/chat", { replace: true });
      notifyConversationsChanged();
    } catch (deleteError) {
      console.error("Failed to delete conversation", deleteError);
      setError(deleteError instanceof ApiError ? deleteError.message : "Could not delete that chat.");
    } finally {
      setDeleting(false);
    }
  };

  if (compact) {
    return (
      <div className="mt-3 px-2">
        <p className="sr-only">Chat history</p>
        <ul className="max-h-48 space-y-1 overflow-auto">
          {filtered.slice(0, 12).map((item) => {
            const current = item.id === activeId;
            return (
              <li key={item.id} className="relative">
                <div className="flex flex-col items-center gap-0.5">
                  <Link
                    to={`/app/chat/${item.id}`}
                    title={item.title}
                    className={`grid h-9 w-9 place-items-center rounded-xl text-xs ${current ? "bg-accent-soft text-accent" : "text-soft hover:bg-muted"}`}
                  >
                    {item.title.slice(0, 1).toUpperCase()}
                  </Link>
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-lg text-soft hover:bg-muted hover:text-accent"
                    aria-label={`Delete ${item.title}`}
                    title="Delete chat"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openDeleteConfirm(item);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {pendingDelete ? (
          <ConfirmDialog
            title="Delete this conversation?"
            body={`“${pendingDelete.title}” and its messages will be permanently removed. Other chats stay saved.`}
            confirmLabel="Delete forever"
            busy={deleting}
            onClose={() => {
              if (!deleting) setPendingDelete(null);
            }}
            onConfirm={() => {
              void confirmDelete();
            }}
          />
        ) : null}
        {error ? <p className="mt-2 px-1 text-[10px] text-accent">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-3 pt-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-soft">Chats</p>
        <Link to="/app/conversations" className="text-[11px] font-semibold text-accent">
          All
        </Link>
      </div>
      <label className="mt-2 block px-0.5">
        <span className="sr-only">Search chats</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chats…"
          className="w-full rounded-xl border border-line bg-bg/70 px-2.5 py-1.5 text-xs text-ink outline-none transition focus:border-accent"
        />
      </label>
      {error ? <p className="mt-2 px-1 text-xs text-accent">{error}</p> : null}
      {notice ? <p className="mt-2 px-1 text-xs text-leaf">{notice}</p> : null}
      {items.length === 0 ? <p className="mt-3 px-1 text-xs leading-5 text-soft">Saved chats appear here after Gemini replies.</p> : null}
      {items.length > 0 && filtered.length === 0 ? (
        <p className="mt-3 px-1 text-xs leading-5 text-soft">No chats match “{query.trim()}”.</p>
      ) : null}
      <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-auto pb-2">
        {filtered.map((item) => {
          const current = item.id === activeId;
          const renaming = renameId === item.id;
          return (
            <li key={item.id} className="relative">
              {renaming ? (
                <form
                  className="rounded-2xl border border-accent bg-muted p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveRename(item.id);
                  }}
                >
                  <input
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    className="w-full rounded-xl border border-line bg-bg px-2 py-1.5 text-sm outline-none"
                    maxLength={80}
                    autoFocus
                    aria-label="Conversation title"
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="submit" className="text-xs font-semibold text-accent">
                      Save
                    </button>
                    <button type="button" className="text-xs font-semibold text-soft" onClick={() => setRenameId(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="group sidebar-chat-card flex items-start gap-0.5" data-active={current ? "true" : "false"}>
                  <Link to={`/app/chat/${item.id}`} className="min-w-0 flex-1 px-3 py-2.5" title={item.title} aria-label={item.title}>
                    <p className={`truncate text-sm ${current ? "font-semibold text-ink" : "text-ink"}`}>{item.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-soft">
                      {formatChatTime(item.updatedAt)}
                      {item.preview ? ` · ${item.preview}` : ""}
                    </p>
                  </Link>
                  <button
                    type="button"
                    className="mt-1 mr-1 rounded-lg p-1.5 text-soft hover:bg-bg hover:text-ink"
                    aria-label={`Chat options for ${item.title}`}
                    title="Chat options"
                    aria-expanded={menuId === item.id}
                    aria-haspopup="menu"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setMenuId((currentMenu) => (currentMenu === item.id ? null : item.id));
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              )}
              {menuId === item.id && !renaming ? (
                <div
                  ref={menuRef}
                  role="menu"
                  className="absolute right-2 top-10 z-30 min-w-36 rounded-2xl border border-line bg-elevated p-1 shadow-[var(--shadow)]"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs hover:bg-muted"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setRenameId(item.id);
                      setRenameValue(item.title);
                      setMenuId(null);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Rename
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-accent hover:bg-muted"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openDeleteConfirm(item);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this conversation?"
          body={`“${pendingDelete.title}” and its messages will be permanently removed. Other chats stay saved.`}
          confirmLabel="Delete forever"
          busy={deleting}
          onClose={() => {
            if (!deleting) setPendingDelete(null);
          }}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      ) : null}
    </div>
  );
}
