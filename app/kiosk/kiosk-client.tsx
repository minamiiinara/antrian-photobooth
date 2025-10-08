"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type BoothRow = {
  id: string;
  name: string;
  service: "A" | "B" | "C" | "D" | "E";
};
type TicketData = {
  ticket: string;
  waiting: string;
  now: string;
  url: string;
  estimatedWaitTime: number;
};
declare global {
  interface Window {
    connectedPrinter?: BluetoothDevice;
  }
}

export default function KioskClient({
  storeId,
  storeName,
}: {
  storeId: string;
  storeName: string;
}) {
  const supaClient = createClient();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [booths, setBooths] = useState<BoothRow[]>([]);
  const [err, setErr] = useState("");
  const [printer, setPrinter] = useState<BluetoothDevice | null>(null);
  const [printerStatus, setPrinterStatus] = useState<string>("Belum terhubung");

  async function connectPrinter() {
    if (!navigator.bluetooth) {
      const errorMsg =
        "Browser tidak mendukung Web Bluetooth. Gunakan Google Chrome atau Microsoft Edge.";
      setPrinterStatus(errorMsg);
      alert(errorMsg);
      return;
    }
    try {
      setPrinterStatus("Mencari printer...");
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: "RPP" },
          { namePrefix: "Thermal" },
          { namePrefix: "POS" },
          { services: ["000018f0-0000-1000-8000-00805f9b34fb"] },
        ],
        optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
      });
      if (!device) throw new Error("Tidak ada printer yang dipilih.");
      device.addEventListener("gattserverdisconnected", () => {
        setPrinterStatus("Printer terputus");
        setPrinter(null);
        window.connectedPrinter = undefined;
      });
      setPrinter(device);
      setPrinterStatus(`Terhubung ke ${device.name}`);
      window.connectedPrinter = device;
    } catch (e) {
      console.error("Gagal menghubungkan printer", e);
      setPrinterStatus("Gagal terhubung atau dibatalkan");
      setPrinter(null);
      window.connectedPrinter = undefined;
    }
  }

  async function printThermal(data: TicketData) {
    if (!window.connectedPrinter) throw new Error("Printer tidak terhubung.");
    try {
      setBusy(true);
      const server = await window.connectedPrinter.gatt?.connect();
      const service = await server?.getPrimaryService(
        "000018f0-0000-1000-8000-00805f9b34fb"
      );
      const characteristic = await service?.getCharacteristic(
        "00002af1-0000-1000-8000-00805f9b34fb"
      );

      const encoder = new TextEncoder();
      const reset = new Uint8Array([0x1b, 0x40]);
      const alignCenter = new Uint8Array([0x1b, 0x61, 1]);
      const alignLeft = new Uint8Array([0x1b, 0x61, 0]);
      const doubleHeightWidth = new Uint8Array([0x1d, 0x21, 0x11]);
      const normalSize = new Uint8Array([0x1d, 0x21, 0x00]);
      const boldOn = new Uint8Array([0x1b, 0x45, 1]);
      const boldOff = new Uint8Array([0x1b, 0x45, 0]);
      const cutPaper = new Uint8Array([0x1d, 0x56, 1]);
      const lineFeed = encoder.encode("\n");

      const qrData = data.url;
      const dataLength = qrData.length + 3;
      const pL = dataLength % 256;
      const pH = Math.floor(dataLength / 256);

      const setQRModel = new Uint8Array([
        0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
      ]);
      const setQRSize = new Uint8Array([
        0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x05,
      ]);
      const setQRErrorCorrection = new Uint8Array([
        0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31,
      ]);
      const storeQRData = new Uint8Array([
        0x1d,
        0x28,
        0x6b,
        pL,
        pH,
        0x31,
        0x50,
        0x30,
      ]);
      const printQR = new Uint8Array([
        0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
      ]);

      const commands = [
        reset,
        alignCenter,
        boldOn,
        encoder.encode("ANTRIAN\n"),
        boldOff,
        lineFeed,
        alignLeft,
        normalSize,
        encoder.encode(`Nomor:\n`),
        alignCenter,
        doubleHeightWidth,
        boldOn,
        encoder.encode(`${data.ticket}\n`),
        boldOff,
        normalSize,
        lineFeed,
        alignLeft,
        encoder.encode(
          `${new Date().toLocaleString("id-ID", {
            dateStyle: "short",
            timeStyle: "medium",
          })}\n`
        ),
        encoder.encode(`Antrean di depan: ${data.waiting}\n`),
        encoder.encode(`Sedang dilayani: ${data.now}\n`),
        boldOn,
        encoder.encode(
          `Perkiraan waktu tunggu: ${data.estimatedWaitTime} menit\n`
        ),
        boldOff,
        lineFeed,
        alignCenter,
        encoder.encode("Mohon standby di toko 10 menit\n"),
        encoder.encode("sebelum waktu estimasi Anda\n"),
        lineFeed,
        setQRModel,
        setQRSize,
        setQRErrorCorrection,
        storeQRData,
        encoder.encode(qrData),
        printQR,
        lineFeed,
        encoder.encode(data.url),
        lineFeed,
        lineFeed,
        lineFeed,
        cutPaper,
      ];
      for (const cmd of commands) {
        await characteristic?.writeValue(cmd);
      }
    } catch (e) {
      console.error("Gagal mencetak", e);
      setPrinterStatus("Koneksi error, coba hubungkan ulang.");
      setPrinter(null);
      window.connectedPrinter = undefined;
      throw new Error(
        "Gagal mengirim data ke printer. Silakan hubungkan kembali."
      );
    }
  }

  async function ambil(service: "A" | "B" | "C" | "D" | "E") {
    if (busy || !printer) {
      if (!printer)
        alert("Silakan hubungkan printer Bluetooth terlebih dahulu.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, service }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Gagal mengambil tiket");
      await printThermal({
        ticket: j.ticket,
        waiting: String(j.waitingBefore),
        now: j.nowServing ?? "-",
        url: j.statusUrl,
        estimatedWaitTime: j.estimatedWaitTime,
      });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function fetchAvailableBooths() {
    setErr("");
    const ymd = new Date().toISOString().split("T")[0];
    const { data: boothStatusData, error: statusError } = await supaClient
      .from("booth_status")
      .select("booth_id")
      .eq("available", true)
      .eq("is_active", true)
      .eq("ymd", ymd);
    if (statusError) {
      setErr(statusError.message);
      setLoading(false);
      return;
    }
    const availableBoothIds = boothStatusData.map((s) => s.booth_id);
    if (availableBoothIds.length === 0) {
      setBooths([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supaClient
      .from("booths")
      .select("id,name,service")
      .eq("store_id", storeId)
      .in("id", availableBoothIds)
      .order("name", { ascending: true });
    if (error) setErr(error.message);
    else setBooths((data ?? []) as BoothRow[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchAvailableBooths();
    const channel = supaClient
      .channel("realtime-kiosk-booths")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booth_status" },
        () => fetchAvailableBooths()
      )
      .subscribe();
    return () => {
      supaClient.removeChannel(channel);
    };
  }, [storeId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80dvh] text-slate-500">
        <p>Memuat Kiosk...</p>
      </div>
    );
  }

  return (
    <section className="flex flex-col items-center justify-center min-h-[80dvh] px-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            Kiosk Tiket
          </h1>
          <p className="mt-1 text-md text-slate-600">
            Cabang: <span className="font-semibold">{storeName}</span>
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              onClick={connectPrinter}
              className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:bg-slate-400"
              disabled={!!printer}
            >
              {printer ? "Printer Terhubung" : "Hubungkan Printer"}
            </button>
            <p
              className={`text-sm font-medium ${
                printer ? "text-green-600" : "text-slate-500"
              }`}
            >
              Status: {printerStatus}
            </p>
          </div>
        </div>

        {err && (
          <div className="p-4 mb-4 text-center text-red-700 bg-red-100 rounded-lg">
            Error: {err}
          </div>
        )}
        {booths.length === 0 && !err && !loading && (
          <div className="p-8 text-center bg-slate-50 rounded-2xl">
            <p className="text-slate-600 font-medium">
              Tidak ada layanan yang tersedia.
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Pastikan status &quot;Available&quot; di halaman Admin sudah
              dinyalakan.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {booths.map((b) => (
            <button
              key={b.id}
              disabled={busy || !printer}
              onClick={() => ambil(b.service)}
              className="group flex flex-col justify-between p-6 rounded-2xl bg-white text-left shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                  {b.name}
                </h2>
                <span className="mt-2 inline-block px-3 py-1 text-xs font-semibold tracking-wider text-indigo-800 bg-indigo-100 rounded-full">
                  Layanan {b.service}
                </span>
              </div>
              <div
                className={`mt-6 font-semibold ${
                  printer ? "text-indigo-600" : "text-slate-400"
                }`}
              >
                {busy ? "Mencetak..." : "Ambil Tiket"}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
