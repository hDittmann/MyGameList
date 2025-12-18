export const DEFAULT_MATURE_KEYWORDS = [
  "nsfw",
  "porn",
  "porno",
  "pornographic",
  "hentai",
  "ecchi",
  "sex",
  "sexual",
  "erotic",
  "erotica",
  "nude",
  "nudity",
  "naked",
  "xxx",
  "adult",
  "fetish",
  "bdsm",
  "pervert"
];

// mature filter is on by default across browse + add flows

function normalizeText(value) {
  // keep it simple: lower-case + collapse whitespace
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function containsMatureKeyword(text, keywords = DEFAULT_MATURE_KEYWORDS) {
  const haystack = normalizeText(text);
  if (!haystack) return false;

  // tokenize so short words like "sex" are less likely to false-match
  const tokens = new Set(haystack.split(/[^a-z0-9]+/g).filter(Boolean));

  for (const raw of keywords ?? []) {
    const k = normalizeText(raw);
    if (!k) continue;

    if (k.length <= 4) {
      if (tokens.has(k)) return true;
      continue;
    }

    if (haystack.includes(k)) return true;
  }

  return false;
}

export function isMatureGame(game, keywords = DEFAULT_MATURE_KEYWORDS) {
  const title = game?.name ?? game?.title ?? "";
  const summary = game?.summary ?? "";
  const tags = Array.isArray(game?.tags) ? game.tags.join(" ") : "";
  return (
    containsMatureKeyword(title, keywords) ||
    containsMatureKeyword(summary, keywords) ||
    containsMatureKeyword(tags, keywords)
  );
}
