import { redirect } from "next/navigation";

export default function Page() {
  // send the site root to the my collection page
  redirect("/my-collection");
}