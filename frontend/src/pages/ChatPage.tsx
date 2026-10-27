import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Paperclip, Send } from "lucide-react";
import { ReplyLanguageSelect } from "@/components/ReplyLanguageSelect";
import { api, ApiError } from "@/lib/api";
import { geolocationError } from "@/lib/location";
import { readReplyLanguage, speechCode, writeReplyLanguage, type ReplyLanguage } from "@/lib/replyLanguage";
import { pickVoice, preferredLangs, speechScript } from "@/lib/speech";
import type { ChatMessage, Companion } from "@/lib/types";
import { RestaurantCard } from "@/components/RestaurantCard";
import { AiMark, Alert, Button, EmptyState } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const starters = ["I'm feeling low today.", "I'm hungry. Please suggest something light.", "I'm not sure how to describe what I'm feeling."];

const fileTypes: Record<string, string> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
  "application/pdf": "application/pdf",
  "text/plain": "text/plain",
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
  return "";
}

function MessageText({ content }: { content: string }) {
  const script = speechScript(content);
  const rtl = script === "urdu" || script === "arabic";
  const parts = content.split("```");
  return (
    <div dir={rtl ? "rtl" : "ltr"} lang={script === "urdu" ? "ur" : script === "arabic" ? "ar" : undefined} className={rtl ? "font-arabic text-right" : ""}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <pre key={index} dir="ltr" className="my-2 overflow-x-auto rounded-xl bg-bg/80 p-3 text-left text-xs leading-5">
            <code>{part.replace(/^[a-zA-Z0-9]+\n/, "")}</code>
          </pre>
        ) : part ? (
          <p key={index} className="whitespace-pre-wrap break-words">{part}</p>
        ) : null,
      )}
    </div>
  );
}

function FileChip({ attachment }: { attachment: { name: string; mimeType: string; data: string } }) {
  const href = `data:${attachment.mimeType};base64,${attachment.data}`;
  if (attachment.mimeType.startsWith("image/")) {
    return <img src={href} alt={attachment.name} className="mt-2 max-h-48 rounded-2xl" />;
  }
  return (
    <a href={href} download={attachment.name} className="mt-2 inline-flex text-xs font-semibold underline">
      {attachment.name}
    </a>
  );
}

