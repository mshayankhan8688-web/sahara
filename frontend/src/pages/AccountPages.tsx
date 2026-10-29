import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { api, ApiError, setAuthToken } from "@/lib/api";
import type { Companion, Preferences } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { ReplyLanguageSelect } from "@/components/ReplyLanguageSelect";
import { Alert, Button, Field, PageHeader, TextArea, TextInput } from "@/components/ui";
import { readReplyLanguage, writeReplyLanguage, type ReplyLanguage } from "@/lib/replyLanguage";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

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
});

export function CompanionPage() {
  useDocumentTitle("Companion");
  const [items, setItems] = useState<Companion[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    api.companions().then((result) => setItems(result.companions)).catch((loadError) => {
      console.error("Failed to load companions", loadError);
      setError(loadError instanceof ApiError ? loadError.message : "Companions could not be loaded.");
    });
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = companionSchema.safeParse({ name, description, style });
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
      setEditing(null);
      setError("");
      load();
    } catch (saveError) {
      console.error("Failed to save companion", saveError);
      setError(saveError instanceof ApiError ? saveError.message : "The companion could not be saved.");
    }
  };

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader eyebrow="Voice" title="Companion" body="Safety rules stay in place. A companion can change tone, not pretend to be human or a clinician." />
      {error ? <div className="mb-4 max-w-xl"><Alert>{error}</Alert></div> : null}
      <ul className="mb-8 max-w-xl space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-3xl border border-line p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-3xl">{item.name}</h2>
              {item.isDefault ? <span className="text-xs uppercase tracking-[0.14em] text-leaf">Default</span> : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-soft">{item.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="ghost" type="button" onClick={() => { setEditing(item.id); setName(item.name); setDescription(item.description); setStyle(item.style); }}>Edit</Button>
              {!item.isDefault ? <Button variant="ghost" type="button" onClick={() => void api.defaultCompanion(item.id).then(load)}>Make default</Button> : null}
              <Button variant="danger" type="button" onClick={() => void api.deleteCompanion(item.id).then(load).catch((deleteError) => setError(deleteError instanceof Error ? deleteError.message : "Could not delete."))}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={(event) => void submit(event)} className="max-w-xl space-y-4">
        <Field label="Name"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Description"><TextInput value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
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
      setError("JPEG, PNG, WebP, ya GIF photo use karein.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("Photo 1 MB se choti rakhein.");
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
      <PageHeader eyebrow="Account" title="Profile" body={`Member since ${new Date(user.createdAt).toLocaleDateString()}.`} />
      <form onSubmit={(event) => void save(event)} className="max-w-md space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        {message ? <Alert>{message}</Alert> : null}
        <div className="flex items-center gap-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-line bg-muted text-2xl font-semibold text-accent">
            {previewSrc ? <img src={previewSrc} alt="" className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-sm text-soft">Apni profile pic yahan lagayein. Har account ki apni photo save hoti hai.</p>
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
