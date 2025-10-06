"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function Header() {
  const pathname = usePathname();
  const supaClient = createClient();
  // Hooks selalu di top-level
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false); // <- guard untuk hydration

  useEffect(() => {
    setReady(true); // render pertama = markup statis
    supaClient.auth
      .getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supaClient.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // sembunyikan header di /t/* dan /print
  if (pathname?.startsWith("/t/") || pathname?.startsWith("/print"))
    return null;

  async function signOut() {
    await supaClient.auth.signOut();
    setEmail(null);
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-10 backdrop-blur bg-white/60 border-b border-slate-200/60">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          Photoism
        </Link>

        <nav className="text-sm">
          {/* Render statis saat !ready: kosong (server & client sama persis) */}
          {!ready ? null : email ? (
            <>
              {/* HANYA muncul saat login */}
              <Link
                href="/kiosk"
                className="px-3 py-1.5 hover:bg-slate-100 rounded-lg"
              >
                Kiosk
              </Link>
              <Link
                href="/admin"
                className="px-3 py-1.5 hover:bg-slate-100 rounded-lg"
              >
                Admin
              </Link>
              <button
                onClick={signOut}
                className="px-3 py-1.5 hover:bg-slate-100 rounded-lg"
              >
                Keluar
              </button>
            </>
          ) : (
            // Saat belum login: cuma Login
            <Link
              href="/login"
              className="px-3 py-1.5 hover:bg-slate-100 rounded-lg"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
