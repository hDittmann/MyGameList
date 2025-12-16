/**
 * IGDB API test runner (Node 18+)
 *
 * This file intentionally contains TWO clearly separated tests:
 *
 * TEST 1: "search"  — Pull X games for a search term, include cover URLs, and (optionally) download cover JPGs.
 * TEST 2: "top"     — Pull top rated games (prefers total_rating with count thresholds), include cover URLs, and (optionally) download cover JPGs.
 * TEST 3: "top-simple" — Pull top games using ONLY total_rating + total_rating_count (no Bayesian/global-average weighting).
 *
 * Output:
 * - JSON results are written under: scripts/output/igdb/<test>/
 * - Covers (if downloaded) are written under: scripts/output/igdb/<test>/covers/
 *
 * Auth / environment:
 * - Requires TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET (Twitch client credentials)
 * - This script auto-loads `.env.local` (Next.js loads it for the app, but plain `node` does not)
 *
 * How to run:
 *   node scripts/gameapitest.js --help
 *
 *   # TEST 1: Search for a term, pull X games, and download covers
 *   node scripts/gameapitest.js search --query "query" --limit 10 --download-covers
 *
 *   # TEST 2: Top 10 rated games (default limit is 10)
 *   node scripts/gameapitest.js top --download-covers
 *
 * Notes:
 * - IGDB does NOT allow combining `search` with `sort`. That’s why the tests are separate.
 */

const fs = require("node:fs/promises");
const path = require("node:path");

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_GAMES_URL = "https://api.igdb.com/v4/games";

// Next.js loads `.env.local` for the app, but plain `node` scripts do not.
// Load it here so `process.env.TWITCH_CLIENT_ID/SECRET` work when running this file directly.
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
} catch {
  // If dotenv isn't installed, fall back to relying on the shell environment.
}

const clientId = process.env.TWITCH_CLIENT_ID?.trim();
const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim();

function ensureAuthConfigured() {
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET. Add them to .env.local or set them in your shell before running this script."
    );
  }
}

function printHelp() {
  console.log(`\nIGDB API test runner\n\nUsage:\n  node scripts/gameapitest.js <test> [options]\n\nTests:\n  id          Pull a single game by IGDB id\n  search      Pull X games for a search term (no sorting)\n  top         Pull top games using weighted(total_rating,total_rating_count) (approx IGDB Top 100)\n  top-simple  Pull top games using ONLY total_rating + total_rating_count\n\nCommon options:\n  --limit <n>             Number of games to fetch (default: 10)\n  --download-covers       Download cover JPGs (default: off)\n  --cover-size <size>     IGDB image size (default: t_cover_big)\n  --min-votes <n>         Minimum vote count (top-simple only; default: 2000)\n\nID options:\n  --id <n>                IGDB numeric id (required for the id test)\n\nSearch options:\n  --query <text>          Search string (required for the search test)\n\nExamples:\n  node scripts/gameapitest.js id --id 253344 --download-covers\n  node scripts/gameapitest.js search --query "peak" --limit 10 --download-covers\n  node scripts/gameapitest.js top --download-covers\n  node scripts/gameapitest.js top-simple --limit 25 --min-votes 2000\n`);
}

function getArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasArg(args, name) {
  return args.includes(name);
}

function parseCommonOptions(args) {
  const limitRaw = getArgValue(args, "--limit");
  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : 10;
  const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? limitParsed : 10;

  const downloadCovers = hasArg(args, "--download-covers");
  const coverSize = getArgValue(args, "--cover-size") ?? "t_cover_big";

  const minVotesRaw = getArgValue(args, "--min-votes");
  const minVotesParsed = minVotesRaw ? Number.parseInt(minVotesRaw, 10) : undefined;
  const minVotes = Number.isFinite(minVotesParsed) && minVotesParsed >= 0 ? minVotesParsed : undefined;

  return { limit, downloadCovers, coverSize, minVotes };
}

// IGDB `games.category` enum (subset we care about):
// 0 main_game, 8 remake, 9 remaster, 10 expanded_game, 11 port, 12 fork
// We exclude categories like bundle/pack/DLC/expansion/etc.
const IGDB_ALLOWED_GAME_CATEGORIES = new Set([0, 8, 9, 10, 11, 12]);

