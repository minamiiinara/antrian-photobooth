"use client";
import { useEffect, useState } from "react";

type Data = {
  store_id: string;
  ticket: string;
  waitingBefore: number;
  nowServing: string | null;
};

export default function TicketStatus({
  params,
}: {
  params: { publicId: string };
}) {
  const [data, setData] = useState<Data | null>(null);

  const load = async () => {
    const r = await fetch(`/api/tickets/${params.publicId}`);
    if (r.ok) setData(await r.json());
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 3000); // polling 3 detik
    return () => clearInterval(iv);
  }, [params.publicId]);

  if (!data) return <main className="p-6">Memuat…</main>;

  return (
    <section className="grid place-items-center min-h-[70dvh]">
      <div className="bg-white rounded-2xl shadow p-6 text-center max-w-sm w-full">
        <div className="text-sm text-slate-500">Nomor Anda</div>
        <div className="text-5xl font-extrabold tracking-tight my-2">
          {data.ticket}
        </div>
        <div className="text-lg">
          Sisa antrean: <b>{data.waitingBefore}</b>
        </div>
        <div className="text-lg">
          Sedang dilayani: <b>{data.nowServing ?? "-"}</b>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Halaman ini update otomatis.
        </p>
      </div>
    </section>
  );
}
