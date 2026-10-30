import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { api, ApiError, setAuthToken } from "@/lib/api";
import type { Companion, CompanionAppearance, Preferences } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { CompanionAvatar } from "@/components/CompanionAvatar";
import { ReplyLanguageSelect } from "@/components/ReplyLanguageSelect";
import { Alert, Button, Field, PageHeader, TextArea, TextInput } from "@/components/ui";
import {
  APPEARANCE_PRESETS,
  companionAppearanceOf,
  notifyCompanionsChanged,
  writeStoredCompanionId,
} from "@/lib/companions";
import { readReplyLanguage, writeReplyLanguage, type ReplyLanguage } from "@/lib/replyLanguage";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/** Colored initial avatars for the user profile (PNG — not the AI companion). */
const PROFILE_AVATAR_PRESETS: { id: string; label: string; bg: string; fg: string }[] = [
  { id: "lavender", label: "Lavender", bg: "#7c6cf0", fg: "#ffffff" },
  { id: "peach", label: "Peach", bg: "#e89a7a", fg: "#2a1f1a" },
  { id: "rose", label: "Rose", bg: "#d46b9a", fg: "#ffffff" },
  { id: "mint", label: "Mint", bg: "#4aa88a", fg: "#ffffff" },
  { id: "slate", label: "Slate", bg: "#5b6478", fg: "#ffffff" },
];

function profilePresetAvatar(letter: string, bg: string, fg: string): { mimeType: string; data: string } {
  const safe = (letter.trim().slice(0, 1) || "S").toUpperCase();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create avatar preview.");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = "700 110px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(safe, 128, 138);
  const dataUrl = canvas.toDataURL("image/png");
  const data = dataUrl.includes(",") ? dataUrl.split(",")[1] ?? "" : "";
  if (!data) throw new Error("Could not create avatar preview.");
  return { mimeType: "image/png", data };
}

function list(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function PreferencesPage() {
  useDocumentTitle("Preferences");
  const [form, setForm] = useState<Preferences | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.preferences().then((result) => setForm(result.preferences)).catch((loadError) => {
      console.error("Failed to load preferences", loadError);
      setError(loadError instanceof ApiError ? loadError.message : "Preferences could not be loaded.");
    });
  }, []);

  if (!form) return <div className="p-8 text-sm text-soft">{error || "Loading preferences…"}</div>;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const { saved, ...body } = form;
    void saved;
    try {
      const result = await api.savePreferences(body);
      setForm(result.preferences);
      setSaved(true);
      setError("");
    } catch (saveError) {
      console.error("Failed to save preferences", saveError);
      setSaved(false);
      setError(saveError instanceof ApiError ? saveError.message : "Preferences could not be saved.");
    }
  };

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader eyebrow="Optional" title="Food preferences" body="Used only when personalization is on. A preference is not proof that a meal is halal, allergen-free, or medically suitable." />
      <form onSubmit={(event) => void save(event)} className="panel max-w-xl space-y-4 p-4 sm:p-5">
        {error ? <Alert>{error}</Alert> : null}
        {saved ? <Alert>Preferences saved on your account.</Alert> : null}
        <Field label="Favorite cuisines" hint="Comma separated.">
          <TextInput value={form.favoriteCuisines.join(", ")} onChange={(event) => setForm({ ...form, favoriteCuisines: list(event.target.value) })} />
        </Field>
        <Field label="Favorite foods">
          <TextInput value={form.favoriteFoods.join(", ")} onChange={(event) => setForm({ ...form, favoriteFoods: list(event.target.value) })} />
        </Field>
        <Field label="Dislikes">
          <TextInput value={form.dislikes.join(", ")} onChange={(event) => setForm({ ...form, dislikes: list(event.target.value) })} />
        </Field>
        <Field label="Allergies">
          <TextInput value={form.allergies.join(", ")} onChange={(event) => setForm({ ...form, allergies: list(event.target.value) })} />
        </Field>
        <Field label="Other dietary notes">
          <TextInput value={form.dietaryRestrictions.join(", ")} onChange={(event) => setForm({ ...form, dietaryRestrictions: list(event.target.value) })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Budget">
            <select className="w-full rounded-2xl border border-line bg-muted px-3 py-2.5 text-sm" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value as Preferences["budget"] })}>
              <option value="any">Any</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Spice">
            <select className="w-full rounded-2xl border border-line bg-muted px-3 py-2.5 text-sm" value={form.spiceLevel} onChange={(event) => setForm({ ...form, spiceLevel: event.target.value as Preferences["spiceLevel"] })}>
              <option value="any">Any</option>
              <option value="mild">Mild</option>
              <option value="medium">Medium</option>
              <option value="hot">Hot</option>
            </select>
          </Field>
        </div>
        {(["vegetarian", "vegan", "halal", "personalizationEnabled"] as const).map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} />
            {key === "personalizationEnabled" ? "Use these preferences in AI replies" : key}
          </label>
        ))}
        <div className="flex gap-2">
          <Button type="submit">Save preferences</Button>
          <Button
            variant="danger"
            type="button"
            onClick={() => {
              void api.deletePreferences().then((result) => {
                setForm(result.preferences);
                setSaved(true);
              });
            }}
          >
            Delete preferences
          </Button>
        </div>
      </form>
    </div>
  );
}