function isMainGameRecord(game) {
  // Filter out “extras” like deluxe editions, bundles, DLC, etc.
  // - category in allowed set: main-like releases (main/remaster/port/etc.)
  //   NOTE: `category` is documented but marked deprecated; some datasets may omit it.
  //   When missing, we treat it as "unknown" rather than excluding everything.
  // - version_parent = null: not an alternate version/edition of another game
  // - parent_game = null: not DLC/expansion tied to a parent game
  const category = game?.category;
  const categoryOk = category == null || IGDB_ALLOWED_GAME_CATEGORIES.has(category);
  return (
    categoryOk &&
    (game?.version_parent == null) &&
    (game?.parent_game == null)
  );
}

function filterToMainGames(games) {
  return games.filter(isMainGameRecord);
}

function getDisplayRating(game) {
  // Prefer total_rating (best coverage), then aggregated_rating, then rating.
  return game?.total_rating ?? game?.aggregated_rating ?? game?.rating ?? null;
}

function computeWeightedRating({ averageRating, voteCount, globalAverage, minVotes }) {
  // IGDB Top 100 page mentions a "weighted rating" that considers both average rating and votes.
  // This is a common Bayesian-weighted approach:
  //   score = (v/(v+m))*R + (m/(v+m))*C
  // where R=averageRating, v=voteCount, C=globalAverage, m=minVotes.
  const R = Number(averageRating);
  const v = Number(voteCount);
  const C = Number(globalAverage);
  const m = Number(minVotes);

  if (!Number.isFinite(R) || !Number.isFinite(v) || v <= 0) return null;
  if (!Number.isFinite(C)) return null;
  if (!Number.isFinite(m) || m < 0) return null;

  return (v / (v + m)) * R + (m / (v + m)) * C;
}

function mean(numbers) {
  let sum = 0;
  let count = 0;
  for (const n of numbers) {
    const x = Number(n);
    if (Number.isFinite(x)) {
      sum += x;
      count += 1;
    }
  }
  return count === 0 ? null : sum / count;
}

async function getAccessToken() {
  ensureAuthConfigured();

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

  return data.access_token;
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
  // IGDB image docs: https://api-docs.igdb.com/#images
  // Common sizes: t_cover_small, t_cover_big, t_cover_2x, t_720p, t_1080p
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
}

function normalizeGames(games, { coverSize }) {
  return games.map((g) => {
    const imageId = g?.cover?.image_id;
    return {
      ...g,
      coverImageId: imageId ?? null,
      coverUrl: imageId ? getIgdbImageUrl(imageId, coverSize) : null,
    };
  });
}

async function downloadCoverImages(games, { outputDir, coverSize }) {
  const coversDir = path.join(outputDir, "covers");
  await fs.mkdir(coversDir, { recursive: true });

  const results = [];
  for (const game of games) {
    const imageId = game?.coverImageId;
    if (!imageId) {
      results.push({ gameId: game?.id, ok: false, reason: "missing_cover" });
      continue;
    }

    const url = getIgdbImageUrl(imageId, coverSize);
    const filePath = path.join(coversDir, `${game.id}-${imageId}.jpg`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        results.push({ gameId: game.id, imageId, url, ok: false, reason: `http_${response.status}` });
        continue;
      }

      const buf = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(filePath, buf);
      results.push({ gameId: game.id, imageId, url, ok: true, filePath });
    } catch (error) {
      results.push({ gameId: game.id, imageId, url, ok: false, reason: String(error?.message ?? error) });
    }
  }

  return { coversDir, results };
}

async function writeTestOutput({ testName, query, games, downloadResult }) {
  const baseOutputDir = path.join(__dirname, "output", "igdb", testName);
  await fs.mkdir(baseOutputDir, { recursive: true });

  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const outputFile = path.join(baseOutputDir, `result-${timestamp}.json`);
  const latestFile = path.join(baseOutputDir, "latest.json");

  const payload = {
    fetchedAt: new Date().toISOString(),
    test: testName,
    query,
    count: games.length,
    games,
    coverDownloads: downloadResult ?? null,
  };

  await fs.writeFile(outputFile, JSON.stringify(payload, null, 2), "utf8");
  await fs.writeFile(latestFile, JSON.stringify(payload, null, 2), "utf8");

  return { baseOutputDir, outputFile, latestFile };
}

/**
 * TEST 1: Search test
 * - Uses IGDB `search` to pull X games for a given term.
 * - Does NOT sort (IGDB disallows combining search+sort).
 */
