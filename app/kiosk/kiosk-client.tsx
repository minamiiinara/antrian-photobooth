"use client";

import { useEffect, useState } from "react";
import { supaClient } from "@/lib/supabase-browser";

type BoothRow = {
  id: string;
  name: string;
  service: "A" | "B" | "C";
};

export default function KioskClient({ storeId }: { storeId: string }) {
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [booths, setBooths] = useState<BoothRow[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setErr("");
      const { data, error } = await supaClient
        .from("booths")
        .select("id,name,service")
        .eq("store_id", storeId)
        .order("name", { ascending: true });

      if (error) setErr(error.message);
      else setBooths((data ?? []) as BoothRow[]);
      setLoading(false);
    })();
  }, [storeId]);

  async function ambil(service: "A" | "B" | "C") {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, service }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Gagal");

      const q = new URLSearchParams({
        ticket: j.ticket,
        waiting: String(j.waitingBefore),
        now: j.nowServing ?? "-",
        url: j.statusUrl,
        publicId: j.publicId,
      });
      window.location.href = "/print?" + q.toString();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="p-8">Memuat…</main>;
  if (err) return <main className="p-8 text-rose-600">Error: {err}</main>;
  if (booths.length === 0)
    return (
      <main className="p-8 text-slate-600">
        Tidak ada booth untuk cabang ini.
      </main>
    );

  return (
    <section className="grid place-items-center min-h-[70dvh]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
        {booths.map((b) => (
          <button
            key={b.id}
            disabled={busy}
            onClick={() => ambil(b.service)}
            className="h-36 rounded-2xl bg-white shadow hover:shadow-md active:scale-[.99] px-4 text-left"
          >
            <div className="text-xs text-slate-500">Booth</div>
            <div className="text-2xl font-semibold tracking-tight">
              {b.name}
            </div>
            <div className="mt-2 inline-flex items-center gap-2 text-sm">
              <span className="rounded-full border border-slate-200 px-2 py-0.5">
                Service {b.service}
              </span>
              {busy && <span className="text-slate-500">memproses…</span>}
            </div>
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-slate-500">
        Store: <code>{storeId.slice(0, 8)}…</code>
      </p>
    </section>
  );
}
