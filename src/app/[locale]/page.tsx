import { redirect } from "next/navigation";

// La home esiste solo in italiano: /en porta alla home.
export default function LocaleRootPage() {
  redirect("/");
}