async function runSearchTest(accessToken, args) {
  const common = parseCommonOptions(args);
  const queryText = getArgValue(args, "--query");
  if (!queryText || String(queryText).trim().length === 0) {
    throw new Error("Search test requires --query <text>");
  }

  // We intentionally fetch more than requested, then filter client-side to keep only main games.
  // This avoids edge-cases where certain IGDB fields don't behave as expected in `where` filters.
  const candidateLimit = Math.max(common.limit * 5, common.limit);

  const escaped = String(queryText).replaceAll('"', "\\\"");
  const queryLines = [
    "fields id, name, summary, rating, rating_count, aggregated_rating, aggregated_rating_count, total_rating, total_rating_count, first_release_date, category, version_parent, parent_game, cover.image_id;",
    `search \"${escaped}\";`,
    // Exclude versions/editions via `version_parent = null` (documented example in IGDB docs).
    // We intentionally avoid filtering on rating fields here because it can unexpectedly remove
    // valid search matches; we can still display ratings when present.
    "where version_parent = null & parent_game = null;",
    `limit ${candidateLimit};`,
  ];

  console.log(`Running TEST 1 (search): query=\"${queryText}\" limit=${common.limit}`);
  const rawGames = await igdbQuery(accessToken, queryLines);
  const games = normalizeGames(rawGames, { coverSize: common.coverSize });
  const mainGames = filterToMainGames(games).slice(0, common.limit);

  let downloadResult;
  if (common.downloadCovers) {
    console.log("Downloading cover images...");
    downloadResult = await downloadCoverImages(mainGames, {
      outputDir: path.join(__dirname, "output", "igdb", "search"),
      coverSize: common.coverSize,
    });
    const okCount = downloadResult.results.filter((r) => r.ok).length;
    console.log(`Downloaded ${okCount}/${mainGames.length} cover(s).`);
  }

  const out = await writeTestOutput({
    testName: "search",
    query: { type: "search", queryText, ...common, candidateLimit },
    games: mainGames,
    downloadResult,
  });

  console.log(`Wrote JSON: ${out.outputFile}`);
  return mainGames;
}

/**
 * TEST 0: ID lookup
 * - Fetch a single record by IGDB `id`.
 */
async function runIdTest(accessToken, args) {
  const common = parseCommonOptions(args);
  const idRaw = getArgValue(args, "--id");
  const id = idRaw ? Number.parseInt(idRaw, 10) : NaN;
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("ID test requires --id <positive_number>");
  }

  const fieldsLine =
    "fields id, name, summary, rating, rating_count, aggregated_rating, aggregated_rating_count, total_rating, total_rating_count, first_release_date, category, version_parent, parent_game, cover.image_id;";

  const queryLines = [fieldsLine, `where id = ${id};`, "limit 1;"];

  console.log(`Running TEST 0 (id): id=${id}`);
  const rawGames = await igdbQuery(accessToken, queryLines);
  const games = normalizeGames(rawGames ?? [], { coverSize: common.coverSize });

  let downloadResult;
  if (common.downloadCovers && games.length > 0) {
    console.log("Downloading cover images...");
    downloadResult = await downloadCoverImages(games, {
      outputDir: path.join(__dirname, "output", "igdb", "by-id"),
      coverSize: common.coverSize,
    });
    const okCount = downloadResult.results.filter((r) => r.ok).length;
    console.log(`Downloaded ${okCount}/${games.length} cover(s).`);
  }

  const out = await writeTestOutput({
    testName: "by-id",
    query: { type: "id", id, ...common },
    games,
    downloadResult,
  });

  console.log(`Wrote JSON: ${out.outputFile}`);
  return games;
}

/**
 * TEST 2: Top-rated test
 * - Prefers total_rating (critic+user) with count thresholds to reduce "99 from 1 vote" skew.
 */
