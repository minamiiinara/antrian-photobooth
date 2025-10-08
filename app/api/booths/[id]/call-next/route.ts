import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { todayYMD } from "@/lib/date";

// Ubah tipe data agar lebih spesifik
type BoothRow = {
  id: string;
  store_id: string;
  service: "A" | "B" | "C" | "D" | "E";
  name: string;
};
type TicketRow = { id: number; number: number; ticket: string };

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const boothId = params.id;
  const ymd = todayYMD();
  const supa = serverClient();

  // Ambil data booth (termasuk 'name')
  const { data: booth, error: e1 } = await supa
    .from("booths")
    .select("id,store_id,service,name") // <-- Tambahkan 'name'
    .eq("id", boothId)
    .single<BoothRow>();

  if (e1 || !booth) {
    return NextResponse.json(
      { ok: false, message: "Booth tidak ditemukan" },
      { status: 404 }
    );
  }

  // Ambil tiket berikutnya (termasuk 'ticket')
  const { data: nextTicket, error: e2 } = await supa
    .from("tickets")
    .select("id,number,ticket") // <-- Tambahkan 'ticket'
    .eq("store_id", booth.store_id)
    .eq("service", booth.service)
    .eq("status", "waiting")
    .eq("ymd", ymd)
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle<TicketRow>();

  if (e2 || !nextTicket) {
    return NextResponse.json(
      { ok: false, message: "Tidak ada antrean yang menunggu" },
      { status: 200 }
    );
  }

  // Set jadi 'serving'
  const { error: e3 } = await supa
    .from("tickets")
    .update({
      status: "serving",
      booth_id: boothId,
      called_at: new Date().toISOString(),
    })
    .eq("id", nextTicket.id);

  if (e3) {
    return NextResponse.json(
      { ok: false, message: "Gagal mengubah status tiket" },
      { status: 500 }
    );
  }

  // Kembalikan data yang dibutuhkan untuk fitur suara
  return NextResponse.json({
    ok: true,
    ticket: nextTicket.ticket, // <-- Nomor tiket yang dipanggil
    boothName: booth.name, // <-- Nama booth yang memanggil
  });
}
