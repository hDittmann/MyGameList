import { redirect } from "next/navigation";

export default function Page() {
  // Send the site root to the My Collection page
  redirect("/my-collection");
}