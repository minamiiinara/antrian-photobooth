import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { newPublicId, todayYMD } from "@/lib/utils";

/**
 * Body JSON: { storeId: string, service: "A" | "B" | "C" }
 */
export async function POST(req: NextRequest) {
  try {
    const { storeId, service } = await req.json();
    if (!storeId || !/^[A-Z]$/.test(service)) {
      throw new Error("storeId/service invalid");
    }

    const supa = serverClient();
    const ymd = todayYMD();

    // ambil counter hari ini; kalau belum ada, buat
    const { data: counter } = await supa
      .from("counters")
      .select("*")
      .eq("store_id", storeId)
      .eq("service", service)
      .eq("ymd", ymd)
      .maybeSingle();

    const next = (counter?.last_number ?? 0) + 1;

    if (counter) {
      await supa
        .from("counters")
        .update({ last_number: next })
        .eq("store_id", storeId)
        .eq("service", service)
        .eq("ymd", ymd);
    } else {
      await supa
        .from("counters")
        .insert({ store_id: storeId, service, ymd, last_number: next });
    }

    const ticket = service + String(next).padStart(3, "0");
    const publicId = newPublicId();

    await supa.from("tickets").insert({
      store_id: storeId,
      service,
      number: next,
      ticket,
      public_id: publicId,
      ymd, // ⬅️ penting
    });

    // hitung berapa yg waiting sebelum tiket ini
    const { count } = await supa
      .from("tickets")
      .select("*", { head: true, count: "exact" })
      .eq("store_id", storeId)
      .eq("service", service)
      .eq("status", "waiting")
      .eq("ymd", ymd); // ⬅️ hanya hari ini
    const waitingBefore = Math.max((count ?? 1) - 1, 0);

    // sedang dilayani (terakhir)
    const { data: serving } = await supa
      .from("tickets")
      .select("ticket")
      .eq("store_id", storeId)
      .eq("service", service)
      .eq("status", "serving")
      .order("called_at", { ascending: false })
      .eq("ymd", ymd) // ⬅️ hanya hari ini
      .limit(1);

    const statusUrl = `${process.env.PUBLIC_BASE_URL}/t/${publicId}`;

    return NextResponse.json({
      ok: true,
      ticket,
      publicId,
      waitingBefore,
      nowServing: serving?.[0]?.ticket ?? null,
      statusUrl,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
