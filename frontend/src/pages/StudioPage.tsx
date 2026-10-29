import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, FileText, Pencil, Presentation, RefreshCw, Sparkles } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { downloadBase64File, MODE_META, modeMeta, type ChatMode } from "@/lib/modes";
import { normalizeStudioMarkdown } from "@/lib/markdownNormalize";
import { readReplyLanguage, writeReplyLanguage, type ReplyLanguage } from "@/lib/replyLanguage";
import { Alert, Button, Field, PageHeader, TextArea } from "@/components/ui";
import { MarkdownView } from "@/components/MarkdownView";
import { notifyUsageChanged } from "@/components/UsageMeter";
import { ReplyLanguageSelect } from "@/components/ReplyLanguageSelect";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type StudioResult = {
  mode: ChatMode;
  title: string;
  content: string;
  presentation?: {
    title: string;
    slides: { title: string; bullets: string[]; notes?: string }[];
  };
};

type AssignmentType = "essay" | "assignment" | "report" | "outline" | "short-answer" | "detailed-answer";

const STUDIO_MODES = MODE_META.filter((item) => item.studio);

const ASSIGNMENT_TYPES: { id: AssignmentType; label: string }[] = [
  { id: "essay", label: "Essay" },
  { id: "assignment", label: "Assignment" },
  { id: "report", label: "Report" },
  { id: "outline", label: "Outline" },
  { id: "short-answer", label: "Short answer" },
  { id: "detailed-answer", label: "Detailed answer" },
];

const WORD_COUNTS = [300, 500, 800, 1000, 1500, 2000];

function readFileAsAttachment(file: File): Promise<{ name: string; mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    if (file.size > 3 * 1024 * 1024) {
      reject(new Error("Keep files under 3 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const data = result.includes(",") ? result.split(",")[1] ?? "" : result;
      if (!data) {
        reject(new Error("That file could not be read."));
        return;
      }
      resolve({ name: file.name, mimeType: file.type || "application/octet-stream", data });
    };
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.readAsDataURL(file);
  });
}

