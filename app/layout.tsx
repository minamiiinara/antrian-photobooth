import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/header";

export const metadata: Metadata = {
  title: "Photoism",
  description: "Antrian multi-cabang",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-dvh bg-[radial-gradient(1100px_700px_at_10%_-20%,#eef2ff_10%,transparent_60%),radial-gradient(1000px_600px_at_120%_10%,#f1f5f9_20%,transparent_70%)] text-slate-800">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500">
          © {new Date().getFullYear()} — Photoism
        </footer>
      </body>
    </html>
  );
}