async function runTopRatedTest(accessToken, args) {
  const common = parseCommonOptions(args);
  const limit = common.limit ?? 10;

  // To approximate IGDB's Top 100 list, we need a much larger pool than just `limit * 5`.
  // Otherwise the Bayesian/weighted score has too little context and low-vote outliers can slip in.
  const candidatePoolLimit = Math.max(500, limit * 50);
  const baselineSampleLimit = 500;

  const fieldsLine =
    "fields id, name, summary, rating, rating_count, aggregated_rating, aggregated_rating_count, total_rating, total_rating_count, first_release_date, category, version_parent, parent_game, cover.image_id;";

  // Exclude editions/versions and add-ons per IGDB docs (Top 100 is intended to be games, not editions/DLC).
  const baseWhere = "version_parent = null & parent_game = null";

  // To approximate IGDB's Top 100 list, we need a broader pool than just "top by raw rating".
  // We'll pull candidates from two angles:
  // - High `total_rating`
  // - High `total_rating_count`
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

  // Baseline query: a vote-heavy slice to estimate a more realistic global average.
  // This helps the weighted score behave more like IGDB's Top 100 page.
  const baselineQuery = [
    fieldsLine,
    `where total_rating > 0 & total_rating_count > 0 & ${baseWhere};`,
    "sort total_rating_count desc;",
    `limit ${baselineSampleLimit};`,
  ];

  console.log(`Running TEST 2 (top-rated): limit=${limit}`);
  const [rawByRating, rawByVotes, rawBaseline] = await Promise.all([
    igdbQuery(accessToken, ratingCandidatesQuery),
    igdbQuery(accessToken, voteCandidatesQuery),
    igdbQuery(accessToken, baselineQuery),
  ]);

  const mergedMap = new Map();
  for (const g of [...(rawByRating ?? []), ...(rawByVotes ?? [])]) {
    if (g && typeof g.id === "number") mergedMap.set(g.id, g);
  }

  const merged = normalizeGames(Array.from(mergedMap.values()), { coverSize: common.coverSize });
  const mainCandidates = filterToMainGames(merged);

  const baselineNormalized = normalizeGames(rawBaseline ?? [], { coverSize: common.coverSize });
  const baselineMain = filterToMainGames(baselineNormalized);

  // Compute a global average from a vote-heavy baseline sample to reduce bias.
  const globalAverage = mean(baselineMain.map((g) => g.total_rating)) ?? mean(mainCandidates.map((g) => g.total_rating));
  const minVotes = 2000;

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

  const mainGames = ranked.slice(0, limit).map((x) => ({
    ...x.game,
    weighted_rating: x.score,
    weighted_rating_meta: { globalAverage, minVotes },
  }));

  const attemptUsed = "weighted(total_rating,total_rating_count)";
  console.log(`Top-rated selection strategy: ${attemptUsed} (minVotes=${minVotes}, globalAvg=${globalAverage?.toFixed?.(2) ?? "—"})`);

  let downloadResult;
  if (common.downloadCovers) {
    console.log("Downloading cover images...");
    downloadResult = await downloadCoverImages(mainGames, {
      outputDir: path.join(__dirname, "output", "igdb", "top"),
      coverSize: common.coverSize,
    });
    const okCount = downloadResult.results.filter((r) => r.ok).length;
    console.log(`Downloaded ${okCount}/${mainGames.length} cover(s).`);
  }

  const out = await writeTestOutput({
    testName: "top",
    query: { type: "top-rated", ...common, limit, attemptUsed, candidatePoolLimit, baselineSampleLimit, minVotes, globalAverage },
    games: mainGames,
    downloadResult,
  });

  console.log(`Wrote JSON: ${out.outputFile}`);
  return mainGames;
}

/**
 * TEST 3: Top-simple test
 * - Ranks games using ONLY total_rating and total_rating_count.
 * - No Bayesian/global-average weighting: score is derived directly from (rating, count).
 * - Still excludes editions/versions via version_parent = null and add-ons via parent_game = null.
 */
