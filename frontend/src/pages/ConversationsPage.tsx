import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { formatChatTime, notifyConversationsChanged } from "@/lib/conversations";
import type { Conversation } from "@/lib/types";
import { Alert, Button, ConfirmDialog, EmptyState, PageHeader, TextInput } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function ConversationsPage() {
  useDocumentTitle("Conversations");
  const [items, setItems] = useState<Conversation[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Conversation | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const load = () => {
    api
      .conversations()
      .then((result) => setItems(result.conversations))
      .catch((loadError) => {
        console.error("Failed to load conversations", loadError);
        setError(loadError instanceof ApiError ? loadError.message : "Conversations could not be loaded.");
      });
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader eyebrow="Yours only" title="Conversations" body="Chats stay on your account. Other people cannot open them. New Chat never deletes old threads." />
      {error ? <Alert>{error}</Alert> : null}
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
          body="Only this chat and its messages are removed. Other chats stay saved."
          confirmLabel="Delete"
          onClose={() => setPending(null)}
          onConfirm={() => {
            void api
              .deleteConversation(pending.id)
              .then(() => {
                notifyConversationsChanged();
                load();
              })
              .catch((deleteError) => {
                console.error("Failed to delete conversation", deleteError);
                setError(deleteError instanceof ApiError ? deleteError.message : "Could not delete that conversation.");
              });
            setPending(null);
          }}
        />
      ) : null}
    </div>
  );
}
