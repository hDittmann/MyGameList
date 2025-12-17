"use client";

export default function ExpandableLine({ id, text, expanded, onToggle, previewChars = 56 }) {
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) return <span className="text-(--muted)">—</span>;

  const canExpand = raw.length > previewChars;
  const showFull = Boolean(expanded) || !canExpand;
  const display = showFull ? raw : `${raw.slice(0, previewChars).trimEnd()}…`;

  if (!canExpand) {
    return <span className="text-foreground leading-snug break-words">{display}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onToggle?.(id, !showFull)}
      className="cursor-pointer text-left text-foreground leading-snug break-words hover:underline underline-offset-4"
      title={showFull ? "Click to collapse" : "Click to expand"}
    >
      {display}
    </button>
  );
}
