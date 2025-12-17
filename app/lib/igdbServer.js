import "server-only";

import { isMatureGame } from "./matureFilter";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_GAMES_URL = "https://api.igdb.com/v4/games";

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;

const IGDB_MAX_LIMIT_PER_REQUEST = 500;
const DEFAULT_PAGE_SIZE = 20;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken() {

  const now = Date.now();
  if (cachedToken && cachedTokenExpiresAt - now > 60_000) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Token request failed: ${JSON.stringify(data)}`);
  }

  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + (Number(data.expires_in) || 0) * 1000;
  return cachedToken;
}

async function igdbQuery(accessToken, queryLines) {

  const body = queryLines.join("\n");
  const response = await fetch(IGDB_GAMES_URL, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "text/plain",
    },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`IGDB query failed: ${JSON.stringify(data)}`);
  }

  return data;
}

function getIgdbImageUrl(imageId, size) {
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
}

function isMainGameRecord(game) {
  return game?.version_parent == null && game?.parent_game == null;
}

function filterToMainGames(games) {
  return (games ?? []).filter(isMainGameRecord);
}

function mean(numbers) {
  let sum = 0;
  let count = 0;
  for (const n of numbers ?? []) {
    const x = Number(n);
    if (Number.isFinite(x)) {
      sum += x;
      count += 1;
    }
  }
  return count === 0 ? null : sum / count;
}

function computeWeightedRating({ averageRating, voteCount, globalAverage, minVotes }) {
  // Bayesian-weighted score: (v/(v+m))*R + (m/(v+m))*C
  const R = Number(averageRating);
  const v = Number(voteCount);
  const C = Number(globalAverage);
  const m = Number(minVotes);

  if (!Number.isFinite(R) || !Number.isFinite(v) || v <= 0) return null;
  if (!Number.isFinite(C)) return null;
  if (!Number.isFinite(m) || m < 0) return null;

  return (v / (v + m)) * R + (m / (v + m)) * C;
}

function normalizeNameList(items) {
  const names = [];
  const seen = new Set();
  for (const it of items ?? []) {
    const name = typeof it?.name === "string" ? it.name.trim() : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function normalizeGames(games, { coverSize }) {
  return (games ?? []).map((g) => {
    const imageId = g?.cover?.image_id;

    const tagsByType = {
      genres: normalizeNameList(g?.genres),
      themes: normalizeNameList(g?.themes),
      modes: normalizeNameList(g?.game_modes),
      perspectives: normalizeNameList(g?.player_perspectives),
    };

    const tags = [
      ...tagsByType.genres,
      ...tagsByType.themes,
      ...tagsByType.modes,
      ...tagsByType.perspectives,
    ];

    return {
      id: g?.id ?? null,
      name: g?.name ?? "",
      summary: g?.summary ?? null,
      first_release_date: g?.first_release_date ?? null,
      rating: g?.rating ?? null,
      rating_count: g?.rating_count ?? null,
      aggregated_rating: g?.aggregated_rating ?? null,
      aggregated_rating_count: g?.aggregated_rating_count ?? null,
      total_rating: g?.total_rating ?? null,
      total_rating_count: g?.total_rating_count ?? null,
      weighted_rating: g?.weighted_rating ?? null,
      weighted_rating_meta: g?.weighted_rating_meta ?? null,
      coverImageId: imageId ?? null,
      coverUrl: imageId ? getIgdbImageUrl(imageId, coverSize) : null,
      category: g?.category ?? null,
      tags,
      tagsByType,
    };
  });
}

function getDisplayRating(game) {
  return game?.weighted_rating ?? game?.total_rating ?? game?.aggregated_rating ?? game?.rating ?? null;
}

function normalizeTagFilters(tags) {
  return (tags ?? [])
    .map((t) => String(t ?? "").trim())
    .filter(Boolean);
}

function applyFilters(games, { minRating = 0, tagFilters = [], hideMature = true }) {
  const safeMinRating = Number(minRating) || 0;
  const wanted = normalizeTagFilters(tagFilters).map((t) => t.toLowerCase());

  return (games ?? []).filter((g) => {
    if (hideMature && isMatureGame(g)) return false;

    if (safeMinRating > 0) {
      const r = Number(getDisplayRating(g) ?? -1);
      if (!Number.isFinite(r) || r < safeMinRating) return false;
    }

    if (wanted.length) {
      const haystack = (Array.isArray(g?.tags) ? g.tags : []).map((t) => String(t).toLowerCase());
      // Require every filter term to match at least one tag.
      const ok = wanted.every((w) => haystack.some((tag) => tag.includes(w)));
      if (!ok) return false;
    }

    return true;
  });
}

let cachedResults = new Map();

function getCacheKey({ mode, q, coverSize }) {
  return JSON.stringify({ mode, q: q ?? "", coverSize });
}

export async function fetchIgdbGames({
  mode,
  q,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  coverSize = "t_cover_big",
  minRating = 0,
  tagFilters = [],
  hideMature = true,
}) {
  const safePageSize = Math.max(1, Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE));
  const safePage = Math.max(1, Number(page) || 1);
  const queryText = typeof q === "string" ? q.trim() : "";

  const cacheKey = JSON.stringify({
    ...JSON.parse(getCacheKey({ mode, q: queryText, coverSize })),
    minRating: Number(minRating) || 0,
    tagFilters: normalizeTagFilters(tagFilters),
    hideMature: Boolean(hideMature),
  });
  const existing = cachedResults.get(cacheKey);
  if (existing && Date.now() - existing.cachedAt < 5 * 60_000) {
    const all = existing.payload?.gamesAll ?? [];
    const start = (safePage - 1) * safePageSize;
    const pageGames = all.slice(start, start + safePageSize);
    return {
      fetchedAt: existing.payload.fetchedAt,
      mode: existing.payload.mode,
      q: existing.payload.q,
      page: safePage,
      pageSize: safePageSize,
      total: all.length,
      count: pageGames.length,
      hasMore: start + safePageSize < all.length,
      games: pageGames,
    };
  }

  const accessToken = await getAccessToken();

  const fieldsLine =
    "fields id, name, summary, rating, rating_count, aggregated_rating, aggregated_rating_count, total_rating, total_rating_count, first_release_date, category, version_parent, parent_game, cover.image_id, genres.name, themes.name, game_modes.name, player_perspectives.name;";
  const baseWhere = "version_parent = null & parent_game = null";

  let payload;
  const startIndex = (safePage - 1) * safePageSize;

  if (queryText) {
    // IGDB disallows combining search+sort; we'll sort server-side then paginate.
    const escaped = queryText.replaceAll('"', "\\\"");
    const candidateLimit = IGDB_MAX_LIMIT_PER_REQUEST;
    const queryLines = [
      fieldsLine,
      `search \"${escaped}\";`,
      `where ${baseWhere};`,
      `limit ${candidateLimit};`,
    ];

    const raw = await igdbQuery(accessToken, queryLines);
    const normalized = normalizeGames(raw, { coverSize });
    let mainGames = filterToMainGames(normalized);

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (mode === "new-releases") {
      // For New Releases search: only show already-released games (no upcoming).
      mainGames = mainGames.filter((g) => {
        const d = Number(g?.first_release_date);
        return Number.isFinite(d) && d > 0 && d <= nowSeconds;
      });
      mainGames.sort((a, b) => Number(b?.first_release_date ?? -1) - Number(a?.first_release_date ?? -1));
    } else if (mode === "top-games") {
      // For Top Games search: approximate sort by rating then vote count.
      mainGames.sort((a, b) => {
        const br = Number(b?.total_rating ?? b?.aggregated_rating ?? b?.rating ?? -1);
        const ar = Number(a?.total_rating ?? a?.aggregated_rating ?? a?.rating ?? -1);
        if (br !== ar) return br - ar;
        const bv = Number(b?.total_rating_count ?? b?.aggregated_rating_count ?? b?.rating_count ?? -1);
        const av = Number(a?.total_rating_count ?? a?.aggregated_rating_count ?? a?.rating_count ?? -1);
        return bv - av;
      });
    }

    // Ensure uniqueness and stable slicing.
    const unique = [];
    const seen = new Set();
    for (const g of mainGames) {
      if (g?.id == null) continue;
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      unique.push(g);
    }

    const filtered = applyFilters(unique, { minRating, tagFilters, hideMature });

    payload = {
      fetchedAt: new Date().toISOString(),
      mode,
      q: queryText,
      gamesAll: filtered,
    };
  } else if (mode === "top-games") {
    // "Top games" should consider both rating and vote count.
    // We'll approximate IGDB's weighted approach with a larger candidate pool.
    const candidatePoolLimit = IGDB_MAX_LIMIT_PER_REQUEST;
    const baselineSampleLimit = 500;
    const minVotes = 2000;

    const ratingCandidatesQuery = [
      fieldsLine,
      `where total_rating > 0 & total_rating_count > 0 & ${baseWhere};`,
      "sort total_rating desc;",
      `limit ${candidatePoolLimit};`,
    ];

    const voteCandidatesQuery = [
      fieldsLine,
      `where total_rating > 0 & total_rating_count > 0 & ${baseWhere};`,
      "sort total_rating_count desc;",
      `limit ${candidatePoolLimit};`,
    ];

    const baselineQuery = [
      fieldsLine,
      `where total_rating > 0 & total_rating_count > 0 & ${baseWhere};`,
      "sort total_rating_count desc;",
      `limit ${baselineSampleLimit};`,
    ];

    const [rawByRating, rawByVotes, rawBaseline] = await Promise.all([
      igdbQuery(accessToken, ratingCandidatesQuery),
      igdbQuery(accessToken, voteCandidatesQuery),
      igdbQuery(accessToken, baselineQuery),
    ]);

    const mergedMap = new Map();
    for (const g of [...(rawByRating ?? []), ...(rawByVotes ?? [])]) {
      if (g && typeof g.id === "number") mergedMap.set(g.id, g);
    }

    const merged = normalizeGames(Array.from(mergedMap.values()), { coverSize });
    const mainCandidates = filterToMainGames(merged);

    const baselineNormalized = normalizeGames(rawBaseline ?? [], { coverSize });
    const baselineMain = filterToMainGames(baselineNormalized);
    const globalAverage =
      mean(baselineMain.map((g) => g.total_rating)) ?? mean(mainCandidates.map((g) => g.total_rating));

    const ranked = mainCandidates
      .map((g) => {
        const score = computeWeightedRating({
          averageRating: g.total_rating,
          voteCount: g.total_rating_count,
          globalAverage,
          minVotes,
        });
        return { game: g, score };
      })
      .filter((x) => x.score != null)
      .sort((a, b) => b.score - a.score);

    const top = ranked.slice(0, IGDB_MAX_LIMIT_PER_REQUEST).map((x) => ({
      ...x.game,
      weighted_rating: x.score,
      weighted_rating_meta: { globalAverage, minVotes },
    }));

    const unique = [];
    const seen = new Set();
    for (const g of top) {
      if (g?.id == null) continue;
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      unique.push(g);
    }

    const filtered = applyFilters(unique, { minRating, tagFilters, hideMature });

    payload = {
      fetchedAt: new Date().toISOString(),
      mode,
      q: null,
      gamesAll: filtered,
    };
  } else if (mode === "new-releases") {
    // New releases candidate pool, then filter/paginate server-side.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const candidateLimit = IGDB_MAX_LIMIT_PER_REQUEST;

    const queryLines = [
      fieldsLine,
      `where first_release_date != null & first_release_date <= ${nowSeconds} & ${baseWhere};`,
      "sort first_release_date desc;",
      `limit ${candidateLimit};`,
    ];

    const raw = await igdbQuery(accessToken, queryLines);
    const normalized = normalizeGames(raw, { coverSize });
    const mainGames = filterToMainGames(normalized);

    const unique = [];
    const seen = new Set();
    for (const g of mainGames) {
      if (g?.id == null) continue;
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      unique.push(g);
    }

    const filtered = applyFilters(unique, { minRating, tagFilters, hideMature });

    payload = {
      fetchedAt: new Date().toISOString(),
      mode,
      q: null,
      gamesAll: filtered,
    };
  } else {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  cachedResults.set(cacheKey, { cachedAt: Date.now(), payload });

  const all = payload?.gamesAll ?? [];
  const pageGames = all.slice(startIndex, startIndex + safePageSize);
  return {
    fetchedAt: payload.fetchedAt,
    mode: payload.mode,
    q: payload.q,
    page: safePage,
    pageSize: safePageSize,
    total: all.length,
    count: pageGames.length,
    hasMore: startIndex + safePageSize < all.length,
    games: pageGames,
  };
}
