// app/admin/adminClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Booth } from "@/types/queue";
import { todayYMD } from "@/lib/date";

type Row = Booth & {
  activeTicket: string;
  is_active: boolean;
  available: boolean;
};

// --- Komponen Modal ---
function CallModal({
  booth,
  isOpen,
  onClose,
  onServeNext,
  onFinish,
  onCancel,
  onCallAgain,
}: {
  booth: Row | null;
  isOpen: boolean;
  onClose: () => void;
  onServeNext: (boothId: string) => void;
  onFinish: (boothId: string, ticket: string) => void;
  onCancel: (boothId: string) => void;
  onCallAgain: (ticket: string) => void;
}) {
  if (!isOpen || !booth) return null;

  const isServing = booth.activeTicket !== "-";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-800">Call Queue</h3>
          <p className="text-sm text-slate-500">Counter: {booth.name}</p>
          <div className="my-4 bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-400">Queue Number</div>
            <div className="text-3xl font-bold tracking-wider text-slate-800">
              {booth.activeTicket}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <button
            onClick={() => onServeNext(booth.id)}
            disabled={isServing}
            className="w-full rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            Serve Next
          </button>
           <button
            onClick={() => onCallAgain(booth.activeTicket)}
            disabled={!isServing}
            className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            Call Again
          </button>
          <button
            onClick={() => onCancel(booth.id)}
            disabled={!isServing}
            className="w-full rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
           <button
            onClick={() => onFinish(booth.id, booth.activeTicket)}
            disabled={!isServing}
            className="w-full rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2.5 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            Finish
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full mt-6 text-sm text-slate-500 hover:text-slate-700"
        >
          Close
        </button>
      </div>
      <style jsx>{`
        @keyframes fade-in-scale {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-fade-in-scale {
          animation: fade-in-scale 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}


export default function AdminClient({
  displayName,
  storeId,
  storeName,
}: {
  displayName: string;
  storeId: string;
  storeName: string;
}) {
  const supaClient = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBooth, setSelectedBooth] = useState<Row | null>(null);

  async function refresh(): Promise<void> {
    const ymd = todayYMD();

    const { data: boothsData, error: e1 } = await supaClient
      .from("booths")
      .select("id,store_id,name,service")
      .eq("store_id", storeId)
      .order("name", { ascending: true });

    if (e1 || !boothsData) return;

    const boothIds = boothsData.map((b) => b.id);

    const { data: statusData } = await supaClient
      .from("booth_status")
      .select("booth_id,is_active,available")
      .eq("ymd", ymd)
      .in("booth_id", boothIds);

    const statusMap = new Map<
      string,
      { is_active: boolean; available: boolean }
    >();
    (statusData ?? []).forEach((s) =>
      statusMap.set(String(s.booth_id), {
        is_active: Boolean(s.is_active),
        available: Boolean(s.available),
      })
    );

    const { data: servingData } = await supaClient
      .from("tickets")
      .select("booth_id,ticket")
      .eq("ymd", ymd)
      .eq("status", "serving")
      .in("booth_id", boothIds);

    const activeMap = new Map<string, string>();
    (servingData ?? []).forEach((t) =>
      activeMap.set(String(t.booth_id), String(t.ticket))
    );

    const merged: Row[] = boothsData.map((b) => {
      const st = statusMap.get(b.id);
      return {
        ...b,
        activeTicket: activeMap.get(b.id) ?? "-",
        is_active: st?.is_active ?? true,
        available: st?.available ?? true,
      };
    });

    setRows(merged);
  }
  
  useEffect(() => {
    refresh().finally(() => setLoading(false));

    const channel = supaClient
      .channel('realtime-admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public' }, 
        (payload) => {
          console.log('Perubahan terdeteksi:', payload);
          refresh();
        }
      )
      .subscribe();
    
    return () => {
      supaClient.removeChannel(channel);
    };
  }, [storeId]);


  async function setActive(boothId: string, next: boolean): Promise<void> {
    const ymd = todayYMD();
    setRows((prev) =>
      prev.map((r) => (r.id === boothId ? { ...r, is_active: next } : r))
    );
    const { error } = await supaClient
      .from("booth_status")
      .upsert(
        { booth_id: boothId, ymd, is_active: next },
        { onConflict: "booth_id,ymd" }
      );
    if (error) {
      setRows((prev) =>
        prev.map((r) => (r.id === boothId ? { ...r, is_active: !next } : r))
      );
      alert("Gagal update 'Is active'");
    }
  }

  async function setAvailable(boothId: string, next: boolean): Promise<void> {
    const ymd = todayYMD();
    setRows((prev) =>
      prev.map((r) => (r.id === boothId ? { ...r, available: next } : r))
    );
    const { error } = await supaClient
      .from("booth_status")
      .upsert(
        { booth_id: boothId, ymd, available: next },
        { onConflict: "booth_id,ymd" }
      );
    if (error) {
      setRows((prev) =>
        prev.map((r) => (r.id === boothId ? { ...r, available: !next } : r))
      );
      alert("Gagal update 'Available'");
    }
  }

  async function callNext(boothId: string): Promise<void> {
    const r = await fetch(`/api/booths/${boothId}/call-next`, {
      method: "POST",
    });
    const j: { ok: boolean; message?: string } = await r.json();
    if (!j.ok) alert(j.message ?? "Call gagal");
    await refresh();
  }

  async function cancelServing(boothId: string): Promise<void> {
    const r = await fetch(`/api/booths/${boothId}/cancel`, { method: "POST" });
    const j: { ok: boolean; message?: string } = await r.json();
    if (!j.ok) alert(j.message ?? "Cancel gagal");
    await refresh();
  }
  
  async function finishServing(boothId: string, ticket: string): Promise<void> {
    if (ticket === "-") return;
    const r = await fetch(`/api/booths/${boothId}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket, storeId }),
    });
    const j: { ok: boolean; error?: string } = await r.json();
    if (!j.ok) alert(j.error ?? "Finish gagal");
    await refresh();
  }

  const handleOpenModal = (booth: Row) => {
    setSelectedBooth(booth);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedBooth(null);
  };
  
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.service.toLowerCase().includes(term)
    );
  }, [rows, q]);

  useEffect(() => setPage(1), [q, perPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  if (loading) return <main className="p-8">Memuat…</main>;

  return (
    <>
      <CallModal
        isOpen={isModalOpen}
        booth={selectedBooth}
        onClose={handleCloseModal}
        onServeNext={async (boothId) => {
          await callNext(boothId);
          handleCloseModal();
        }}
        onFinish={async (boothId, ticket) => {
          await finishServing(boothId, ticket);
          handleCloseModal();
        }}
        onCancel={async (boothId) => {
          if (confirm("Yakin ingin membatalkan antrean yang sedang dilayani?")) {
            await cancelServing(boothId);
            handleCloseModal();
          }
        }}
        onCallAgain={(ticket) => {
          alert(`Memanggil kembali nomor ${ticket}! (Fitur suara belum ada)`);
          // Di sini Anda bisa menambahkan logika untuk memutar suara
        }}
      />
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Counters</h1>
              <p className="text-sm text-slate-500">
                Login sebagai <b>{displayName}</b> di <b>{storeName}</b>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari counter / layanan…"
                className="h-9 w-56 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / halaman
                  </option>
                ))}
              </select>
              <button
                onClick={() => refresh()}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_12px_30px_-15px_rgba(0,0,0,.2)]">
          <table className="min-w-full text-sm">
              <thead className="border-b bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Service</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Active queue
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Is active</th>
                  <th className="px-4 py-3 text-left font-semibold">Available</th>
                  <th className="px-4 py-3 text-right font-semibold w-1">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3">{r.service}</td>
                    <td className="px-4 py-3 font-semibold tracking-wider">
                      {r.activeTicket}
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={r.is_active}
                          onChange={(e) => setActive(r.id, e.target.checked)}
                          className="peer sr-only"
                        />
                        <span className="h-5 w-10 rounded-full bg-slate-300 peer-checked:bg-amber-500 relative after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white peer-checked:after:translate-x-5 transition-all" />
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={r.available}
                          onChange={(e) => setAvailable(r.id, e.target.checked)}
                          className="peer sr-only"
                        />
                        <span className="h-5 w-10 rounded-full bg-slate-300 peer-checked:bg-emerald-500 relative after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white peer-checked:after:translate-x-5 transition-all" />
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(r)}
                          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 font-semibold"
                        >
                          Call
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-slate-500"
                      colSpan={6}
                    >
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm">
        <div>
          Halaman <b>{page}</b> dari <b>{totalPages}</b> — <b>{filtered.length}</b>{" "}
          items
        </div>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
      </section>
    </>
  );
}