import type { CompanionAppearance } from "@/lib/types";

const labels: Record<CompanionAppearance, string> = {
  female: "Female AI companion avatar",
  male: "Male AI companion avatar",
  neutral: "Neutral AI companion avatar",
};

/** Soft CSS avatar — distinct silhouettes without heavy assets or stock photos. */
export function CompanionAvatar({
  appearance = "female",
  name,
  className = "h-16 w-16",
  mood = "idle",
}: {
  appearance?: CompanionAppearance;
  name?: string;
  className?: string;
  mood?: "idle" | "thinking" | "listening" | "speaking";
}) {
  return (
    <div
      className={`companion-avatar companion-avatar-${appearance} companion-mood-${mood} ${className}`}
      role="img"
      aria-label={name ? `${name} — ${labels[appearance]}` : labels[appearance]}
    >
      <span className="companion-avatar-glow" aria-hidden="true" />
      <span className="companion-avatar-ring" aria-hidden="true" />
      <span className="companion-avatar-face" aria-hidden="true">
        <span className="companion-avatar-hair" />
        <span className="companion-avatar-eyes" />
        <span className="companion-avatar-smile" />
      </span>
    </div>
  );
}

export function companionGreeting(name: string, appearance: CompanionAppearance): { title: string; body: string } {
  if (appearance === "male") {
    return {
      title: `Hey, I'm ${name || "Rayyan"} 😊`,
      body: "I'm here to listen, chat, help you study, or keep you company.",
    };
  }
  if (appearance === "neutral") {
    return {
      title: `Hey, I'm your ${name || "SAHARA"} companion ✨`,
      body: "What would you like to talk about today?",
    };
  }
  return {
    title: `Hey, I'm ${name || "Safa"} 🌸`,
    body: "I'm here to listen, chat, help you study, or just keep you company.",
  };
}