const companionSchema = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(400),
  style: z.string().trim().min(10).max(800),
  appearance: z.enum(["female", "male", "neutral"]),
});

/** Style presets change how the AI speaks — not a second companion. */
const STYLE_PRESETS = [
  {
    id: "friendly",
    label: "Friendly",
    style:
      "Friendly and chatty AI companion. Match the user's language. Keep replies warm, natural, and short. Light emoji only when it fits. Ask one follow-up. You are AI, not a person.",
  },
  {
    id: "calm",
    label: "Calm",
    style:
      "Calm, steady AI companion. Soft tone, no rush. Acknowledge feelings, keep sentences simple, avoid hype. Rare emoji. You are AI, not a therapist.",
  },
  {
    id: "motivational",
    label: "Motivational",
    style:
      "Encouraging AI companion. Notice effort, suggest one small next step, stay realistic. Match language. Light emoji only when it fits. Not a coach who shouts slogans.",
  },
  {
    id: "emotional",
    label: "Emotional Support",
    style:
      "Supportive AI companion for loneliness, overthinking, and hard days. Validate first, listen more than advise, one gentle question. Soft emoji only when appropriate; never joke about serious distress. You are AI, not a clinician.",
  },
  {
    id: "study",
    label: "Study Companion",
    style:
      "Patient study buddy AI. Clear explanations, short steps, check understanding with one question. Prefer plain language over emoji. Encourage honest learning; no fake citations.",
  },
] as const;

const appearanceLabel: Record<CompanionAppearance, string> = {
  female: "Female AI Companion",
  male: "Male AI Companion",
  neutral: "Neutral AI Companion",
};

