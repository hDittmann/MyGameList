"use client";

export default function ExpandableText({
  id,
  text,
  expanded,
  onToggle,
  previewChars = 220,
}) {
  const summary = typeof text === "string" ? text.trim() : "";
  if (!summary) {
    return <p className="mt-3 text-xs text-(--muted)">No description.</p>;
  }

  const canExpand = summary.length > previewChars;
  const showFull = Boolean(expanded) || !canExpand;
  const display = showFull ? summary : `${summary.slice(0, previewChars).trimEnd()}…`;

  return (
    <p className="mt-3 text-xs text-(--muted)">
      {display}{" "}
      {canExpand ? (
        <button
          type="button"
          onClick={() => onToggle?.(id, !showFull)}
          className="cursor-pointer font-semibold text-white/70 underline-offset-4 hover:text-foreground hover:underline"
        >
          {showFull ? "Show less" : "Read more…"}
        </button>
      ) : null}
    </p>
  );
}
