"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { FilterPill } from "./FilterControls";

const TAG_UNIVERSE_TTL_MS = 10 * 60_000;

let tagUniverseCache = {
  fetchedAt: 0,
  value: null,
  promise: null,
};

function normalizeTagList(list) {
  // trim + dedupe (case-insensitive) so the ui doesn't get noisy
  const out = [];
  const seen = new Set();
  for (const raw of list ?? []) {
    const name = String(raw ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function mergeTagsByType(a, b) {
  // merge the standard tag buckets we use across the app
  const types = ["genres", "themes", "modes", "perspectives"];
  const out = {};
  for (const t of types) {
    out[t] = normalizeTagList([...(a?.[t] ?? []), ...(b?.[t] ?? [])]);
  }
  return out;
}

async function fetchTagUniverse() {
  // tiny shared cache so we don't re-fetch tags on every page/modal
  const now = Date.now();
  if (tagUniverseCache.value && now - tagUniverseCache.fetchedAt < TAG_UNIVERSE_TTL_MS) {
    return tagUniverseCache.value;
  }
  if (tagUniverseCache.promise) {
    return tagUniverseCache.promise;
  }

  // grab a decent slice of games from both endpoints, then build a tag universe
  tagUniverseCache.promise = (async () => {
    const params = new URLSearchParams({ pageSize: "50", page: "1" });
    const [topRes, newRes] = await Promise.all([
      fetch(`/api/igdb/top-games?${params.toString()}`),
      fetch(`/api/igdb/new-releases?${params.toString()}`),
    ]);

    const topJson = await topRes.json().catch(() => null);
    const newJson = await newRes.json().catch(() => null);

    if (!topRes.ok && !newRes.ok) {
      throw new Error(topJson?.error ?? newJson?.error ?? "Failed to fetch tags");
    }

    function extract(payload) {
      const byType = {};
      for (const g of payload?.games ?? []) {
        const t = g?.tagsByType;
        if (!t) continue;
        const next = mergeTagsByType(byType, t);
        Object.assign(byType, next);
      }
      return byType;
    }

    const topTags = extract(topJson);
    const newTags = extract(newJson);
    return mergeTagsByType(topTags, newTags);
  })();

  try {
    const tags = await tagUniverseCache.promise;
    tagUniverseCache.value = tags;
    tagUniverseCache.fetchedAt = Date.now();
    return tags;
  } finally {
    tagUniverseCache.promise = null;
  }
}

export default function TagPickerModal({ open, selectedTags, onChange, onClose, availableTagsByType }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetchedTags, setFetchedTags] = useState(null);

  const effectiveTagsByType = useMemo(() => {
    const hasAvailable = availableTagsByType && Object.keys(availableTagsByType).length;
    if (hasAvailable && fetchedTags) return mergeTagsByType(fetchedTags, availableTagsByType);
    return hasAvailable ? availableTagsByType : fetchedTags;
  }, [availableTagsByType, fetchedTags]);

  const selected = useMemo(() => {
    const out = new Set();
    for (const t of selectedTags ?? []) {
      const key = String(t ?? "").trim().toLowerCase();
      if (key) out.add(key);
    }
    return out;
  }, [selectedTags]);

  useEffect(() => {
    if (!open) return;
    if (fetchedTags) return;

    // if the parent already gave us a tag universe, don't waste two api calls
    const hasAvailable = availableTagsByType && Object.keys(availableTagsByType).length;
    if (hasAvailable) return;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");
      try {
        const tags = await fetchTagUniverse();
        if (cancelled) return;
        setFetchedTags(tags);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load tags");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [open, fetchedTags, availableTagsByType]);

  const toggle = useCallback(
    (name) => {
      const trimmed = String(name ?? "").trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      const current = Array.isArray(selectedTags) ? selectedTags : [];
      const exists = current.some((t) => String(t).trim().toLowerCase() === key);
      const next = exists
        ? current.filter((t) => String(t).trim().toLowerCase() !== key)
        : [...current, trimmed];
      onChange?.(next);
    },
    [selectedTags, onChange]
  );

  const close = useCallback(() => {
    if (!open) return;
    onClose?.();
  }, [open, onClose]);

  if (!open) return null;

  const groups = [
    ["Genres", effectiveTagsByType?.genres],
    ["Themes", effectiveTagsByType?.themes],
    ["Modes", effectiveTagsByType?.modes],
    ["Perspectives", effectiveTagsByType?.perspectives],
  ].filter(([, list]) => Array.isArray(list) && list.length);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center px-4 bg-black/60"
      onClick={close}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      }}
      tabIndex={-1}
    >
      <div
        className="flex w-full max-w-3xl max-h-[90vh] flex-col border-2 border-(--border) bg-(--surface)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-(--border) px-4 py-3">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            Pick Tags
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange?.([])}
              className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground"
              title="Clear selected tags"
            >
              Clear Tags
            </button>
            <button
              type="button"
              onClick={close}
              className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground"
            >
              Done
            </button>
          </div>
        </div>

        <div className="px-4 py-4 overflow-y-auto">
          {loading ? <div className="text-sm text-(--muted)">Loading tags…</div> : null}
          {error ? <div className="mt-2 text-sm text-(--muted)">{error}</div> : null}

          {groups.length ? (
            <div className="grid grid-cols-1 gap-4">
              {groups.map(([label, list]) => (
                <div key={label} className="border-2 border-(--border) bg-(--surface) p-3">
                  <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">{label}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {list.map((name) => (
                      <FilterPill
                        key={`${label}:${name}`}
                        active={selected.has(String(name).toLowerCase())}
                        onClick={() => toggle(name)}
                        title={name}
                      >
                        {name}
                      </FilterPill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : !loading ? (
            <div className="text-sm text-(--muted)">No tags available.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
