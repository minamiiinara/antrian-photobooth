// app/api/tickets/[publicId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

const AVG_SERVICE_TIME = 5; // Asumsi waktu layanan: 5 menit per orang

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

  // Hitung antrean di depan
  const { count: waitingBefore } = await supa
    .from("tickets")
    .select("*", { head: true, count: "exact" })
    .eq("store_id", t.store_id)
    .eq("service", t.service)
    .eq("status", "waiting")
    .eq("ymd", t.ymd)
    .lt("id", t.id);

  // Hitung yang sedang dilayani
  const { count: servingCount } = await supa
    .from("tickets")
    .select("*", { head: true, count: "exact" })
    .eq("store_id", t.store_id)
    .eq("service", t.service)
    .eq("status", "serving")
    .eq("ymd", t.ymd);

  // Kalkulasi estimasi waktu
  const estimatedWaitTime =
    ((waitingBefore ?? 0) + (servingCount ?? 0)) * AVG_SERVICE_TIME;

  const { data: serving } = await supa
    .from("tickets")
    .select("ticket")
    .eq("store_id", t.store_id)
    .eq("service", t.service)
    .eq("status", "serving")
    .eq("ymd", t.ymd)
    .order("called_at", { ascending: false })
    .limit(1);

  return NextResponse.json({
    store_id: t.store_id,
    ticket: t.ticket,
    waitingBefore: waitingBefore ?? 0,
    nowServing: serving?.[0]?.ticket ?? null,
    estimatedWaitTime, // Kirim data estimasi waktu
  });
}
