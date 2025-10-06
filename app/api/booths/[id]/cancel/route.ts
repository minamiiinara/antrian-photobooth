import { NextResponse } from "next/server";
import { supaClient } from "@/lib/supabase";
import { todayYMD } from "@/lib/date";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const boothId = params.id;
  const ymd = todayYMD();

  // tiket yang lagi serving di booth ini, hari ini
  const { data: t, error: e1 } = await supaClient
    .from("tickets")
    .select("id")
    .eq("booth_id", boothId)
    .eq("status", "serving")
    .eq("ymd", ymd)
    .maybeSingle<{ id: number }>();

  if (e1 || !t) {
    return NextResponse.json(
      { ok: false, message: "Tidak ada tiket serving" },
      { status: 200 }
    );
  }

  // ubah jadi canceled (atau kalau maunya balikin ke waiting, ganti saja)
  const { error: e2 } = await supaClient
    .from("tickets")
    .update({ status: "canceled" })
    .eq("id", t.id);

  if (e2) {
    return NextResponse.json(
      { ok: false, message: "Gagal membatalkan" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
