import { replyLanguages, type ReplyLanguage } from "@/lib/replyLanguage";

export function ReplyLanguageSelect({
  value,
  onChange,
}: {
  value: ReplyLanguage;
  onChange: (language: ReplyLanguage) => void;
}) {
  return (
    <label className="text-xs text-soft">
      Reply language
      <select
        className="ml-2 min-h-10 rounded-full border border-line bg-muted px-3 py-1.5 text-sm text-ink"
        value={value}
        aria-label="Reply language"
        onChange={(event) => onChange(event.target.value as ReplyLanguage)}
      >
        {replyLanguages.map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
