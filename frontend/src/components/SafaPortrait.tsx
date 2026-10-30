import { CompanionAvatar } from "@/components/CompanionAvatar";

/** Premium Safa portrait for chat header / welcome — separate from the user profile photo. */
export function SafaPortrait({
  className = "h-28 w-28",
  mood = "idle",
  showHearts = false,
}: {
  className?: string;
  mood?: "idle" | "thinking" | "listening" | "speaking";
  showHearts?: boolean;
}) {
  return (
    <div className={`safa-portrait ${className}`} aria-hidden="true">
      {showHearts ? (
        <>
          <span className="safa-portrait-heart" />
          <span className="safa-portrait-heart" />
          <span className="safa-portrait-heart" />
        </>
      ) : null}
      <span className="safa-portrait-glow" />
      <span className="safa-portrait-ring" />
      <CompanionAvatar appearance="female" name="Safa" mood={mood} className="relative z-[2] h-full w-full" />
    </div>
  );
}
