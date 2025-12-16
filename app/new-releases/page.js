"use client";

import SiteHeader from "../components/SiteHeader";

export default function NewReleases() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="border-2 border-(--border) bg-(--surface)">
          <div className="flex items-center justify-between gap-4 border-b-2 border-(--border) px-4 py-3">
            <div>
              <h1 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
                NEW RELEASES
              </h1>
              <p className="mt-1 text-xs tracking-[0.35em] text-(--muted)">
                (placeholder — content coming soon)
              </p>
            </div>
          </div>

          <div className="px-4 py-6 text-sm text-(--muted)">{/* Empty for now — we will fill in data */}</div>
        </section>
      </div>
    </main>
  );
}
