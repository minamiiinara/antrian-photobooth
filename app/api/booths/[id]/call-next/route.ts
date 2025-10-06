import { NextResponse } from "next/server";
import { supaClient } from "@/lib/supabase";
import { todayYMD } from "@/lib/date";

type BoothRow = { id: string; store_id: string; service: "A" | "B" | "C" };

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const boothId = params.id;
  const ymd = todayYMD();

  // booth (ambil store_id + service)
  const { data: booth, error: e1 } = await supaClient
    .from("booths")
    .select("id,store_id,service")
    .eq("id", boothId)
    .single<BoothRow>();

  if (e1 || !booth) {
    return NextResponse.json(
      { ok: false, message: "Booth tidak ditemukan" },
      { status: 404 }
    );
  }

  // tiket waiting paling kecil untuk store+service hari ini
  const { data: nextTicket, error: e2 } = await supaClient
    .from("tickets")
    .select("id,number")
    .eq("store_id", booth.store_id)
    .eq("service", booth.service)
    .eq("status", "waiting")
    .eq("ymd", ymd)
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: number; number: number }>();

  if (e2 || !nextTicket) {
    return NextResponse.json(
      { ok: false, message: "Tidak ada tiket waiting" },
      { status: 200 }
    );
  }

  // set jadi serving + isi booth + called_at
  const { error: e3 } = await supaClient
    .from("tickets")
    .update({
      status: "serving",
      booth_id: boothId,
      called_at: new Date().toISOString(),
    })
    .eq("id", nextTicket.id);

  if (e3) {
    return NextResponse.json(
      { ok: false, message: "Gagal mengubah status" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
