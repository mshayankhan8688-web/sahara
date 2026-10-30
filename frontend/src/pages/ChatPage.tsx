import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Check,
  Copy,
  Download,
  FileText,
  GraduationCap,
  HeartHandshake,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  Paperclip,
  PenLine,
  Presentation,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Star,
} from "lucide-react";
import { ReplyLanguageSelect } from "@/components/ReplyLanguageSelect";
import { CompanionAvatar, companionGreeting } from "@/components/CompanionAvatar";
import { SaharaOrb } from "@/components/SaharaOrb";
import { SafaPortrait } from "@/components/SafaPortrait";
import { api, ApiError } from "@/lib/api";
import {
  COMPANIONS_CHANGED,
  companionAppearanceOf,
  readStoredCompanionId,
  writeStoredCompanionId,
} from "@/lib/companions";
import { downloadBase64File, MODE_META, presentationFromMarkdown, type ChatMode } from "@/lib/modes";
import { readReplyLanguage, speechCode, writeReplyLanguage, type ReplyLanguage } from "@/lib/replyLanguage";
import { pickVoice, preferredLangs, speechScript } from "@/lib/speech";
import type { ChatMessage, Companion } from "@/lib/types";
import { AiMark, Alert, Button } from "@/components/ui";
import { notifyConversationsChanged } from "@/lib/conversations";
import { notifyUsageChanged } from "@/components/UsageMeter";
import { MarkdownView } from "@/components/MarkdownView";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const starters = [
  "I'm feeling lonely.",
  "I'm overthinking.",
  "Help me study.",
  "Write something for me.",
  "How to stay motivated?",
  "Just chat.",
];

const MODE_ICONS: Record<ChatMode, typeof MessageCircle> = {
  general: MessageCircle,
  study: GraduationCap,
  assignment: BookOpen,
  ppt: Presentation,
  document: FileText,
  exam: BookOpen,
  emotion: HeartHandshake,
  writing: PenLine,
  image: ImageIcon,
};

const fileTypes: Record<string, string> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
  "application/pdf": "application/pdf",
  "text/plain": "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type PendingFile = { name: string; mimeType: string; data: string };

function fileMime(file: File): string {
  if (fileTypes[file.type]) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "pdf") return "application/pdf";
  if (extension === "txt") return "text/plain";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "";
}

