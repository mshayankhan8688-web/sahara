import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { CONVERSATIONS_CHANGED, formatChatTime, notifyConversationsChanged } from "@/lib/conversations";
import type { Conversation } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui";

export function ChatHistory({ compact = false }: { compact?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<Conversation[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const filtered = items.filter((item) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${item.title} ${item.preview ?? ""}`.toLowerCase().includes(needle);
  });

  const activeId = location.pathname.startsWith("/app/chat/") ? location.pathname.slice("/app/chat/".length) : "";

  const load = () => {
    api
      .conversations()
      .then((result) => setItems(result.conversations))
      .catch((loadError) => {
        console.error("Failed to load chat history", loadError);
        setError(loadError instanceof ApiError ? loadError.message : "Chat history could not be loaded.");
      });
  };

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener(CONVERSATIONS_CHANGED, onChange);
    return () => window.removeEventListener(CONVERSATIONS_CHANGED, onChange);
  }, []);

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

  if (compact) {
    return (
      <div className="mt-3 px-2">
        <p className="sr-only">Chat history</p>
        <ul className="max-h-48 space-y-1 overflow-auto">
          {filtered.slice(0, 12).map((item) => {
            const current = item.id === activeId;
            return (
              <li key={item.id}>
                <Link
                  to={`/app/chat/${item.id}`}
                  title={item.title}
                  className={`grid h-9 place-items-center rounded-xl text-xs ${current ? "bg-accent-soft text-accent" : "text-soft hover:bg-muted"}`}
                >
                  {item.title.slice(0, 1).toUpperCase()}
                </Link>
              </li>
            );
          })}
        </ul>
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
                <div className={`group flex items-start gap-1 rounded-2xl ${current ? "bg-accent-soft" : "hover:bg-muted"}`}>
                  <Link to={`/app/chat/${item.id}`} className="min-w-0 flex-1 px-3 py-2">
                    <p className={`truncate text-sm ${current ? "font-semibold text-ink" : "text-ink"}`}>{item.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-soft">
                      {formatChatTime(item.updatedAt)}
                      {item.preview ? ` · ${item.preview}` : ""}
                    </p>
                  </Link>
                  <button
                    type="button"
                    className="mt-1 mr-1 rounded-lg p-1.5 text-soft opacity-70 hover:bg-bg hover:text-ink group-hover:opacity-100"
                    aria-label={`Chat options for ${item.title}`}
                    onClick={() => setMenuId((currentMenu) => (currentMenu === item.id ? null : item.id))}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              )}
              {menuId === item.id && !renaming ? (
                <div className="absolute right-2 top-10 z-20 min-w-36 rounded-2xl border border-line bg-elevated p-1 shadow-[var(--shadow)]">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs hover:bg-muted"
                    onClick={() => {
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
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-accent hover:bg-muted"
                    onClick={() => {
                      setPendingDelete(item);
                      setMenuId(null);
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
          body="Only this chat and its messages are removed. Other chats stay saved."
          confirmLabel="Delete"
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            const id = pendingDelete.id;
            setPendingDelete(null);
            void api
              .deleteConversation(id)
              .then(() => {
                notifyConversationsChanged();
                load();
                if (activeId === id) navigate("/app/chat");
              })
              .catch((deleteError) => {
                console.error("Failed to delete conversation", deleteError);
                setError(deleteError instanceof ApiError ? deleteError.message : "Could not delete that chat.");
              });
          }}
        />
      ) : null}
    </div>
  );
}