export function CompanionPage() {
  useDocumentTitle("Companion");
  const [items, setItems] = useState<Companion[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("");
  const [appearance, setAppearance] = useState<CompanionAppearance>("female");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [applying, setApplying] = useState<CompanionAppearance | null>(null);

  const load = () => {
    api.companions().then((result) => setItems(result.companions)).catch((loadError) => {
      console.error("Failed to load companions", loadError);
      setError(loadError instanceof ApiError ? loadError.message : "Companions could not be loaded.");
    });
  };
  useEffect(() => {
    load();
  }, []);

  const selected = items.find((item) => item.isDefault) ?? items[0] ?? null;

  const selectAppearance = async (preset: (typeof APPEARANCE_PRESETS)[number]) => {
    setApplying(preset.appearance);
    setError("");
    setNotice("");
    try {
      const match =
        items.find((item) => companionAppearanceOf(item) === preset.appearance) ??
        items.find((item) => item.name.trim().toLowerCase() === preset.name.toLowerCase());
      let companion: Companion;
      if (match) {
        const updated = await api.updateCompanion(match.id, {
          name: preset.name,
          description: preset.description,
          style: preset.style,
          appearance: preset.appearance,
        });
        companion = updated.companion;
      } else {
        const created = await api.createCompanion({
          name: preset.name,
          description: preset.description,
          style: preset.style,
          appearance: preset.appearance,
        });
        companion = created.companion;
      }
      if (!companion.isDefault) {
        const madeDefault = await api.defaultCompanion(companion.id);
        companion = madeDefault.companion;
      }
      writeStoredCompanionId(companion.id);
      notifyCompanionsChanged();
      setNotice(`${companion.name} is now your companion.`);
      load();
    } catch (selectError) {
      console.error("Failed to select companion appearance", selectError);
      setError(selectError instanceof ApiError ? selectError.message : "Could not update companion appearance.");
    } finally {
      setApplying(null);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = companionSchema.safeParse({ name, description, style, appearance });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the companion.");
      return;
    }
    try {
      if (editing) await api.updateCompanion(editing, parsed.data);
      else await api.createCompanion(parsed.data);
      setName("");
      setDescription("");
      setStyle("");
      setAppearance("female");
      setEditing(null);
      setError("");
      setNotice("Companion saved.");
      notifyCompanionsChanged();
      load();
    } catch (saveError) {
      console.error("Failed to save companion", saveError);
      setError(saveError instanceof ApiError ? saveError.message : "The companion could not be saved.");
    }
  };

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader
        eyebrow="Personalize"
        title="Companion"
        body="Choose an AI companion appearance. This is not your gender — pick whoever you prefer. Safety rules stay in place; companions never pretend to be human or clinicians."
      />
      {error ? <div className="mb-4 max-w-3xl"><Alert>{error}</Alert></div> : null}
      {notice ? <p className="mb-4 text-sm text-leaf">{notice}</p> : null}

      {selected ? (
        <div className="mb-8 flex max-w-3xl flex-wrap items-center gap-4 rounded-3xl border border-line bg-elevated/80 p-4">
          <CompanionAvatar appearance={companionAppearanceOf(selected)} name={selected.name} className="h-20 w-20" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-soft">Selected preview</p>
            <h2 className="font-serif text-3xl leading-none">{selected.name}</h2>
            <p className="mt-1 text-sm text-soft">{appearanceLabel[companionAppearanceOf(selected)]}</p>
          </div>
        </div>
      ) : null}

      <section className="mb-10 max-w-3xl" aria-label="Companion appearance">
        <h2 className="font-serif text-2xl">Appearance</h2>
        <p className="mt-1 text-sm text-soft">Saved to your account and used across New Chat and the chat header.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {APPEARANCE_PRESETS.map((preset) => {
            const active = selected ? companionAppearanceOf(selected) === preset.appearance : false;
            return (
              <button
                key={preset.appearance}
                type="button"
                className="companion-pick-card"
                data-selected={active ? "true" : "false"}
                aria-pressed={active}
                disabled={applying !== null}
                onClick={() => void selectAppearance(preset)}
              >
                <CompanionAvatar appearance={preset.appearance} name={preset.name} className="mx-auto h-20 w-20" />
                <p className="mt-3 font-serif text-2xl leading-none">{preset.name}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-lavender">{appearanceLabel[preset.appearance]}</p>
                <p className="mt-2 text-xs leading-5 text-soft">{preset.description}</p>
                <span className="mt-3 inline-flex text-xs font-semibold text-accent">
                  {applying === preset.appearance ? "Saving…" : active ? "Selected" : "Select"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <ul className="mb-8 max-w-3xl space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-3xl border border-line p-4">
            <div className="flex items-start gap-3">
              <CompanionAvatar appearance={companionAppearanceOf(item)} name={item.name} className="h-14 w-14" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-serif text-2xl">{item.name}</h3>
                  {item.isDefault ? <span className="text-xs uppercase tracking-[0.14em] text-leaf">Default</span> : null}
                </div>
                <p className="mt-1 text-xs text-soft">{appearanceLabel[companionAppearanceOf(item)]}</p>
                <p className="mt-2 text-sm leading-6 text-soft">{item.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setEditing(item.id);
                      setName(item.name);
                      setDescription(item.description);
                      setStyle(item.style);
                      setAppearance(companionAppearanceOf(item));
                    }}
                  >
                    Edit
                  </Button>
                  {!item.isDefault ? (
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() =>
                        void api.defaultCompanion(item.id).then((result) => {
                          writeStoredCompanionId(result.companion.id);
                          notifyCompanionsChanged();
                          load();
                        })
                      }
                    >
                      Make default
                    </Button>
                  ) : null}
                  <Button
                    variant="danger"
                    type="button"
                    onClick={() =>
                      void api
                        .deleteCompanion(item.id)
                        .then(() => {
                          notifyCompanionsChanged();
                          load();
                        })
                        .catch((deleteError) => setError(deleteError instanceof Error ? deleteError.message : "Could not delete."))
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={(event) => void submit(event)} className="max-w-xl space-y-4">
        <Field label="Name"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Description"><TextInput value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
        <Field label="Appearance">
          <select
            className="w-full rounded-2xl border border-line bg-muted px-3 py-2.5 text-sm"
            value={appearance}
            onChange={(event) => setAppearance(event.target.value as CompanionAppearance)}
            aria-label="Companion appearance"
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="neutral">Neutral</option>
          </select>
        </Field>
        <Field label="Response style presets" hint="Fills the speaking style below. Edit further if you want.">
          <div className="flex flex-wrap gap-2">
            {STYLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="rounded-full border border-line bg-muted px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:bg-accent-soft"
                onClick={() => setStyle(preset.style)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="How they speak"><TextArea rows={5} value={style} onChange={(event) => setStyle(event.target.value)} /></Field>
        <Button type="submit">{editing ? "Save companion" : "Create companion"}</Button>
      </form>
    </div>
  );
}

export function ProfilePage() {
  useDocumentTitle("Profile");
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [avatar, setAvatar] = useState<{ mimeType: string; data: string } | null>(user?.avatar ?? null);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [clearAvatar, setClearAvatar] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (!user) return null;

  const previewSrc = avatar ? `data:${avatar.mimeType};base64,${avatar.data}` : null;
  const initials = name.trim().slice(0, 1).toUpperCase() || "S";

  const pickPhoto = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setError("Use a JPEG, PNG, WebP, or GIF photo.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("Keep the photo under 1 MB.");
      return;
    }
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((value) => {
      binary += String.fromCharCode(value);
    });
    setAvatar({ mimeType: file.type, data: btoa(binary) });
    setAvatarDirty(true);
    setClearAvatar(false);
    setError("");
    setMessage("");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      const result = await api.updateMe({
        name,
        email,
        ...(clearAvatar ? { clearAvatar: true } : avatarDirty && avatar ? { avatar } : {}),
      });
      refresh(result.user);
      setAvatar(result.user.avatar ?? null);
      setAvatarDirty(false);
      setClearAvatar(false);
      setMessage("Profile saved.");
      setError("");
    } catch (saveError) {
      console.error("Failed to update profile", saveError);
      setError(saveError instanceof ApiError ? saveError.message : "Profile could not be saved.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        body={`This is your user photo and account details — separate from the AI companion avatar. Member since ${new Date(user.createdAt).toLocaleDateString()}.`}
      />
      <form onSubmit={(event) => void save(event)} className="max-w-md space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        {message ? <Alert>{message}</Alert> : null}
        <div className="flex items-center gap-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-line bg-muted text-2xl font-semibold text-accent">
            {previewSrc ? <img src={previewSrc} alt="" className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-sm text-soft">
              Upload, change, or remove your profile picture. This never changes Safa or your AI companion appearance.
            </p>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-line px-3 py-2 text-xs font-semibold transition hover:bg-muted">
              Choose photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => {
                  void pickPhoto(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            {previewSrc || user.avatar ? (
              <button
                type="button"
                className="ml-2 text-xs font-semibold text-accent"
                onClick={() => {
                  setAvatar(null);
                  setClearAvatar(true);
                  setAvatarDirty(false);
                  setMessage("");
                }}
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-soft">Or pick a simple avatar</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROFILE_AVATAR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="grid h-12 w-12 place-items-center rounded-full border border-line text-sm font-semibold transition hover:scale-105"
                style={{ background: preset.bg, color: preset.fg }}
                title={preset.label}
                aria-label={`Use ${preset.label} avatar`}
                onClick={() => {
                  try {
                    setAvatar(profilePresetAvatar(name || user.name || "S", preset.bg, preset.fg));
                    setAvatarDirty(true);
                    setClearAvatar(false);
                    setMessage("");
                    setError("");
                  } catch (presetError) {
                    console.error(presetError);
                    setError(presetError instanceof Error ? presetError.message : "Could not apply that avatar.");
                  }
                }}
              >
                {(name || user.name || "S").slice(0, 1).toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <Field label="Name"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
        {user.phone ? <p className="text-sm text-soft">Phone {user.phone}. Password codes for this number are texted here.</p> : null}
        <Field label={user.phone ? "Email, optional" : "Email"}><TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
      </form>
    </div>
  );
}

export function SettingsPage() {
  useDocumentTitle("Settings");
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [replyLanguage, setReplyLanguage] = useState<ReplyLanguage>(() => readReplyLanguage());

  useEffect(() => {
    api.health().then((result) => {
      setHealth(`Database ${result.database}. Gemini ${result.aiConfigured ? "configured" : "missing"}.`);
    }).catch((healthError) => {
      console.error("Health check failed", healthError);
      setHealth(healthError instanceof Error ? healthError.message : "The API could not be reached.");
    });
  }, []);

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader eyebrow="Control" title="Settings" body="Theme, the live service status, and account removal." />
      <section className="max-w-xl">
        <h2 className="font-serif text-3xl">Customize</h2>
        <p className="mt-2 text-sm leading-6 text-soft">Your profile photo and the AI companion are separate settings.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/app/profile" className="rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:bg-muted">
            Profile &amp; photo
          </Link>
          <Link to="/app/companion" className="rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:bg-muted">
            AI companion
          </Link>
        </div>
      </section>
      <section className="mt-8 max-w-xl">
        <h2 className="font-serif text-3xl">Reply language</h2>
        <p className="mt-2 text-sm leading-6 text-soft">Auto detect follows each message. A chosen language is used until you change it, unless you ask for a different language in the message.</p>
        <div className="mt-3">
          <ReplyLanguageSelect
            value={replyLanguage}
            onChange={(language) => {
              setReplyLanguage(language);
              writeReplyLanguage(language);
            }}
          />
        </div>
      </section>
      <section className="mt-8 max-w-xl">
        <h2 className="font-serif text-3xl">Theme</h2>
        <div className="mt-3 flex gap-2">
          {(["dark", "light"] as const).map((option) => (
            <button key={option} type="button" aria-pressed={theme === option} onClick={() => setTheme(option)} className={`rounded-full border px-4 py-2 text-sm capitalize ${theme === option ? "border-accent bg-accent-soft" : "border-line"}`}>
              {option}
            </button>
          ))}
        </div>
      </section>
      <section className="mt-10 max-w-xl text-sm leading-6 text-soft">
        <h2 className="font-serif text-3xl text-ink">Services</h2>
        <p className="mt-3">{health}</p>
        <p className="mt-3">Chat text is processed by Google Gemini. The browser keeps a session token so this site can call the API when it is hosted on another domain.</p>
      </section>
      <section className="mt-10 max-w-xl">
        <h2 className="font-serif text-3xl">Password</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void api.changePassword({ currentPassword, nextPassword }).then((result) => {
              setAuthToken(result.token);
              setPasswordMessage("Password updated.");
              setCurrentPassword("");
              setNextPassword("");
            }).catch((passwordError) => {
              console.error("Password change failed", passwordError);
              setError(passwordError instanceof ApiError ? passwordError.message : "Password could not be changed.");
            });
          }}
        >
          {passwordMessage ? <Alert>{passwordMessage}</Alert> : null}
          <Field label="Current password"><TextInput type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></Field>
          <Field label="New password"><TextInput type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} /></Field>
          <Button type="submit">Update password</Button>
        </form>
      </section>
      <section className="mt-10 max-w-xl">
        <h2 className="font-serif text-3xl">Delete account</h2>
        <p className="mt-3 text-sm leading-6 text-soft">This removes your user, chats, journal, preferences, and companions.</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void api.deleteAccount({ password: deletePassword, confirm: "DELETE" }).then(async () => {
              setAuthToken(null);
              await logout();
              navigate("/");
            }).catch((deleteError) => {
              console.error("Account deletion failed", deleteError);
              setError(deleteError instanceof ApiError ? deleteError.message : "The account could not be deleted.");
            });
          }}
        >
          {error ? <Alert>{error}</Alert> : null}
          <Field label="Password"><TextInput type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></Field>
          <Field label="Type DELETE"><TextInput value={confirm} onChange={(event) => setConfirm(event.target.value)} /></Field>
          <Button variant="danger" type="submit" disabled={confirm !== "DELETE"}>Delete account</Button>
        </form>
      </section>
    </div>
  );
}
