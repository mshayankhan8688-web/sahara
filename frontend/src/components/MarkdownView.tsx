import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

function sanitizeUrl(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[2] && match[3]) {
      const safe = sanitizeUrl(match[3]);
      if (safe) {
        nodes.push(
          <a key={`${keyPrefix}-a-${index}`} href={safe} target="_blank" rel="noreferrer noopener" className="font-semibold text-accent underline underline-offset-2">
            {match[2]}
          </a>,
        );
      } else {
        nodes.push(match[2]);
      }
    } else if (match[4]) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold">
          {match[4]}
        </strong>,
      );
    } else if (match[5]) {
      nodes.push(
        <em key={`${keyPrefix}-i-${index}`} className="italic">
          {match[5]}
        </em>,
      );
    } else if (match[6]) {
      nodes.push(
        <code key={`${keyPrefix}-c-${index}`} className="rounded bg-bg/80 px-1 py-0.5 text-[0.85em]">
          {match[6]}
        </code>,
      );
    }
    last = match.index + match[0].length;
    index += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function CodeBlock({ raw }: { raw: string }) {
  const languageMatch = raw.match(/^([a-zA-Z0-9+-]+)\n/);
  const language = languageMatch?.[1] ?? "code";
  const code = languageMatch ? raw.slice(languageMatch[0].length) : raw.replace(/^\n/, "");
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-block my-3" dir="ltr">
      <div className="code-block-bar">
        <span>{language}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 font-semibold normal-case tracking-normal text-soft transition hover:bg-muted hover:text-ink"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            } catch (error) {
              console.error("Code copy failed", error);
            }
          }}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderBlocks(text: string, keyPrefix: string): ReactNode {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list || list.items.length === 0) {
      list = null;
      return;
    }
    const Tag = list.ordered ? "ol" : "ul";
    const className = list.ordered ? "my-2 list-decimal space-y-1 pl-5" : "my-2 list-disc space-y-1 pl-5";
    blocks.push(
      <Tag key={`${keyPrefix}-list-${blocks.length}`} className={className}>
        {list.items.map((item, index) => (
          <li key={`${keyPrefix}-li-${index}`}>{renderInline(item, `${keyPrefix}-li-${index}`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unordered?.[1] || ordered?.[1]) {
      const orderedList = Boolean(ordered);
      if (!list || list.ordered !== orderedList) {
        flushList();
        list = { ordered: orderedList, items: [] };
      }
      list.items.push((unordered?.[1] ?? ordered?.[1] ?? "").trim());
      return;
    }
    flushList();
    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={`${keyPrefix}-hr-${index}`} className="my-4 border-line" />);
      return;
    }
    if (/^###\s+/.test(trimmed)) {
      blocks.push(
        <h4 key={`${keyPrefix}-h3-${index}`} className="mt-4 font-serif text-base font-semibold text-ink">
          {renderInline(trimmed.replace(/^###\s+/, ""), `${keyPrefix}-h3-${index}`)}
        </h4>,
      );
      return;
    }
    if (/^##\s+/.test(trimmed)) {
      blocks.push(
        <h3 key={`${keyPrefix}-h2-${index}`} className="mt-4 font-serif text-lg font-semibold text-accent">
          {renderInline(trimmed.replace(/^##\s+/, ""), `${keyPrefix}-h2-${index}`)}
        </h3>,
      );
      return;
    }
    if (/^#\s+/.test(trimmed)) {
      blocks.push(
        <h2 key={`${keyPrefix}-h1-${index}`} className="mt-3 font-serif text-xl font-semibold text-ink sm:text-2xl">
          {renderInline(trimmed.replace(/^#\s+/, ""), `${keyPrefix}-h1-${index}`)}
        </h2>,
      );
      return;
    }
    if (!trimmed) {
      blocks.push(<div key={`${keyPrefix}-sp-${index}`} className="h-2" />);
      return;
    }
    blocks.push(
      <p key={`${keyPrefix}-p-${index}`} className="my-2 text-sm leading-7 text-ink">
        {renderInline(line, `${keyPrefix}-p-${index}`)}
      </p>,
    );
  });
  flushList();
  return <>{blocks}</>;
}

/** Safe Markdown → React (no raw HTML injection). */
export function MarkdownView({ content, className = "" }: { content: string; className?: string }) {
  const parts = content.replace(/\r\n/g, "\n").split("```");
  return (
    <div className={`markdown-view ${className}`}>
      {parts.map((part, index) =>
        index % 2 === 1 ? <CodeBlock key={index} raw={part} /> : part ? <div key={index}>{renderBlocks(part, `part-${index}`)}</div> : null,
      )}
    </div>
  );
}
