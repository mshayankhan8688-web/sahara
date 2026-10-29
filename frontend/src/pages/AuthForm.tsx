import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Field, TextInput, Wordmark } from "@/components/ui";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(60),
  contact: z.string().trim().min(3, "Enter an email or phone number.").max(120),
  password: z.string().min(8, "Use at least 8 characters.").max(72),
});

const loginSchema = z.object({
  email: z.string().trim().min(3, "Enter your email or phone number.").max(120),
  password: z.string().min(1, "Enter your password."),
});

function Frame({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Link to="/" className="mb-10">
        <Wordmark />
      </Link>
      <h1 className="font-serif text-5xl">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-soft">{body}</p>
      <div className="mt-8">{children}</div>
    </main>
  );
}

function issues(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]));
}

export function LoginPage() {
  useDocumentTitle("Login");
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  if (user) return <Navigate to="/app/chat" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(issues(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await login(parsed.data);
      navigate("/app", { replace: true });
    } catch (error) {
      console.error("Login failed", error);
      setFormError(error instanceof ApiError ? error.message : "Unable to sign in.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Frame title="Welcome back" body="Your chats, journal, and food notes stay on your account.">
      <form className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
        {formError ? <Alert>{formError}</Alert> : null}
        <Field label="Email or phone" error={errors.email}>
          <TextInput autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Password" error={errors.password}>
          <TextInput type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Login"}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link to="/forgot" className="text-ink">Forgot password?</Link>
      </p>
      <p className="mt-6 text-sm text-soft">
        New here? <Link to="/register" className="text-ink">Create an account</Link>
      </p>
    </Frame>
  );
}

export function ForgotPasswordPage() {
  useDocumentTitle("Forgot password");
  const { user } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState<"email" | "phone" | null>(null);
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  if (user) return <Navigate to="/app/chat" replace />;

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    setPending(true);
    try {
      const result = await api.forgotPassword({ identifier });
      setSent(result.channel);
      if (result.localCode) {
        setCode(result.localCode);
        setNotice(`${result.message} Local code: ${result.localCode}`);
      } else {
        setNotice(result.message);
      }
    } catch (error) {
      console.error("Password reset request failed", error);
      setFormError(error instanceof ApiError ? error.message : "The code could not be sent.");
    } finally {
      setPending(false);
    }
  };

  const reset = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    setPending(true);
    try {
      const result = await api.resetPassword({ identifier, code, password });
      setNotice(result.message);
      setSent(null);
    } catch (error) {
      console.error("Password reset failed", error);
      setFormError(error instanceof ApiError ? error.message : "The password could not be changed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Frame title="Reset password" body="The code goes to the email on the account. If the account was created with a phone number, the code is texted to that number.">
      {formError ? <Alert>{formError}</Alert> : null}
      {notice ? <p className="mb-4 text-sm leading-6 text-soft">{notice}</p> : null}
      {sent ? (
        <form className="space-y-4" onSubmit={(event) => void reset(event)}>
          <Field label="Code">
            <TextInput inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <TextInput type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Update password"}</Button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={(event) => void requestCode(event)}>
          <Field label="Email or phone">
            <TextInput autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
          </Field>
          <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send code"}</Button>
        </form>
      )}
      <p className="mt-6 text-sm text-soft">
        <Link to="/login" className="text-ink">Back to login</Link>
      </p>
    </Frame>
  );
}

export function RegisterPage() {
  useDocumentTitle("Create account");
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  if (user) return <Navigate to="/app/chat" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = registerSchema.safeParse({ name, contact, password });
    if (!parsed.success) {
      setErrors(issues(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const value = parsed.data.contact.trim();
      await register(
        value.includes("@")
          ? { name: parsed.data.name, email: value, password: parsed.data.password }
          : { name: parsed.data.name, phone: value, password: parsed.data.password },
      );
      navigate("/app", { replace: true });
    } catch (error) {
      console.error("Registration failed", error);
      setFormError(error instanceof ApiError ? error.message : "Unable to create the account.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Frame title="Get started" body="You'll meet Safa, the default AI companion. Password codes go to the email or phone you use here.">
      <form className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
        {formError ? <Alert>{formError}</Alert> : null}
        <Field label="Name" error={errors.name}>
          <TextInput autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Email or phone" error={errors.contact}>
          <TextInput autoComplete="username" value={contact} onChange={(event) => setContact(event.target.value)} />
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters. The server stores a hash, not the password.">
          <TextInput type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating account…" : "Start Chatting"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-soft">
        Already registered? <Link to="/login" className="text-ink">Login</Link>
      </p>
    </Frame>
  );
}
