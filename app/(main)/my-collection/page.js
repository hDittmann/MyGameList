"use client";

import SiteHeader from "../../components/SiteHeader";
import CollectionHome from "../../components/CollectionHome";

export default function MyCollection() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <CollectionHome />
      </main>
    </>
  );
}
