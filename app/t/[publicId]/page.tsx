"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type Data = {
  ticket: string;
  waitingBefore: number;
  nowServing: string | null;
  estimatedWaitTime: number;
};

export default function TicketStatus({
  params,
}: {
  params: { publicId: string };
}) {
  const [data, setData] = useState<Data | null>(null);
  const supaClient = createClient();

  const load = async () => {
    const r = await fetch(`/api/tickets/${params.publicId}`);
    if (r.ok) setData(await r.json());
  };

  useEffect(() => {
    load();
    const channel = supaClient
      .channel(`ticket-status-${params.publicId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => load()
      )
      .subscribe();
    return () => {
      supaClient.removeChannel(channel);
    };
  }, [params.publicId]);

  if (!data) return <main className="p-6">Memuat…</main>;

  return (
    <section className="grid place-items-center min-h-[70dvh]">
      <div className="bg-white rounded-2xl shadow p-6 text-center max-w-sm w-full">
        <div className="text-sm text-slate-500">Nomor Anda</div>
        <div className="text-5xl font-extrabold tracking-tight my-2">
          {data.ticket}
        </div>

        <div className="mt-4 space-y-2">
          <div className="text-lg">
            Antrean di depan: <b>{data.waitingBefore}</b>
          </div>
          <div className="text-lg font-semibold text-indigo-600">
            Perkiraan waktu tunggu: <b>{data.estimatedWaitTime} menit</b>
          </div>
          <div className="text-lg pt-2">
            Sedang dilayani: <b>{data.nowServing ?? "-"}</b>
          </div>
        </div>

        <div className="mt-4 border-t pt-4">
          <p className="text-sm text-slate-600">
            Mohon standby di toko 10 menit sebelum waktu estimasi Anda.
          </p>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          Halaman ini update otomatis secara real-time.
        </p>
      </div>
    </section>
  );
}
