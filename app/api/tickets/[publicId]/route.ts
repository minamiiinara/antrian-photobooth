// app/api/tickets/[publicId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await ctx.params;

  const supa = serverClient();
  const { data: t } = await supa
    .from("tickets")
    .select("*")
    .eq("public_id", publicId)
    .single();

  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });

  // --- PERBAIKAN DI SINI ---
  // Menghitung antrean yang statusnya 'waiting' HANYA PADA HARI INI
  const { count } = await supa
    .from("tickets")
    .select("*", { head: true, count: "exact" })
    .eq("store_id", t.store_id)
    .eq("service", t.service)
    .eq("status", "waiting")
    .eq("ymd", t.ymd) // <-- FILTER TANGGAL DITAMBAHKAN
    .lt("id", t.id);

  // Mengambil nomor yang sedang dilayani HANYA PADA HARI INI
  const { data: serving } = await supa
    .from("tickets")
    .select("ticket")
    .eq("store_id", t.store_id)
    .eq("service", t.service)
    .eq("status", "serving")
    .eq("ymd", t.ymd) // <-- FILTER TANGGAL DITAMBAHKAN
    .order("called_at", { ascending: false })
    .limit(1);

  return NextResponse.json({
    store_id: t.store_id,
    ticket: t.ticket,
    waitingBefore: count ?? 0,
    nowServing: serving?.[0]?.ticket ?? null,
  });
}
