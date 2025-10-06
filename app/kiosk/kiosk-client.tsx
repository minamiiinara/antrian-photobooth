"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type BoothRow = {
  id: string;
  name: string;
  service: "A" | "B" | "C";
};

export default function KioskClient({
  storeId,
  storeName,
}: {
  storeId: string;
  storeName: string;
}) {
  const supaClient = createClient();

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [booths, setBooths] = useState<BoothRow[]>([]);
  const [err, setErr] = useState("");

  async function fetchAvailableBooths() {
    setErr("");
    const ymd = new Date().toISOString().split("T")[0];

    // Ambil booth_id yang statusnya available=true dan is_active=true untuk hari ini
    const { data: boothStatusData, error: statusError } = await supaClient
      .from("booth_status")
      .select("booth_id")
      .eq("available", true)
      .eq("is_active", true)
      .eq("ymd", ymd);

    if (statusError) {
      setErr(statusError.message);
      setLoading(false);
      return;
    }

    const availableBoothIds = boothStatusData.map((s) => s.booth_id);

    if (availableBoothIds.length === 0) {
      setBooths([]);
      setLoading(false);
      return;
    }

    // Ambil detail booth berdasarkan ID yang tersedia
    const { data, error } = await supaClient
      .from("booths")
      .select("id,name,service")
      .eq("store_id", storeId)
      .in("id", availableBoothIds)
      .order("name", { ascending: true });

    if (error) setErr(error.message);
    else setBooths((data ?? []) as BoothRow[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchAvailableBooths();

    // Dapatkan pembaruan real-time jika ada staf lain yang mengubah status booth
    const channel = supaClient
      .channel("realtime-kiosk-booths")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booth_status" },
        () => fetchAvailableBooths()
      )
      .subscribe();

    return () => {
      supaClient.removeChannel(channel);
    };
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
      if (!j.ok) throw new Error(j.error || "Gagal mengambil tiket");

      const q = new URLSearchParams({
        ticket: j.ticket,
        waiting: String(j.waitingBefore),
        now: j.nowServing ?? "-",
        url: j.statusUrl,
        publicId: j.publicId,
      });
      // Buka di tab baru agar tidak meninggalkan halaman kiosk
      window.open("/print?" + q.toString(), "_blank");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80dvh] text-slate-500">
        <p>Memuat Kiosk...</p>
      </div>
    );
  }

  return (
    <section className="flex flex-col items-center justify-center min-h-[80dvh] px-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            Kiosk Tiket
          </h1>
          <p className="mt-1 text-md text-slate-600">
            Cabang: <span className="font-semibold">{storeName}</span>
          </p>
        </div>

        {err && (
          <div className="p-4 mb-4 text-center text-red-700 bg-red-100 rounded-lg">
            Error: {err}
          </div>
        )}

        {booths.length === 0 && !err && (
          <div className="p-8 text-center bg-slate-50 rounded-2xl">
            <p className="text-slate-600 font-medium">
              Tidak ada layanan yang tersedia.
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Pastikan *toggle* &quot;Is Active&quot; dan &quot;Available&quot;
              di halaman Admin sudah dinyalakan.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {booths.map((b) => (
            <button
              key={b.id}
              disabled={busy}
              onClick={() => ambil(b.service)}
              className="group flex flex-col justify-between p-6 rounded-2xl bg-white text-left shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 active:scale-[.98] disabled:opacity-50 disabled:cursor-wait"
            >
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                  {b.name}
                </h2>
                <span className="mt-2 inline-block px-3 py-1 text-xs font-semibold tracking-wider text-indigo-800 bg-indigo-100 rounded-full">
                  Layanan {b.service}
                </span>
              </div>
              <div className="mt-6 text-indigo-600 font-semibold">
                {busy ? "Memproses..." : "Ambil Tiket"}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