export function StudioPage() {
  const [params] = useSearchParams();
  const initial = (params.get("mode") as ChatMode | null) ?? "study";
  const [mode, setMode] = useState<ChatMode>(STUDIO_MODES.some((item) => item.id === initial) ? initial : "study");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("University");
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("essay");
  const [wordCount, setWordCount] = useState(800);
  const [writingStyle, setWritingStyle] = useState<"simple" | "academic">("academic");
  const [replyLanguage, setReplyLanguage] = useState<ReplyLanguage>(() => readReplyLanguage());
  const [slideCount, setSlideCount] = useState(8);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [result, setResult] = useState<StudioResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<{ name: string; mimeType: string; data: string } | null>(null);

  const meta = useMemo(() => modeMeta(mode), [mode]);
  useDocumentTitle(meta.label);

  useEffect(() => {
    const next = params.get("mode");
    if (next && STUDIO_MODES.some((item) => item.id === next) && next !== mode) {
      setMode(next as ChatMode);
      setResult(null);
      setImagePreview(null);
      setEditing(false);
      setError("");
    }
    // Sync Studio tab when the URL mode changes (e.g. sidebar Study / Assignment links).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const buildAssignmentPrompt = () => {
    const topic = title.trim() || prompt.trim();
    const extra = prompt.trim();
    const typeLabel = ASSIGNMENT_TYPES.find((item) => item.id === assignmentType)?.label ?? "Essay";
    return [
      `Write a ${typeLabel.toLowerCase()} on: ${topic}.`,
      subject.trim() ? `Subject: ${subject.trim()}.` : "",
      `Level: ${level}.`,
      `About ${wordCount} words.`,
      writingStyle === "simple" ? "Use simple clear English." : "Use clear academic English.",
      assignmentType === "essay" || assignmentType === "short-answer"
        ? "Write the full essay/answer only. Do not include an outline or meta notes."
        : assignmentType === "outline"
          ? "Provide a structured outline only."
          : "Write the academic document body only.",
      extra && extra !== topic ? `Additional instructions: ${extra}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const generate = async () => {
    const requestPrompt = mode === "assignment" ? buildAssignmentPrompt() : prompt.trim();
    if (pending || requestPrompt.length < 2) return;
    setPending(true);
    setError("");
    setImagePreview(null);
    setEditing(false);
    try {
      if (mode === "image") {
        const visual = attachment
          ? await api.editImage({ prompt: prompt.trim(), image: attachment })
          : /diagram|uml|er |network|flowchart|water cycle|photosynthesis/i.test(prompt)
            ? await api.generateDiagram({ prompt: prompt.trim() })
            : await api.generateImage({
                prompt: prompt.trim(),
                purpose: "study",
                style: level ? `${level} educational style` : undefined,
              });
        const image = visual.assistantMessage.attachment;
        if (!image?.data) throw new Error("No image was returned.");
        setImagePreview(image);
        setResult({
          mode: "image",
          title: title.trim() || visual.conversation.title || "SAHARA image",
          content: visual.assistantMessage.content,
        });
        notifyUsageChanged();
        return;
      }
      const next = await api.studioGenerate({
        mode,
        prompt: requestPrompt,
        title: title.trim() || undefined,
        subject: mode === "assignment" ? subject.trim() || undefined : undefined,
        level: level.trim() || undefined,
        assignmentType: mode === "assignment" ? assignmentType : undefined,
        wordCount: mode === "assignment" ? wordCount : undefined,
        writingStyle: mode === "assignment" ? writingStyle : undefined,
        slideCount: mode === "ppt" ? slideCount : undefined,
        includeSpeakerNotes: mode === "ppt",
        replyLanguage,
        attachment: attachment ?? undefined,
      });
      setResult({
        ...(next as StudioResult),
        content: normalizeStudioMarkdown((next as StudioResult).content ?? ""),
        title: (next as StudioResult).title || title.trim() || "SAHARA document",
      });
      notifyUsageChanged();
    } catch (generateError) {
      console.error("Studio generate failed", generateError);
      setError(generateError instanceof ApiError ? generateError.message : "SAHARA could not generate that yet.");
    } finally {
      setPending(false);
    }
  };

  const exportFile = async (format: "pptx" | "docx" | "pdf") => {
    if (!result || exporting) return;
    setExporting(format);
    setError("");
    try {
      const file = await api.studioExport({
        format,
        title: result.title,
        content: normalizeStudioMarkdown(result.content),
        presentation: result.presentation,
      });
      if (!file?.data || !file.mimeType || !file.filename) {
        throw new Error("The download file was empty.");
      }
      downloadBase64File(file.filename, file.mimeType, file.data);
    } catch (exportError) {
      console.error("Studio export failed", exportError);
      setError(exportError instanceof ApiError ? exportError.message : "The file could not be created.");
    } finally {
      setExporting(null);
    }
  };

  const copyResult = async () => {
    if (!result?.content) return;
    try {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (copyError) {
      console.error("Copy failed", copyError);
      setError("Could not copy to clipboard.");
    }
  };

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader
        eyebrow="SAHARA Studio"
        title={meta.label}
        body="Study help, assignments, presentations, documents, exam prep, writing, and supportive listening — with real Gemini replies and downloadable files."
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {STUDIO_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setMode(item.id);
              setResult(null);
              setImagePreview(null);
              setEditing(false);
              setError("");
              const url = new URL(window.location.href);
              url.searchParams.set("mode", item.id);
              window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);
            }}
            className={`mode-tab ${mode === item.id ? "mode-tab-active" : "mode-tab-idle"}`}
          >
            {item.short}
          </button>
        ))}
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-soft">{meta.hint}</p>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-soft">
        Prefer chat? Open{" "}
        <Link className="font-semibold text-accent" to={`/app/chat?mode=${mode}`}>
          Chat in {meta.short} mode
        </Link>
        . Review every academic draft. SAHARA does not invent fake citations.
      </p>

      <div className="mt-5 grid max-w-5xl gap-4 lg:grid-cols-[1fr_1.05fr]">
        <div className="glass-panel space-y-3 p-4 sm:p-5">
          {error ? (
            <Alert>
              <p>{error}</p>
            </Alert>
          ) : null}

          {mode === "assignment" ? (
            <>
              <Field label="Topic / title">
                <input
                  className="w-full rounded-2xl border border-line bg-muted px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Best Friends"
                />
              </Field>
              <Field label="Subject (optional)">
                <input
                  className="w-full rounded-2xl border border-line bg-muted px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="English / Computer Science"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Assignment type">
                  <select
                    className="w-full rounded-2xl border border-line bg-muted px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                    value={assignmentType}
                    onChange={(event) => setAssignmentType(event.target.value as AssignmentType)}
                  >
                    {ASSIGNMENT_TYPES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Education level">
                  <select
                    className="w-full rounded-2xl border border-line bg-muted px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                    value={level}
                    onChange={(event) => setLevel(event.target.value)}
                  >
                    <option>School</option>
                    <option>College</option>
                    <option>University</option>
                    <option>Professional</option>
                  </select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Word count">
                  <select
                    className="w-full rounded-2xl border border-line bg-muted px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                    value={wordCount}
                    onChange={(event) => setWordCount(Number(event.target.value))}
                  >
                    {WORD_COUNTS.map((count) => (
                      <option key={count} value={count}>
                        ~{count} words
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Writing style">
                  <select
                    className="w-full rounded-2xl border border-line bg-muted px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                    value={writingStyle}
                    onChange={(event) => setWritingStyle(event.target.value as "simple" | "academic")}
                  >
                    <option value="simple">Simple English</option>
                    <option value="academic">Academic English</option>
                  </select>
                </Field>
              </div>
              <Field label="Language">
                <ReplyLanguageSelect
                  value={replyLanguage}
                  onChange={(language) => {
                    setReplyLanguage(language);
                    writeReplyLanguage(language);
                  }}
                />
              </Field>
              <Field label="Additional instructions (optional)">
                <TextArea
                  rows={4}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Include an introduction and conclusion. No fake references."
                />
              </Field>
            </>
          ) : mode !== "emotion" ? (
            <>
              <Field label="Title (optional)">
                <input
                  className="w-full rounded-2xl border border-line bg-muted px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={mode === "ppt" ? "Operating Systems overview" : "Notes or document title"}
                />
              </Field>
              <Field label="Level">
                <select
                  className="w-full rounded-2xl border border-line bg-muted px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                >
                  <option>School</option>
                  <option>College</option>
                  <option>University</option>
                  <option>Professional</option>
                </select>
              </Field>
            </>
          ) : null}

          {mode === "ppt" ? (
            <Field label={`Slides: ${slideCount}`}>
              <input
                type="range"
                min={4}
                max={16}
                value={slideCount}
                onChange={(event) => setSlideCount(Number(event.target.value))}
                className="w-full"
              />
            </Field>
          ) : null}

          {mode !== "assignment" ? (
            <Field label={mode === "emotion" ? "How are you feeling?" : "What should SAHARA create?"}>
              <TextArea
                rows={mode === "emotion" ? 5 : 7}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={
                  mode === "emotion"
                    ? "Yaar main bohat sad hoon…"
                    : mode === "ppt"
                      ? "Make a university PPT on database normalization with examples…"
                      : "Explain recursion with a simple example and practice questions…"
                }
              />
            </Field>
          ) : null}

          {mode !== "emotion" ? (
            <Field label={mode === "image" ? "Image to edit (optional)" : "Upload instructions (PDF, text, or Word)"}>
              <input
                type="file"
                accept={
                  mode === "image"
                    ? "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                    : ".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                }
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setFileName(file?.name ?? "");
                  setAttachment(null);
                  if (!file) return;
                  void readFileAsAttachment(file)
                    .then((next) => setAttachment(next))
                    .catch((fileError) => {
                      console.error(fileError);
                      setError(fileError instanceof Error ? fileError.message : "File could not be attached.");
                    });
                }}
              />
              {fileName ? <p className="mt-1 text-xs text-soft">Attached: {fileName}</p> : null}
            </Field>
          ) : null}

          <Button
            type="button"
            onClick={() => void generate()}
            disabled={pending || (mode === "assignment" ? title.trim().length < 2 && prompt.trim().length < 2 : prompt.trim().length < 2)}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {pending
              ? attachment
                ? "Reading file with Gemini… this can take up to a minute"
                : "Generating with Gemini…"
              : mode === "emotion"
                ? "Talk with SAHARA"
                : "Generate"}
          </Button>
        </div>

        <div className="glass-panel p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-2xl">Result</h2>
            {result && !imagePreview ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" className="min-h-9 px-3 text-xs" onClick={() => setEditing((value) => !value)}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  {editing ? "Preview" : "Edit"}
                </Button>
                <Button type="button" variant="ghost" className="min-h-9 px-3 text-xs" onClick={() => void copyResult()}>
                  {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button type="button" variant="ghost" className="min-h-9 px-3 text-xs" disabled={pending} onClick={() => void generate()}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Regenerate
                </Button>
              </div>
            ) : null}
          </div>

          {!result ? (
            <p className="mt-3 text-sm leading-6 text-soft">
              Generated text appears here with proper headings and lists. For Assignment, PPT, and Documents you can download a real file after generation.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm font-semibold text-accent">{result.title}</p>
              {imagePreview ? (
                <div className="mt-3 space-y-2">
                  <img
                    src={`data:${imagePreview.mimeType};base64,${imagePreview.data}`}
                    alt={imagePreview.name}
                    className="max-h-80 w-full rounded-2xl border border-line object-contain bg-black/20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => downloadBase64File(imagePreview.name, imagePreview.mimeType, imagePreview.data)}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Download image
                  </Button>
                </div>
              ) : editing ? (
                <TextArea
                  className="mt-3 min-h-[28rem] font-sans text-sm leading-6"
                  value={result.content}
                  onChange={(event) => setResult({ ...result, content: event.target.value })}
                />
              ) : (
                <div className="mt-3 max-h-[32rem] overflow-auto rounded-2xl border border-line bg-muted/40 p-4">
                  {mode === "ppt" && result.presentation?.slides?.length ? (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-ink">{result.presentation.title}</p>
                      {result.presentation.slides.map((slide, index) => (
                        <article key={`${slide.title}-${index}`} className="rounded-2xl border border-line bg-elevated/80 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Slide {index + 1}</p>
                          <h3 className="mt-1 font-serif text-lg text-ink">{slide.title}</h3>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-soft">
                            {slide.bullets.map((bullet) => (
                              <li key={bullet}>{bullet}</li>
                            ))}
                          </ul>
                          {slide.notes ? <p className="mt-2 text-xs italic text-soft">Notes: {slide.notes}</p> : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <MarkdownView content={normalizeStudioMarkdown(result.content)} />
                  )}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {(mode === "ppt" || result.presentation) && (
                  <Button type="button" variant="ghost" disabled={Boolean(exporting) || !result.presentation?.slides?.length} onClick={() => void exportFile("pptx")}>
                    <Presentation className="h-4 w-4" aria-hidden />
                    {exporting === "pptx" ? "Building PPTX…" : "Download PPTX"}
                  </Button>
                )}
                {(mode === "assignment" || mode === "document" || mode === "study" || mode === "exam" || mode === "writing") && (
                  <>
                    <Button type="button" variant="ghost" disabled={Boolean(exporting) || !result.content.trim()} onClick={() => void exportFile("docx")}>
                      <FileText className="h-4 w-4" aria-hidden />
                      {exporting === "docx" ? "Building DOCX…" : "Download DOCX"}
                    </Button>
                    <Button type="button" variant="ghost" disabled={Boolean(exporting) || !result.content.trim()} onClick={() => void exportFile("pdf")}>
                      <Download className="h-4 w-4" aria-hidden />
                      {exporting === "pdf" ? "Building PDF…" : "Download PDF"}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
