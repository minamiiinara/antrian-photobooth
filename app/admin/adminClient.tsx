"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Booth } from "@/types/queue";
import { todayYMD } from "@/lib/date";

// --- Fungsi Suara (Text-to-Speech) ---
function speak(text: string) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 0.9;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const indonesianVoice = voices.find((voice) => voice.lang === "id-ID");
      if (indonesianVoice) utterance.voice = indonesianVoice;
      window.speechSynthesis.speak(utterance);
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        const indonesianVoice = window.speechSynthesis
          .getVoices()
          .find((voice) => voice.lang === "id-ID");
        if (indonesianVoice) utterance.voice = indonesianVoice;
        window.speechSynthesis.speak(utterance);
      };
    }
  } else {
    console.error("Browser ini tidak mendukung Text-to-Speech.");
  }
}

// Tipe data untuk baris tabel
type Row = Booth & {
  activeTicket: string;
  is_active: boolean;
  available: boolean;
  waitingTickets: string[];
};

// --- Komponen Modal (Tidak ada perubahan) ---
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
  onCallAgain: (ticket: string, boothName: string) => void;
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
            <div className="text-xs text-slate-400">Now Serving</div>
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
            onClick={() => onCallAgain(booth.activeTicket, booth.name)}
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
  const [summaryData, setSummaryData] = useState<
    { service: string; count: number; color: string }[]
  >([]);

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

    const { data: waitingData } = await supaClient
      .from("tickets")
      .select("service, ticket")
      .eq("store_id", storeId)
      .eq("ymd", ymd)
      .eq("status", "waiting")
      .order("number", { ascending: true });
    const waitingMap = new Map<string, string[]>();
    boothsData.forEach((booth) => {
      if (!waitingMap.has(booth.service)) {
        waitingMap.set(booth.service, []);
      }
    });
    (waitingData ?? []).forEach((t) => {
      waitingMap.get(t.service)?.push(t.ticket);
    });

    const summary = Array.from(waitingMap.entries())
      .map(([service, tickets]) => ({
        service: `Antrean Layanan ${service}`,
        count: tickets.length,
        color:
          service === "A"
            ? "bg-blue-500"
            : service === "B"
            ? "bg-orange-500"
            : "bg-green-500",
      }))
      .sort((a, b) => a.service.localeCompare(b.service));
    setSummaryData(summary);

    const merged: Row[] = boothsData.map((b) => ({
      ...b,
      activeTicket: activeMap.get(b.id) ?? "-",
      is_active: statusMap.get(b.id)?.is_active ?? true,
      available: statusMap.get(b.id)?.available ?? true,
      waitingTickets: waitingMap.get(b.service) ?? [],
    }));
    setRows(merged);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const channel = supaClient
      .channel("realtime-admin-updates")
      .on("postgres_changes", { event: "*", schema: "public" }, () => refresh())
      .subscribe();
    return () => {
      supaClient.removeChannel(channel);
    };
  }, [storeId]);

  async function setActive(boothId: string, next: boolean): Promise<void> {
    const ymd = todayYMD();
    const originalRows = rows;
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
      setRows(originalRows);
      alert("Gagal update 'Is active'");
    }
  }

  async function setAvailable(boothId: string, next: boolean): Promise<void> {
    const ymd = todayYMD();
    const originalRows = rows;
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
      setRows(originalRows);
      alert("Gagal update 'Available'");
    }
  }

  async function callNext(boothId: string): Promise<void> {
    const r = await fetch(`/api/booths/${boothId}/call-next`, {
      method: "POST",
    });
    const j: {
      ok: boolean;
      message?: string;
      ticket?: string;
      boothName?: string;
    } = await r.json();
    if (!j.ok) {
      alert(j.message ?? "Call gagal");
    } else if (j.ticket && j.boothName) {
      speak(`Nomor antrean ${j.ticket}, silakan menuju ke ${j.boothName}`);
    }
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
    return rows.filter((r) => r.name.toLowerCase().includes(term));
  }, [rows, q]);
  useEffect(() => setPage(1), [q, perPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  if (loading) return <main className="p-8">Memuat...</main>;

  return (
    <>
      <CallModal
        isOpen={isModalOpen}
        booth={selectedBooth}
        onClose={handleCloseModal}
        onServeNext={async (id) => {
          await callNext(id);
          handleCloseModal();
        }}
        onFinish={async (id, ticket) => {
          await finishServing(id, ticket);
          handleCloseModal();
        }}
        onCancel={async (id) => {
          if (confirm("Yakin?")) {
            await cancelServing(id);
            handleCloseModal();
          }
        }}
        onCallAgain={(ticket, name) =>
          speak(`Nomor antrean ${ticket}, silakan menuju ke ${name}`)
        }
      />
      <section className="space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Dashboard Counters
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Login sebagai <b>{displayName}</b> di <b>{storeName}</b>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari counter..."
              className="h-9 w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {summaryData.map((item) => (
            <div
              key={item.service}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  {item.service}
                </p>
                <span className={`w-3 h-3 rounded-full ${item.color}`}></span>
              </div>
              <p className="mt-2 text-4xl font-extrabold text-slate-800 tracking-tight">
                {item.count}
              </p>
              <p className="text-xs text-slate-400">antrean menunggu</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      Counter Name
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      Now Serving
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      Waiting Queue
                    </th>
                    {/* --- PERUBAHAN DI SINI --- */}
                    <th
                      scope="col"
                      className="px-6 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      Aktif (Sistem)
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      Tersedia (Kiosk)
                    </th>
                    <th scope="col" className="relative px-6 py-3.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {pageRows.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-800">
                        {r.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-mono font-bold text-slate-800">
                        {r.activeTicket}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {r.waitingTickets.length > 0 ? (
                            r.waitingTickets.map((ticket) => (
                              <span
                                key={ticket}
                                className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-full"
                              >
                                {ticket}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                      {/* --- PERUBAHAN DI SINI --- */}
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex justify-center">
                          <label
                            title="Sistem bisa memanggil antrean untuk counter ini"
                            className="inline-flex items-center cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={r.is_active}
                              onChange={(e) =>
                                setActive(r.id, e.target.checked)
                              }
                              className="peer sr-only"
                            />
                            <span className="h-5 w-10 rounded-full bg-slate-300 peer-checked:bg-amber-500 relative after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white peer-checked:after:translate-x-5 transition-all" />
                          </label>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex justify-center">
                          <label
                            title="Counter ini muncul di mesin Kiosk"
                            className="inline-flex items-center cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={r.available}
                              onChange={(e) =>
                                setAvailable(r.id, e.target.checked)
                              }
                              className="peer sr-only"
                            />
                            <span className="h-5 w-10 rounded-full bg-slate-300 peer-checked:bg-emerald-500 relative after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white peer-checked:after:translate-x-5 transition-all" />
                          </label>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <button
                          onClick={() => handleOpenModal(r)}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr>
                      <td
                        className="px-6 py-10 text-center text-sm text-slate-500"
                        colSpan={7}
                      >
                        Tidak ada data yang cocok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="text-slate-600">
              Menampilkan <b>{pageRows.length}</b> dari <b>{filtered.length}</b>{" "}
              hasil
            </p>
          </div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
