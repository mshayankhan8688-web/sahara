import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { Conversation } from "@/lib/types";
import { Alert, Button, ConfirmDialog, EmptyState, PageHeader } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function ConversationsPage() {
  useDocumentTitle("Conversations");
  const [items, setItems] = useState<Conversation[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Conversation | null>(null);

  const load = () => {
    api.conversations().then((result) => setItems(result.conversations)).catch((loadError) => {
      console.error("Failed to load conversations", loadError);
      setError(loadError instanceof ApiError ? loadError.message : "Conversations could not be loaded.");
    });
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader eyebrow="Yours only" title="Conversations" body="Other accounts cannot open these threads." />
      {error ? <Alert>{error}</Alert> : null}
      {items.length === 0 ? (
        <EmptyState title="No threads yet" body="A conversation is saved after Gemini replies." action={<Link to="/app/chat" className="text-sm text-accent">New chat</Link>} />
      ) : (
        <ul className="panel divide-y divide-line overflow-hidden">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 bg-elevated px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <Link to={`/app/chat/${item.id}`}>
                <p className="text-sm">{item.title}</p>
                <p className="text-xs text-soft">{new Date(item.updatedAt).toLocaleString()}</p>
              </Link>
              <Button variant="danger" type="button" onClick={() => setPending(item)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
      {pending ? (
        <ConfirmDialog
          title="Delete this conversation?"
          body="The messages are removed from your account."
          confirmLabel="Delete"
          onClose={() => setPending(null)}
          onConfirm={() => {
            void api.deleteConversation(pending.id).then(load).catch((deleteError) => {
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