async function runTopSimpleTest(accessToken, args) {
  const common = parseCommonOptions(args);
  const limit = common.limit ?? 10;
  const minVotes = common.minVotes ?? 2000;

  const fieldsLine =
    "fields id, name, summary, total_rating, total_rating_count, first_release_date, category, version_parent, parent_game, cover.image_id;";
  const baseWhere = "version_parent = null & parent_game = null";

  // IGDB typically caps a single query to ~500 rows. To reduce "missing" candidates, page through
  // multiple offsets and build a larger pool.
  const candidatePoolTarget = Math.max(1500, limit * 150);
  const pageSize = 500;

  async function fetchPaged({ whereLine, sortLine, label }) {
    const all = [];
    for (let offset = 0; offset < candidatePoolTarget; offset += pageSize) {
      const pageLimit = Math.min(pageSize, candidatePoolTarget - offset);
      const queryLines = [
        fieldsLine,
        whereLine,
        sortLine,
        `limit ${pageLimit};`,
        `offset ${offset};`,
      ];
      const page = await igdbQuery(accessToken, queryLines);
      all.push(...(page ?? []));
      if (!page || page.length < pageLimit) break;
    }
    console.log(`Fetched ${all.length} candidate(s) for ${label}.`);
    return all;
  }

  console.log(`Running TEST 3 (top-simple): limit=${limit}, minVotes=${minVotes}`);
  const [rawByRating, rawByVotes] = await Promise.all([
    fetchPaged({
      label: "by total_rating",
      whereLine: `where total_rating > 0 & total_rating_count > 0 & ${baseWhere};`,
      sortLine: "sort total_rating desc;",
    }),
    fetchPaged({
      label: "by total_rating_count",
      whereLine: `where total_rating > 0 & total_rating_count > 0 & ${baseWhere};`,
      sortLine: "sort total_rating_count desc;",
    }),
  ]);

  const mergedMap = new Map();
  for (const g of [...(rawByRating ?? []), ...(rawByVotes ?? [])]) {
    if (g && typeof g.id === "number") mergedMap.set(g.id, g);
  }

  const merged = normalizeGames(Array.from(mergedMap.values()), { coverSize: common.coverSize });
  const candidates = filterToMainGames(merged);

  // Order strictly by rating (highest -> lowest), but use vote count as a stable tie-breaker.
  // Candidate discovery is still done via both lists (by rating + by vote count).
  const baseRanked = candidates
    .filter((g) => Number.isFinite(Number(g?.total_rating)))
    .sort((a, b) => {
      const ar = Number(a.total_rating);
      const br = Number(b.total_rating);
      if (br !== ar) return br - ar;

      const av = Number(a.total_rating_count ?? 0);
      const bv = Number(b.total_rating_count ?? 0);
      return bv - av;
    });

  // Primary behavior: only include games with at least `minVotes` ratings.
  // Fallback: if that yields too few results, return the best available by rating.
  const voteFiltered = baseRanked.filter((g) => Number(g?.total_rating_count ?? 0) >= minVotes);
  const ranked = voteFiltered.length >= limit ? voteFiltered : baseRanked;
  const usedMinVotesFilter = ranked === voteFiltered;

  const mainGames = ranked.slice(0, limit).map((g) => ({
    ...g,
    top_simple_meta: {
      order: "total_rating desc, total_rating_count desc",
      candidateDiscovery: "paged(total_rating desc) + paged(total_rating_count desc)",
      minVotes,
      usedMinVotesFilter,
    },
  }));

  let downloadResult;
  if (common.downloadCovers) {
    console.log("Downloading cover images...");
    downloadResult = await downloadCoverImages(mainGames, {
      outputDir: path.join(__dirname, "output", "igdb", "top-simple"),
      coverSize: common.coverSize,
    });
    const okCount = downloadResult.results.filter((r) => r.ok).length;
    console.log(`Downloaded ${okCount}/${mainGames.length} cover(s).`);
  }

  const out = await writeTestOutput({
    testName: "top-simple",
    query: {
      type: "top-simple",
      ...common,
      limit,
      candidatePoolTarget,
      pageSize,
      order: "total_rating desc, total_rating_count desc",
      candidateDiscovery: "paged(total_rating desc) + paged(total_rating_count desc)",
      minVotes,
      usedMinVotesFilter,
    },
    games: mainGames,
    downloadResult,
  });

  console.log(`Wrote JSON: ${out.outputFile}`);
  return mainGames;
}

async function main() {
  const [, , command, ...args] = process.argv;

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  console.log("Requesting Twitch/IGDB access token...");
  const token = await getAccessToken();
  console.log("Token acquired.");

  let games;
  if (command === "id") {
    games = await runIdTest(token, args);
  } else if (command === "search") {
    games = await runSearchTest(token, args);
  } else if (command === "top") {
    games = await runTopRatedTest(token, args);
  } else if (command === "top-simple") {
    games = await runTopSimpleTest(token, args);
  } else {
    console.error(`Unknown test: ${command}`);
    printHelp();
    process.exit(2);
    return;
  }

  console.log(`Received ${games.length} game(s).`);
  for (const game of games) {
    const displayRating = getDisplayRating(game);
    const votes =
      game?.total_rating_count ?? game?.aggregated_rating_count ?? game?.rating_count ?? null;
    const parts = [`rating: ${displayRating ?? "—"}`];
    if (votes != null) parts.push(`votes: ${votes}`);
    if (Number.isFinite(Number(game?.weighted_rating))) parts.push(`weighted: ${Number(game.weighted_rating).toFixed(2)}`);
    if (Number.isFinite(Number(game?.simple_score))) parts.push(`score: ${Number(game.simple_score).toFixed(2)}`);
    console.log(`- ${game.name} (${parts.join(", ")})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
