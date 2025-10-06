import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { ticket, storeId }: { ticket: string; storeId: string } =
      await req.json();
    const supa = serverClient();
    await supa
      .from("tickets")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("store_id", storeId)
      .eq("ticket", ticket);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