export function ChatPage() {
  useDocumentTitle("Chat");
  const { conversationId } = useParams();
  const [params] = useSearchParams();
  const journalId = params.get("journal") ?? undefined;
  const navigate = useNavigate();
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [companionId, setCompanionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<PendingFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [useSaved, setUseSaved] = useState(false);
  const [locationNote, setLocationNote] = useState("");
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(() => localStorage.getItem("sahara.speak") === "1");
  const [speechRate, setSpeechRate] = useState(1);
  const [voiceLang, setVoiceLang] = useState("en-US");
  const [replyLanguage, setReplyLanguage] = useState<ReplyLanguage>(() => readReplyLanguage());
  const [voiceNote, setVoiceNote] = useState("");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sending = useRef(false);
  const heard = useRef("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speakToken = useRef(0);

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
      const said = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
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
    api.companions().then((result) => {
      setCompanions(result.companions);
      const fallback = result.companions.find((item) => item.isDefault) ?? result.companions[0];
      if (fallback) setCompanionId(fallback.id);
    }).catch((loadError) => {
      console.error("Failed to load companions", loadError);
      setError(loadError instanceof ApiError ? loadError.message : "Companions could not be loaded.");
    });
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    api.conversation(conversationId).then((result) => {
      setMessages(result.messages);
      if (result.conversation.companionId) setCompanionId(result.conversation.companionId);
    }).catch((loadError) => {
      console.error("Failed to load conversation", loadError);
      setError(loadError instanceof ApiError ? loadError.message : "That conversation could not be opened.");
    });
  }, [conversationId]);

  useEffect(() => {
    const starter = params.get("prompt");
    if (!starter || conversationId) return;
    setDraft((current) => current || starter.slice(0, 2000));
  }, [conversationId, params]);

  useEffect(() => {
    if (params.get("voice") === "1") listen();
    // The voice shortcut should start one listening session when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  const shareLocation = () => {
    if (!navigator.geolocation) {
      setCoords(null);
      setLocationNote("This browser has no location service. You can still name a city or area in the message.");
      return;
    }
    setLocationNote("Asking the browser for this device's location. SAHARA does not keep watching it.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        void (async () => {
          let label: string | null = null;
          try {
            const found = await api.reversePlace({ latitude, longitude });
            label = found.label;
          } catch (reverseError) {
            console.error("Reverse geocoding failed", reverseError);
          }
          setCoords({ latitude, longitude });
          setLocationNote(
            label
              ? `Location is attached to your next message: ${label}. SAHARA is not tracking you.`
              : "Coordinates are attached to your next message. A street address did not come back.",
          );
        })();
      },
      (positionError) => {
        setCoords(null);
        setLocationNote(geolocationError(positionError.code, "You can still name a city or area in the message."));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const chooseFile = async (list: FileList | null) => {
    const next = list?.[0];
    if (!next) return;
    const mimeType = fileMime(next);
    if (!mimeType) {
      setError("Attach a JPEG, PNG, WebP, GIF, PDF, or text file.");
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

  const send = async () => {
    const content = draft.trim();
    const attachment = file;
    if ((!content && !attachment) || pending || sending.current) return;
    sending.current = true;
    const optimisticId = `local-${Date.now()}`;
    setPending(true);
    setError("");
    setDraft("");
    setFile(null);
    stopSpeaking();
    setMessages((current) => [
      ...current,
      {
        id: optimisticId,
        sender: "user",
        kind: "ai",
        content: content || `Attached ${attachment?.name ?? "file"}`,
        attachment: attachment ?? undefined,
        places: [],
        createdAt: new Date().toISOString(),
      },
    ]);
    try {
      const result = await api.sendMessage({
        conversationId,
        companionId,
        content,
        attachment: attachment ?? undefined,
        journalId,
        location: { ...coords, useSaved },
        replyLanguage,
      });
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimisticId),
        result.userMessage,
        result.assistantMessage,
      ]);
      const nextId = result.conversation.id;
      if (speakOn) speak(result.assistantMessage.content, result.assistantMessage.id);
      if (!conversationId || journalId) navigate(`/app/chat/${nextId}`, { replace: true });
    } catch (sendError) {
      console.error("Chat failed", sendError);
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      setDraft(content);
      setFile(attachment);
      setError(sendError instanceof ApiError ? sendError.message : "The message could not be sent.");
    } finally {
      sending.current = false;
      setPending(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl leading-none">{companions.find((item) => item.id === companionId)?.name ?? "Companion"}</h1>
            <AiMark />
          </div>
          <p className="mt-1 text-xs text-soft">An AI companion. Not a person, therapist, or doctor.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/app/chat" className="text-xs font-semibold">New</Link>
          <Link to="/app/conversations" className="text-xs font-semibold">Recent</Link>
          <ReplyLanguageSelect
            value={replyLanguage}
            onChange={(language) => {
              setReplyLanguage(language);
              writeReplyLanguage(language);
              const spoken = speechCode(language);
              if (spoken) setVoiceLang(spoken);
            }}
          />
        <label className="text-xs text-soft">
          Companion
          <select
            className="ml-2 rounded-full border border-line bg-muted px-3 py-1.5 text-sm text-ink"
            value={companionId}
            onChange={(event) => setCompanionId(event.target.value)}
          >
            {companions.map((companion) => (
              <option key={companion.id} value={companion.id}>
                {companion.name}
              </option>
            ))}
          </select>
        </label>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {journalId ? <Alert>The selected journal entry will be sent with your next message. Nothing is shared until you press send.</Alert> : null}
          {messages.length === 0 ? (
            <EmptyState
              title="Start when you want"
              body="Talk about the day, a craving, or both. A reply appears only after Gemini answers."
              action={
                <div className="flex flex-wrap gap-2">
                  {starters.map((starter) => (
                    <button key={starter} type="button" className="rounded-full border border-line px-3 py-1.5 text-left text-xs" onClick={() => setDraft(starter)}>
                      {starter}
                    </button>
                  ))}
                </div>
              }
            />
          ) : null}
          {messages.map((message) => (
            <article key={message.id} className={message.sender === "user" ? "ml-auto max-w-[40rem]" : "max-w-[40rem]"}>
              <p className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-soft">
                {message.sender === "user" ? "You" : message.kind === "notice" ? "Notice" : "AI"}
                {message.sender === "assistant" && message.kind === "ai" ? <AiMark /> : null}
              </p>
              <div className={`rounded-3xl px-4 py-3 text-sm leading-7 shadow-[var(--shadow)] ${message.sender === "user" ? "rounded-br-md bg-accent text-on-accent" : "rounded-bl-md border border-line bg-elevated"}`}>
                <MessageText content={message.content} />
                {message.attachment ? <FileChip attachment={message.attachment} /> : null}
                {message.sender === "assistant" && message.kind === "ai" ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold"
                    aria-pressed={speakingId === message.id}
                    onClick={() => (speakingId === message.id ? stopSpeaking() : speak(message.content, message.id))}
                  >
                    {speakingId === message.id ? "Stop" : "Speak"}
                  </button>
                ) : null}
              </div>
              {message.places.length > 0 ? (
                <div className="mt-3 grid gap-3">
                  {message.places.map((place) => (
                    <RestaurantCard key={place.id} place={place} />
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          {pending ? (
            <p className="inline-flex items-center gap-2 text-sm text-soft" role="status">
              <span className="typing" aria-hidden="true"><span /><span /><span /></span>
              Replying…
            </p>
          ) : null}
          {voiceNote ? <p role="status" className="text-xs leading-5 text-soft">{voiceNote}</p> : null}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="safe-bottom border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-3xl space-y-3">
          {error ? (
            <Alert>
              <p>{error}</p>
              <button type="button" className="mt-2 text-sm font-semibold text-accent" onClick={() => void send()} disabled={pending}>
                Retry
              </button>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 text-xs text-soft">
            <Button variant="ghost" type="button" onClick={shareLocation}>
              Use my location once
            </Button>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={useSaved} onChange={(event) => setUseSaved(event.target.checked)} />
              Use saved place
            </label>
            {locationNote ? <span>{locationNote}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-soft">
            <Button variant="ghost" type="button" onClick={listening ? () => recognitionRef.current?.stop() : listen}>
              {listening ? "Stop listening" : "Speak instead of typing"}
            </Button>
            <details className="min-w-0">
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
                <button type="button" className="font-semibold" onClick={stopSpeaking}>Stop speech</button>
              </div>
            </details>
          </div>
          <p className="text-xs leading-5 text-soft">
            Auto detect answers in the language of your latest message. A chosen language stays until you change it, unless that message asks for another language.
            {replyLanguage === "roman-urdu" ? " Spoken playback may not read Roman Urdu accurately." : ""} Voice uses this browser’s microphone and speaker. It is not a live conversation, and nothing is saved as an audio recording.
          </p>
          <form
            className="rounded-3xl border border-line bg-muted p-2 focus-within:border-accent"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,.txt"
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
                placeholder="Talk, or say what you feel like eating"
                className="max-h-40 w-full resize-none bg-transparent px-3 py-2 text-base outline-none sm:text-sm"
              />
            </label>
            <div className="flex items-center justify-between gap-2 px-1 pb-1">
              <Button type="button" variant="ghost" aria-label="Attach a file" className="h-11 w-11 border-0 bg-transparent px-0 hover:bg-bg" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button type="submit" aria-label="Send" disabled={pending || (draft.trim().length === 0 && !file)} className="h-11 w-11 px-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
          <p className="text-xs leading-5 text-soft">Messages and attached files are sent to Google Gemini. One file at a time, up to 3 MB: a photo, PDF, or text file. This is not medical care. Restaurant names appear only after a search returns them.</p>
        </div>
      </div>
    </section>
  );
}
