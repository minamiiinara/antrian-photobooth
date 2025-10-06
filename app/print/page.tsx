"use client";

import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function PrintPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const ticket = searchParams.ticket || "A001";
  const waiting = searchParams.waiting || "0";
  const now = searchParams.now || "-";
  const url = searchParams.url || "http://localhost:3000/t/XXXX";
  const publicId = searchParams.publicId || "XXXX";

  useEffect(() => {
    window.print(); // buka dialog print
  }, []);

  return (
    <div className="ticket">
      <div className="title">ANTRIAN</div>
      <div className="svc">Nomor:</div>
      <div className="big">{ticket}</div>
      <div className="meta">{new Date().toLocaleString()}</div>
      <div className="meta">Sisa antrean: {waiting}</div>
      <div className="meta">Sedang dilayani: {now}</div>

      <div className="qr">
        <QRCodeSVG value={url} size={128} />
      </div>
      <div className="small">{url}</div>

      <style jsx global>{`
        /* ganti ke 58mm kalau kertas kecil */
        @page {
          size: 80mm auto;
          margin: 0;
        }
        html,
        body {
          margin: 0;
          padding: 0;
        }
        .ticket {
          width: 80mm;
          padding: 6mm 5mm;
          font-family: ui-monospace, system-ui, sans-serif;
        }
        .title {
          text-align: center;
          font-weight: 700;
          font-size: 18pt;
        }
        .svc {
          text-align: center;
          margin-top: 4mm;
        }
        .big {
          text-align: center;
          font-size: 36pt;
          font-weight: 800;
          margin: 2mm 0;
        }
        .meta {
          text-align: center;
          font-size: 11pt;
          margin: 1mm 0;
        }
        .qr {
          display: flex;
          justify-content: center;
          margin: 3mm 0;
        }
        .small {
          text-align: center;
          font-size: 9pt;
          margin-top: 3mm;
          word-break: break-all;
        }
        @media screen {
          .ticket {
            border: 1px dashed #ddd;
            margin: 10px auto;
          }
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          .ticket,
          .ticket * {
            visibility: visible !important;
          }
          .ticket {
            position: fixed;
            inset: 0;
            margin: 0 !important;
            transform: none !important;
            box-shadow: none !important;
            border: 0 !important;
            background: #fff !important;
          }
          header,
          nav,
          footer {
            display: none !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html,
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
