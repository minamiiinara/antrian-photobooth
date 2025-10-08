// app/api/tickets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { newPublicId, todayYMD } from "@/lib/utils";

const AVG_SERVICE_TIME = 5; // Asumsi waktu layanan: 5 menit per orang

export async function POST(req: NextRequest) {
  try {
    const { storeId, service } = await req.json();
    if (!storeId || !/^[A-Z]$/.test(service)) {
      throw new Error("storeId/service invalid");
    }

    const supa = serverClient();
    const ymd = todayYMD();

    // Hitung berapa yg waiting SEBELUM tiket ini dibuat
    const { count: waitingBeforeCount } = await supa
      .from("tickets")
      .select("*", { head: true, count: "exact" })
      .eq("store_id", storeId)
      .eq("service", service)
      .eq("status", "waiting")
      .eq("ymd", ymd);

    // Hitung juga berapa orang yang sedang dilayani untuk layanan ini
    const { count: servingCount } = await supa
      .from("tickets")
      .select("*", { head: true, count: "exact" })
      .eq("store_id", storeId)
      .eq("service", service)
      .eq("status", "serving")
      .eq("ymd", ymd);

    // Kalkulasi estimasi waktu
    const estimatedWaitTime =
      ((waitingBeforeCount ?? 0) + (servingCount ?? 0)) * AVG_SERVICE_TIME;

    // --- Sisa logika (counter, insert tiket) sama seperti kode Anda ---
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
        .eq("id", counter.id);
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
      ymd,
      status: "waiting",
    });

    const { data: serving } = await supa
      .from("tickets")
      .select("ticket")
      .eq("store_id", storeId)
      .eq("service", service)
      .eq("status", "serving")
      .order("called_at", { ascending: false })
      .eq("ymd", ymd)
      .limit(1);

    // Pastikan base URL ada, fallback ke localhost jika tidak diset
    const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
    const statusUrl = `${baseUrl}/t/${publicId}`;

    return NextResponse.json({
      ok: true,
      ticket,
      publicId,
      waitingBefore: waitingBeforeCount ?? 0,
      nowServing: serving?.[0]?.ticket ?? null,
      statusUrl,
      estimatedWaitTime, // Kirim data estimasi waktu
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