function isChatMode(value: string | null): value is ChatMode {
  return Boolean(value && MODE_META.some((item) => item.id === value));
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageText({ content }: { content: string }) {
  const script = speechScript(content);
  const rtl = script === "urdu" || script === "arabic";
  return (
    <div dir={rtl ? "rtl" : "ltr"} lang={script === "urdu" ? "ur" : script === "arabic" ? "ar" : undefined} className={rtl ? "font-arabic text-right" : ""}>
      <MarkdownView content={content} />
    </div>
  );
}

function FileChip({ attachment }: { attachment: { name: string; mimeType: string; data: string } }) {
  const href = `data:${attachment.mimeType};base64,${attachment.data}`;
  if (attachment.mimeType.startsWith("image/") || attachment.mimeType === "image/svg+xml") {
    return (
      <div className="mt-3 space-y-2">
        <img src={href} alt={attachment.name} className="max-h-80 w-full rounded-2xl border border-line/50 object-contain bg-black/20" />
        <a
          href={href}
          download={attachment.name}
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent underline-offset-2 hover:underline"
        >
          Download {attachment.name}
        </a>
      </div>
    );
  }
  return (
    <a href={href} download={attachment.name} className="mt-2 inline-flex text-xs font-semibold underline">
      {attachment.name}
    </a>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-xs font-semibold text-soft transition hover:text-ink"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch (copyError) {
          console.error("Copy failed", copyError);
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function ChatPage() {
  useDocumentTitle("Chat");
  const { conversationId } = useParams();
  const [params] = useSearchParams();
  const journalId = params.get("journal") ?? undefined;
  const navigate = useNavigate();
  const [companionId, setCompanionId] = useState("");
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [chatTitle, setChatTitle] = useState("New chat");
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<PendingFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(() => localStorage.getItem("sahara.speak") === "1");
  const [speechRate, setSpeechRate] = useState(1);
  const [voiceLang, setVoiceLang] = useState("en-US");
  const [replyLanguage, setReplyLanguage] = useState<ReplyLanguage>(() => readReplyLanguage());
  const [mode, setMode] = useState<ChatMode>(() => {
    const fromQuery = params.get("mode");
    return isChatMode(fromQuery) ? fromQuery : "general";
  });
  const [imageAction, setImageAction] = useState<"generate" | "edit" | "diagram">("generate");
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [voiceNote, setVoiceNote] = useState("");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sending = useRef(false);
  const heard = useRef("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speakToken = useRef(0);

  const companionName = companion?.name?.trim() || "Safa";
  const companionAppearance = companionAppearanceOf(companion);
  const useSafaPortrait = companionAppearance === "female";
  const greeting = companionGreeting(companionName, companionAppearance);
  const portraitMood = pending ? "thinking" : listening ? "listening" : speakingId ? "speaking" : "idle";

  const stopSpeaking = () => {
    speakToken.current += 1;
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;
    setSpeakingId(null);
    setVoiceNote("");
  };

  const speak = (text: string, messageId: string) => {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      setVoiceNote("This browser cannot read replies aloud. The text is still on the page.");
      return;
    }
    const token = speakToken.current + 1;
    speakToken.current = token;
    synth.cancel();
    const script = speechScript(text);
    const langs = preferredLangs(script, voiceLang);
    const start = (voices: SpeechSynthesisVoice[]) => {
      if (token !== speakToken.current) return;
      const voice = pickVoice(voices, langs);
      if (!voice && script !== "latin") {
        setSpeakingId(null);
        setVoiceNote("This browser has no voice for that language. The reply is still on the page.");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = langs[0] ?? "en-US";
      }
      utterance.rate = speechRate;
      utterance.onstart = () => {
        if (token !== speakToken.current) return;
        setSpeakingId(messageId);
        setVoiceNote("Reading the reply aloud.");
      };
      utterance.onend = () => {
        if (token !== speakToken.current) return;
        utteranceRef.current = null;
        setSpeakingId(null);
        setVoiceNote("");
      };
      utterance.onerror = (event) => {
        if (token !== speakToken.current) return;
        utteranceRef.current = null;
        setSpeakingId(null);
        if (event.error === "canceled" || event.error === "interrupted") return;
        console.error("Speech failed", event.error);
        setVoiceNote("This browser could not read that reply aloud. The text is still on the page.");
      };
      window.setTimeout(() => {
        if (token !== speakToken.current) return;
        try {
          synth.speak(utterance);
        } catch (speechError) {
          console.error("Speech did not start", speechError);
          setSpeakingId(null);
          setVoiceNote("This browser could not read that reply aloud. The text is still on the page.");
        }
      }, 50);
    };
    const voices = synth.getVoices();
    if (voices.length > 0) {
      start(voices);
      return;
    }
    let started = false;
    const onVoices = () => {
      if (started || token !== speakToken.current) return;
      started = true;
      synth.removeEventListener("voiceschanged", onVoices);
      start(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", onVoices);
    window.setTimeout(() => onVoices(), 400);
  };

  const listen = () => {
    const BrowserSpeech = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!BrowserSpeech) {
      setVoiceNote("This browser cannot listen. You can still type.");
      return;
    }
    const recognition = new BrowserSpeech();
    recognitionRef.current = recognition;
    recognition.lang = voiceLang;
    recognition.interimResults = true;
    recognition.continuous = false;
    heard.current = draft;
    recognition.onresult = (event) => {
      const said = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setDraft(`${heard.current} ${said}`.trim());
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed") {
        setVoiceNote("Microphone permission was denied. Allow the microphone in the browser, or type instead.");
        return;
      }
      if (event.error === "no-speech") {
        setVoiceNote("No speech was heard. Try again, or type the message.");
        return;
      }
      setVoiceNote("The microphone did not catch that. Check permission, then try again.");
    };
    recognition.onend = () => setListening(false);
    setVoiceNote("Listening. You can edit the words before sending.");
    setListening(true);
    try {
      recognition.start();
    } catch (startError) {
      console.error("Speech recognition did not start", startError);
      setListening(false);
      setVoiceNote("The microphone is already in use, or this browser blocked it. You can still type.");
    }
  };

  useEffect(() => {
    const loadCompanions = () => {
      api
        .companions()
        .then((result) => {
          const list = result.companions;
          const saved = readStoredCompanionId();
          const savedMatch = list.find((item) => item.id === saved);
          // Honor explicit selection / default; otherwise fall back to Safa, then first companion.
          const safa = list.find((item) => item.name.trim().toLowerCase() === "safa");
          const fallback = savedMatch ?? list.find((item) => item.isDefault) ?? safa ?? list[0];
          if (fallback) {
            setCompanionId(fallback.id);
            setCompanion(fallback);
            writeStoredCompanionId(fallback.id);
          }
        })
        .catch((loadError) => {
          console.error("Failed to load companions", loadError);
          setError(loadError instanceof ApiError ? loadError.message : "Companions could not be loaded.");
        });
    };
    loadCompanions();
    window.addEventListener(COMPANIONS_CHANGED, loadCompanions);
    return () => window.removeEventListener(COMPANIONS_CHANGED, loadCompanions);
  }, []);

  useEffect(() => {
    api
      .favorites()
      .then((result) => setFavoriteIds(new Set(result.favorites.map((item) => item.messageId))))
      .catch((loadError) => {
        console.error("Failed to load favorites", loadError);
      });
  }, []);

  useEffect(() => {
    setError("");
  }, [mode, imageAction]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    if (!conversationId) {
      setMessages([]);
      setChatTitle("New chat");
      setDraft("");
      setFile(null);
      setError("");
      setPending(false);
      sending.current = false;
      return () => {
        cancelled = true;
      };
    }
    api
      .conversation(conversationId)
      .then((result) => {
        if (cancelled) return;
        setMessages(result.messages);
        setChatTitle(result.conversation.title || "Chat");
        setRenameDraft(result.conversation.title || "Chat");
        // Keep AI companion header stable from the user's selected/default companion.
        // Opening an old thread must not switch the header to Rayyan or rename the companion.
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("Failed to load conversation", loadError);
        setError(loadError instanceof ApiError ? loadError.message : "That conversation could not be opened.");
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    const starter = params.get("prompt");
    if (!starter || conversationId) return;
    setDraft((current) => current || starter.slice(0, 2000));
  }, [conversationId, params]);

  useEffect(() => {
    const fromQuery = params.get("mode");
    if (isChatMode(fromQuery)) setMode(fromQuery);
  }, [params]);

  useEffect(() => {
    if (params.get("voice") === "1") listen();
    // The voice shortcut should start one listening session when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, voiceNote]);

  const chooseFile = async (list: FileList | null) => {
    const next = list?.[0];
    if (!next) return;
    const mimeType = fileMime(next);
    if (!mimeType) {
      setError("Attach a JPEG, PNG, WebP, GIF, PDF, Word (.docx), or text file.");
      return;
    }
    if (next.size > 3 * 1024 * 1024) {
      setError("Each file must be 3 MB or smaller.");
      return;
    }
    const dataUrl = await next.arrayBuffer();
    const bytes = new Uint8Array(dataUrl);
    let binary = "";
    bytes.forEach((value) => {
      binary += String.fromCharCode(value);
    });
    setError("");
    setFile({ name: next.name, mimeType, data: btoa(binary) });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatImageError = (sendError: unknown): string => {
    if (!(sendError instanceof ApiError)) return "The message could not be sent.";
    if (sendError.code === "IMAGE_QUOTA") {
      return "Image generation is out of quota on this API key (often only a few free images per day). Text chat still works. Try Diagram for labeled study charts, or retry later.";
    }
    if (sendError.code === "AI_NOT_CONFIGURED" || sendError.code === "IMAGE_MODEL_UNAVAILABLE") {
      return sendError.message;
    }
    return sendError.message;
  };

  const send = async (override?: {
    content?: string;
    attachment?: PendingFile | null;
    regenerateOfMessageId?: string;
  }) => {
    const content = (override?.content ?? draft).trim();
    const attachment = override && "attachment" in override ? override.attachment : file;
    const regenerateOfMessageId = override?.regenerateOfMessageId;
    if ((!content && !attachment && !regenerateOfMessageId) || pending || sending.current) return;
    if (!regenerateOfMessageId && mode === "image" && imageAction === "edit" && !attachment) {
      setError("Attach an image to edit, then describe the change.");
      return;
    }
    if (!regenerateOfMessageId && mode === "image" && imageAction !== "edit" && !content) {
      setError("Describe the image or diagram you want.");
      return;
    }
    sending.current = true;
    const optimisticId = `local-${Date.now()}`;
    setPending(true);
    setError("");
    if (!override) {
      setDraft("");
      setFile(null);
    }
    stopSpeaking();
    if (regenerateOfMessageId) {
      setMessages((current) => current.filter((message) => message.id !== regenerateOfMessageId));
    } else {
      setMessages((current) => [
        ...current,
        {
          id: optimisticId,
          sender: "user",
          kind: "ai",
          content: content || `Attached ${attachment?.name ?? "file"}`,
          attachment: attachment ?? undefined,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    try {
      const result =
        !regenerateOfMessageId && mode === "image"
          ? imageAction === "edit" && attachment
            ? await api.editImage({ conversationId, companionId, prompt: content || "Improve this image.", image: attachment })
            : imageAction === "diagram"
              ? await api.generateDiagram({ conversationId, companionId, prompt: content })
              : await api.generateImage({
                  conversationId,
                  companionId,
                  prompt: content,
                  purpose: /ppt|presentation|slide/i.test(content) ? "presentation" : /poster/i.test(content) ? "poster" : /diagram|biology|network|uml|study/i.test(content) ? "study" : "general",
                })
          : await api.sendMessage({
              conversationId,
              companionId,
              content,
              attachment: attachment ?? undefined,
              journalId: regenerateOfMessageId ? undefined : journalId,
              replyLanguage,
              mode,
              regenerateOfMessageId,
            });
      setMessages((current) => {
        const withoutOptimistic = current.filter((message) => message.id !== optimisticId);
        const replacedId = regenerateOfMessageId ?? ("replacedMessageId" in result ? result.replacedMessageId : undefined);
        if (replacedId) {
          const withoutOld = withoutOptimistic.filter((message) => message.id !== replacedId);
          const withoutDupUser = withoutOld.some((message) => message.id === result.userMessage.id)
            ? withoutOld
            : [...withoutOld, result.userMessage];
          return [...withoutDupUser.filter((message) => message.id !== result.assistantMessage.id), result.assistantMessage];
        }
        return [...withoutOptimistic, result.userMessage, result.assistantMessage];
      });
      setChatTitle(result.conversation.title || "Chat");
      setRenameDraft(result.conversation.title || "Chat");
      notifyConversationsChanged();
      notifyUsageChanged();
      const nextId = result.conversation.id;
      if (speakOn && mode !== "image") speak(result.assistantMessage.content, result.assistantMessage.id);
      if (!conversationId || journalId) navigate(`/app/chat/${nextId}`, { replace: true });
    } catch (sendError) {
      console.error("Chat failed", sendError);
      if (regenerateOfMessageId && conversationId) {
        try {
          const restored = await api.conversation(conversationId);
          setMessages(restored.messages);
        } catch (restoreError) {
          console.error("Failed to restore conversation after regenerate error", restoreError);
          setMessages((current) => current.filter((message) => message.id !== optimisticId));
        }
      } else {
        setMessages((current) => current.filter((message) => message.id !== optimisticId));
        setDraft(content);
        setFile(attachment ?? null);
      }
      setError(mode === "image" ? formatImageError(sendError) : sendError instanceof ApiError ? sendError.message : "The message could not be sent.");
    } finally {
      sending.current = false;
      setPending(false);
    }
  };

  const regenerateLast = () => {
    const lastAssistant = [...messages].reverse().find((message) => message.sender === "assistant" && message.kind === "ai");
    const lastUser = [...messages].reverse().find((message) => message.sender === "user");
    if (!lastAssistant || !lastUser || pending || lastAssistant.id.startsWith("local-")) return;
    void send({
      content: lastUser.content,
      attachment: lastUser.attachment
        ? { name: lastUser.attachment.name, mimeType: lastUser.attachment.mimeType, data: lastUser.attachment.data }
        : null,
      regenerateOfMessageId: lastAssistant.id,
    });
  };

  const saveTitle = async () => {
    if (!conversationId) {
      setRenaming(false);
      return;
    }
    const next = renameDraft.trim().slice(0, 80);
    if (!next || next === chatTitle) {
      setRenaming(false);
      setRenameDraft(chatTitle);
      return;
    }
    try {
      const result = await api.renameConversation(conversationId, next);
      setChatTitle(result.conversation.title);
      setRenameDraft(result.conversation.title);
      setRenaming(false);
      notifyConversationsChanged();
    } catch (renameError) {
      console.error("Rename failed", renameError);
      setError(renameError instanceof ApiError ? renameError.message : "Could not rename that chat.");
      setRenaming(false);
      setRenameDraft(chatTitle);
    }
  };

  const toggleFavorite = async (message: ChatMessage) => {
    if (!conversationId || message.sender !== "assistant" || message.id.startsWith("local-")) return;
    const starred = favoriteIds.has(message.id);
    try {
      if (starred) {
        await api.removeFavorite(message.id);
        setFavoriteIds((current) => {
          const next = new Set(current);
          next.delete(message.id);
          return next;
        });
      } else {
        await api.addFavorite({ messageId: message.id, conversationId, content: message.content.slice(0, 4000) });
        setFavoriteIds((current) => new Set(current).add(message.id));
      }
    } catch (favoriteError) {
      console.error("Favorite failed", favoriteError);
      setError(favoriteError instanceof ApiError ? favoriteError.message : "Could not update favorites.");
    }
  };

  const lastAssistantId = [...messages].reverse().find((message) => message.sender === "assistant" && message.kind === "ai")?.id;

  const headerStatus = pending ? "Thinking…" : listening ? "Listening…" : speakingId ? "Speaking…" : "Online";

  return (
    <section className="chat-shell flex h-full min-h-0 flex-col">
      <header className="chat-header flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative hidden sm:block">
            {useSafaPortrait ? (
              <SafaPortrait className="h-12 w-12" mood={portraitMood} />
            ) : (
              <CompanionAvatar appearance={companionAppearance} name={companionName} className="h-12 w-12" mood={portraitMood} />
            )}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-elevated bg-leaf" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate font-serif text-xl leading-none text-ink sm:text-2xl">{companionName}</p>
              <AiMark />
              <span className="rounded-full bg-lavender-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-lavender">
                {headerStatus}
              </span>
            </div>
            <p className="mt-1 text-xs text-soft">Your AI Companion</p>
            {renaming ? (
              <form
                className="mt-1 flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveTitle();
                }}
              >
                <input
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  className="min-w-0 flex-1 rounded-full border border-line bg-muted px-3 py-1 text-xs text-ink"
                  maxLength={80}
                  aria-label="Conversation title"
                  autoFocus
                />
                <button type="submit" className="text-xs font-semibold text-accent">
                  Save
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-soft"
                  onClick={() => {
                    setRenaming(false);
                    setRenameDraft(chatTitle);
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                <h1 className="chat-title truncate text-[11px] font-medium text-soft/80" title={chatTitle}>
                  {chatTitle}
                </h1>
                {conversationId ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-soft transition hover:text-ink"
                    onClick={() => {
                      setRenameDraft(chatTitle);
                      setRenaming(true);
                    }}
                    aria-label="Rename conversation"
                  >
                    <Pencil className="h-3 w-3" />
                    Rename
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link to="/app/chat" className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold transition hover:border-accent hover:bg-accent-soft">
            New
          </Link>
          <ReplyLanguageSelect
            value={replyLanguage}
            onChange={(language) => {
              setReplyLanguage(language);
              writeReplyLanguage(language);
              const spoken = speechCode(language);
              if (spoken) setVoiceLang(spoken);
            }}
          />
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-elevated/40 px-3 py-2 sm:gap-2 sm:px-6">
        {MODE_META.map((item) => {
          const Icon = MODE_ICONS[item.id];
          return (
            <button
              key={item.id}
              type="button"
              title={item.hint}
              onClick={() => setMode(item.id)}
              className={`mode-tab inline-flex items-center gap-1.5 ${mode === item.id ? "mode-tab-active" : "mode-tab-idle"}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.short}
            </button>
          );
        })}
        <Link
          to={`/app/studio?mode=${mode === "general" || mode === "emotion" ? "study" : mode}`}
          className="mode-tab ml-auto inline-flex items-center gap-1.5 bg-lavender-soft text-lavender hover:opacity-90"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Open Studio
        </Link>
      </div>
      {mode === "ppt" ? (
        <p className="border-b border-line bg-elevated/20 px-4 py-2 text-xs leading-5 text-soft sm:px-6">
          Chat can outline slides and export a PPTX. For structured multi-slide decks, use{" "}
          <Link to="/app/studio?mode=ppt" className="font-semibold text-accent">
            PPT Studio
          </Link>
          .
        </p>
      ) : null}
      {mode === "image" ? (
        <div className="space-y-2 border-b border-line bg-elevated/30 px-4 py-2 sm:px-6">
          <p className="text-xs leading-5 text-soft">
            Images need a Gemini image quota on the server key. Free keys often allow only a few images per day. Use Diagram for labeled study charts without burning image quota the same way.
          </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["generate", "Generate image"],
              ["edit", "Edit image"],
              ["diagram", "Study diagram"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setImageAction(id)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                imageAction === id ? "bg-accent-soft text-accent" : "text-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
          <p className="w-full text-[11px] leading-4 text-soft">
            {imageAction === "edit"
              ? "Attach a photo, then describe the change. The original stays in chat."
              : imageAction === "diagram"
                ? "Builds a labeled SVG diagram for study topics (works even when image-model quota is exhausted)."
                : "Uses Gemini image models. Needs GEMINI_API_KEY with image quota."}
          </p>
        </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {journalId ? <Alert>The selected journal entry will be sent with your next message. Nothing is shared until you press send.</Alert> : null}
          {messages.length === 0 ? (
            <div className="glass-panel welcome-glow mx-auto flex w-full max-w-lg flex-col items-center px-6 py-10 text-center">
              {useSafaPortrait ? (
                <SafaPortrait className="h-32 w-32 sm:h-40 sm:w-40" mood={portraitMood} showHearts />
              ) : (
                <CompanionAvatar appearance={companionAppearance} name={companionName} className="h-32 w-32 sm:h-40 sm:w-40" mood={portraitMood} />
              )}
              <h2 className="relative mt-5 font-serif text-3xl leading-tight sm:text-4xl">{greeting.title}</h2>
              <p className="relative mt-3 max-w-md text-sm leading-6 text-soft">
                {greeting.body}
                <br />
                What&apos;s on your mind today?
              </p>
              <div className="relative mt-6 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    className="chip text-left"
                    onClick={() => {
                      setError("");
                      setDraft(starter);
                    }}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {messages.map((message) => (
            <article
              key={message.id}
              className={`chat-bubble flex max-w-[min(100%,40rem)] flex-col ${message.sender === "user" ? "ml-auto items-end" : "items-start"}`}
            >
              <p className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-soft">
                {message.sender === "user" ? (
                  "You"
                ) : message.kind === "notice" ? (
                  "Notice"
                ) : (
                  <>
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-lavender-soft text-[10px] font-bold normal-case tracking-normal text-lavender"
                      aria-hidden
                    >
                      {(companionName || "S").slice(0, 1)}
                    </span>
                    {companionName}
                  </>
                )}
                {message.sender === "assistant" && message.kind === "ai" ? <AiMark /> : null}
                {message.createdAt ? <span className="normal-case tracking-normal opacity-80">{formatTime(message.createdAt)}</span> : null}
              </p>
              <div
                className={`rounded-[1.35rem] px-4 py-3.5 text-sm leading-7 transition-[box-shadow,border-color] duration-150 ${
                  message.sender === "user"
                    ? "chat-bubble-user rounded-br-md"
                    : "chat-bubble-assistant rounded-bl-md shadow-[var(--shadow)]"
                }`}
              >
                <MessageText content={message.content} />
                {message.attachment ? <FileChip attachment={message.attachment} /> : null}
                {message.sender === "assistant" && message.kind === "ai" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line/60 pt-2">
                    <CopyButton text={message.content} />
                    {message.id === lastAssistantId ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-soft transition hover:text-ink disabled:opacity-50"
                        disabled={pending}
                        onClick={regenerateLast}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Regenerate
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-soft transition hover:text-ink disabled:opacity-50"
                      disabled={!conversationId || message.id.startsWith("local-")}
                      aria-pressed={favoriteIds.has(message.id)}
                      onClick={() => void toggleFavorite(message)}
                    >
                      <Star className={`h-3.5 w-3.5 ${favoriteIds.has(message.id) ? "fill-accent text-accent" : ""}`} />
                      {favoriteIds.has(message.id) ? "Saved" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-soft transition hover:text-ink"
                      aria-pressed={speakingId === message.id}
                      onClick={() => (speakingId === message.id ? stopSpeaking() : speak(message.content, message.id))}
                    >
                      {speakingId === message.id ? "Stop" : "Speak"}
                    </button>
                    {mode === "ppt" || mode === "assignment" || mode === "document" || mode === "study" || mode === "exam" || mode === "writing" ? (
                      <>
                        {mode === "ppt" ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-accent"
                            disabled={exportingId === `${message.id}-pptx`}
                            onClick={() => {
                              setExportingId(`${message.id}-pptx`);
                              void api
                                .studioExport({
                                  format: "pptx",
                                  title: chatTitle || "SAHARA presentation",
                                  content: message.content,
                                  presentation: presentationFromMarkdown(message.content, chatTitle || "SAHARA presentation"),
                                })
                                .then((file) => downloadBase64File(file.filename, file.mimeType, file.data))
                                .catch((exportError) => {
                                  console.error(exportError);
                                  setError(exportError instanceof ApiError ? exportError.message : "PPTX export failed.");
                                })
                                .finally(() => setExportingId(null));
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                            {exportingId === `${message.id}-pptx` ? "Building…" : "PPTX"}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-accent"
                              disabled={exportingId === `${message.id}-docx`}
                              onClick={() => {
                                setExportingId(`${message.id}-docx`);
                                void api
                                  .studioExport({ format: "docx", title: chatTitle || "SAHARA document", content: message.content })
                                  .then((file) => downloadBase64File(file.filename, file.mimeType, file.data))
                                  .catch((exportError) => {
                                    console.error(exportError);
                                    setError(exportError instanceof ApiError ? exportError.message : "DOCX export failed.");
                                  })
                                  .finally(() => setExportingId(null));
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                              {exportingId === `${message.id}-docx` ? "Building…" : "DOCX"}
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-accent"
                              disabled={exportingId === `${message.id}-pdf`}
                              onClick={() => {
                                setExportingId(`${message.id}-pdf`);
                                void api
                                  .studioExport({ format: "pdf", title: chatTitle || "SAHARA document", content: message.content })
                                  .then((file) => downloadBase64File(file.filename, file.mimeType, file.data))
                                  .catch((exportError) => {
                                    console.error(exportError);
                                    setError(exportError instanceof ApiError ? exportError.message : "PDF export failed.");
                                  })
                                  .finally(() => setExportingId(null));
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                              {exportingId === `${message.id}-pdf` ? "Building…" : "PDF"}
                            </button>
                          </>
                        )}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
          {pending ? (
            <div className="thinking-card chat-bubble" role="status">
              <SaharaOrb className="h-10 w-10 shrink-0" mood="thinking" />
              <div>
                <p className="text-sm font-semibold">Thinking</p>
                <p className="mt-0.5 inline-flex items-center gap-2 text-xs text-soft">
                  <span className="typing" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  {mode === "image" ? (imageAction === "diagram" ? "Building diagram…" : "Creating image with Gemini…") : "Gemini is writing a reply…"}
                </p>
              </div>
            </div>
          ) : null}
          {voiceNote ? (
            <p role="status" className="rounded-2xl border border-line bg-elevated/80 px-3 py-2 text-xs leading-5 text-soft">
              {voiceNote}
            </p>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="safe-bottom border-t border-line bg-elevated/85 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto max-w-3xl space-y-3">
          {error ? (
            <Alert>
              <p>{error}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {messages.length > 0 || draft.trim() || file ? (
                  <button type="button" className="text-sm font-semibold text-accent" onClick={() => void send()} disabled={pending}>
                    Retry
                  </button>
                ) : null}
                <button type="button" className="text-sm font-semibold text-soft" onClick={() => setError("")}>
                  Dismiss
                </button>
              </div>
            </Alert>
          ) : null}
          <details className="min-w-0 text-xs text-soft">
            <summary className="cursor-pointer font-semibold">Voice options</summary>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={speakOn}
                  onChange={(event) => {
                    setSpeakOn(event.target.checked);
                    localStorage.setItem("sahara.speak", event.target.checked ? "1" : "0");
                  }}
                />
                Read replies aloud
              </label>
              <label>
                Speed
                <select className="ml-2 rounded-full border border-line bg-muted px-2 py-1 text-ink" value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))}>
                  <option value={0.9}>Slow</option>
                  <option value={1}>Normal</option>
                  <option value={1.15}>Faster</option>
                </select>
              </label>
              <label>
                Speech language
                <select className="ml-2 rounded-full border border-line bg-muted px-2 py-1 text-ink" value={voiceLang} onChange={(event) => setVoiceLang(event.target.value)}>
                  <option value="en-US">English</option>
                  <option value="ur-PK">Urdu</option>
                  <option value="hi-IN">Hindi</option>
                  <option value="ar">Arabic</option>
                  <option value="pa-IN">Punjabi</option>
                  <option value="ps">Pashto</option>
                  <option value="fr-FR">French</option>
                  <option value="es-ES">Spanish</option>
                </select>
              </label>
              <button type="button" className="font-semibold" onClick={stopSpeaking}>
                Stop speech
              </button>
            </div>
            <p className="mt-2 leading-5">
              Auto detect follows your latest message. Voice uses this browser’s mic/speaker and is not saved as audio.
              {replyLanguage === "roman-urdu" ? " Spoken playback may not read Roman Urdu accurately." : ""}
            </p>
          </details>
          <form
            className="composer-box p-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,.txt,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={(event) => void chooseFile(event.target.files)}
            />
            {file ? (
              <div className="mx-1 mb-1 flex items-center justify-between gap-3 rounded-2xl bg-bg px-3 py-2 text-sm">
                <span className="truncate">{file.name}</span>
                <button type="button" className="shrink-0 text-xs font-semibold" onClick={() => setFile(null)}>
                  Remove
                </button>
              </div>
            ) : null}
            <label className="block min-w-0">
              <span className="sr-only">Message</span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder={`Message ${companionName}…`}
                disabled={pending}
                className="max-h-40 w-full resize-none bg-transparent px-3 py-2.5 text-base outline-none disabled:opacity-60 sm:text-sm"
              />
            </label>
            <div className="flex items-center justify-between gap-2 px-1 pb-1">
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" aria-label="Attach a file" className="h-11 w-11 border-0 bg-transparent px-0 hover:bg-muted" onClick={() => fileInputRef.current?.click()} disabled={pending}>
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={listening ? "Stop listening" : "Speak instead of typing"}
                  className={`h-11 w-11 border-0 px-0 hover:bg-muted ${listening ? "mic-live bg-accent-soft text-accent" : "bg-transparent"}`}
                  onClick={listening ? () => recognitionRef.current?.stop() : listen}
                  disabled={pending}
                >
                  {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
              <Button type="submit" aria-label="Send" disabled={pending || (draft.trim().length === 0 && !file)} className="h-11 min-w-11 rounded-full px-0 sm:min-w-[5.5rem] sm:px-4">
                <Send className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Send</span>
              </Button>
            </div>
          </form>
          <p className="text-xs leading-5 text-soft">Messages and attached files are sent to Google Gemini. One file at a time, up to 3 MB: a photo, PDF, or text file. This is not medical care.</p>
        </div>
      </div>
    </section>
  );
}
