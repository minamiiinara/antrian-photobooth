// app/admin/admin-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supaClient } from "@/lib/supabase-browser";
import type { Booth } from "@/types/queue";
import { todayYMD } from "@/lib/date";

type Row = Booth & {
  activeTicket: string;
  is_active: boolean;
  available: boolean;
};

export default function AdminClient({
  email,
  storeId,
}: {
  email: string;
  storeId: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [storeId]); // kalau ganti cabang

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
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Counters</h1>
          <p className="text-sm text-slate-500">
            Login sebagai <b>{email}</b>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search booth / service…"
            className="h-9 w-56 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <select
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          <button
            onClick={() => window.location.reload()}
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
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3">{r.service}</td>
                <td className="px-4 py-3 font-semibold tracking-wider">
                  {r.activeTicket}
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center">
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
                  <label className="inline-flex items-center">
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
                      onClick={() => callNext(r.id)}
                      className="rounded-lg bg-amber-500/90 hover:bg-amber-600 text-white px-3 py-1.5"
                    >
                      Call
                    </button>
                    <button
                      onClick={() => cancelServing(r.id)}
                      className="rounded-lg bg-rose-500/90 hover:bg-rose-600 text-white px-3 py-1.5"
                    >
                      Cancel
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
          Page <b>{page}</b> of <b>{totalPages}</b> — <b>{filtered.length}</b>{" "}
          items
        </div>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 disabled:opacity-50"
          >
            x Prev
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
  );
}
