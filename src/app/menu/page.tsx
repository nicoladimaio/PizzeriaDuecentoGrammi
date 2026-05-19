import { LiveMenu } from "@/components/live-menu";

export const metadata = {
  title: "Menu | Duecento Grammi",
};

export default function MenuPage() {
  return (
    <main className="page-main menu-only-main">
      <LiveMenu />
    </main>
  );
}
