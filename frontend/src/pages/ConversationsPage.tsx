import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { CONVERSATIONS_CHANGED, formatChatTime, notifyConversationsChanged } from "@/lib/conversations";
import type { Conversation } from "@/lib/types";
import { Alert, Button, ConfirmDialog, EmptyState, PageHeader, TextInput } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

function activeConversationId(pathname: string): string {
  if (!pathname.startsWith("/app/chat/")) return "";
  const rest = pathname.slice("/app/chat/".length);
  return rest.split(/[/?#]/)[0] ?? "";
}

export function ConversationsPage() {
  useDocumentTitle("Conversations");
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<Conversation[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const loadGeneration = useRef(0);

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
        console.error("Failed to load conversations", loadError);
        setError(loadError instanceof ApiError ? loadError.message : "Conversations could not be loaded.");
      });
  };

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener(CONVERSATIONS_CHANGED, onChange);
    return () => window.removeEventListener(CONVERSATIONS_CHANGED, onChange);
  }, []);

  const confirmDelete = async () => {
    if (!pending || deleting) return;
    const target = pending;
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      await api.deleteConversation(target.id);
      loadGeneration.current += 1;
      setItems((current) => current.filter((item) => item.id !== target.id));
      setPending(null);
      setNotice(`Deleted “${target.title}”.`);
      if (activeConversationId(location.pathname) === target.id) {
        navigate("/app/chat", { replace: true });
      }
      notifyConversationsChanged();
    } catch (deleteError) {
      console.error("Failed to delete conversation", deleteError);
      setError(deleteError instanceof ApiError ? deleteError.message : "Could not delete that conversation.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader eyebrow="Yours only" title="Conversations" body="Chats stay on your account. Other people cannot open them. New Chat never deletes old threads." />
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <p className="mb-4 text-sm text-leaf">{notice}</p> : null}
      {items.length === 0 ? (
        <EmptyState title="No threads yet" body="A conversation is saved after Gemini replies." action={<Link to="/app/chat" className="text-sm text-accent">New chat</Link>} />
      ) : (
        <ul className="panel divide-y divide-line overflow-hidden">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 bg-elevated px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              {renameId === item.id ? (
                <form
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const title = renameValue.trim();
                    if (!title) return;
                    void api
                      .renameConversation(item.id, title)
                      .then(() => {
                        setRenameId(null);
                        notifyConversationsChanged();
                        load();
                      })
                      .catch((renameError) => {
                        console.error("Failed to rename conversation", renameError);
                        setError(renameError instanceof ApiError ? renameError.message : "Could not rename that conversation.");
                      });
                  }}
                >
                  <TextInput value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={80} className="max-w-md" />
                  <Button type="submit">Save</Button>
                  <Button type="button" variant="ghost" onClick={() => setRenameId(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <Link to={`/app/chat/${item.id}`} className="min-w-0">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-soft">
                    {formatChatTime(item.updatedAt)}
                    {item.preview ? ` · ${item.preview}` : ""}
                  </p>
                </Link>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setRenameId(item.id);
                    setRenameValue(item.title);
                  }}
                >
                  Rename
                </Button>
                <Button variant="danger" type="button" onClick={() => setPending(item)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {pending ? (
        <ConfirmDialog
          title="Delete this conversation?"
          body={`“${pending.title}” and its messages will be permanently removed. Other chats stay saved.`}
          confirmLabel="Delete forever"
          busy={deleting}
          onClose={() => {
            if (!deleting) setPending(null);
          }}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      ) : null}
    </div>
  );
}
