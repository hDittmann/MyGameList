"use client";

import SiteHeader from "../components/SiteHeader";
import CollectionHome from "../components/CollectionHome";

export default function MyCollection() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <CollectionHome />
    </main>
  );
}
