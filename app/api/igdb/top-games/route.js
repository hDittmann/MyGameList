import { NextResponse } from "next/server";
import { fetchIgdbGames } from "../../../lib/igdbServer";

export async function GET(request) {
  // keep request parsing here and the heavy lifting in igdbServer
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const page = searchParams.get("page") ?? "1";
  const pageSize = searchParams.get("pageSize") ?? "20";
  const minRating = searchParams.get("minRating") ?? "0";
  const tags = searchParams.get("tags") ?? "";
  const hideMature = searchParams.get("hideMature");

  try {
    const payload = await fetchIgdbGames({
      mode: "top-games",
      q,
      page: Number(page),
      pageSize: Number(pageSize),
      minRating: Number(minRating) || 0,
      tagFilters: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      // default to hiding mature content unless explicitly disabled
      hideMature: hideMature == null ? true : hideMature !== "0",
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch IGDB top games" },
      { status: 500 }
    );
  }
}
