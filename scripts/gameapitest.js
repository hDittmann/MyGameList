/**
 * IGDB API quick test for pulling game title data
 *
 * Notes:
 * - IGDB auth uses Twitch client credentials lol
 * - Rate limits: 4 requests per second, 8 active loading
 */

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_GAMES_URL = "https://api.igdb.com/v4/games";

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;

async function getAccessToken() {
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

async function queryGames(accessToken) {
  const body = [
    "fields name, summary, rating, first_release_date;",
    'search "peak";',
    "where rating != null;",
    "sort rating desc;",
    "limit 5;",
  ].join("\n");

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

async function main() {
  console.log("Requesting Twitch/IGDB access token...");
  const token = await getAccessToken();
  console.log("Token acquired. Querying IGDB...");

  const games = await queryGames(token);
  console.log(`Received ${games.length} game(s).`);

  for (const game of games) {
    console.log(`- ${game.name} (rating: ${game.rating ?? "—"})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
