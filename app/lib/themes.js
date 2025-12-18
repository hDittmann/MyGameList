export const THEMES = [
  { id: "dark", label: "Dark" },
  { id: "midnight", label: "Midnight" },
  { id: "purple", label: "Purple" },
  { id: "forest", label: "Forest" },
  { id: "rose", label: "Rose" },
  { id: "light", label: "Light" },
  { id: "paper", label: "Paper" },
];

export function normalizeTheme(value) {
  const raw = typeof value === "string" ? value : "";
  const found = THEMES.some((t) => t.id === raw);
  return found ? raw : "dark";
}
