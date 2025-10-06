import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

type Service = "A" | "B" | "C";
type WaitingRow = { id: number; ticket: string; service: Service };

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ publicId: string }> } // 👈
) {
  const { publicId } = await ctx.params; // 👈

  const supa = serverClient();

  const { data: me } = await supa
    .from("tickets")
    .select("*")
    .eq("public_id", publicId)
    .single();

  if (!me) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: store } = await supa
    .from("stores")
    .select("id,name")
    .eq("id", me.store_id)
    .single();

  const { data: booths } = await supa
    .from("booths")
    .select("id,name")
    .eq("store_id", me.store_id);

  const { data: servingAll } = await supa
    .from("tickets")
    .select("ticket,booth_id,called_at")
    .eq("store_id", me.store_id)
    .eq("status", "serving")
    .not("booth_id", "is", null)
    .order("called_at", { ascending: false })
    .limit(500);

  const latestServingByBooth = new Map<string, string>();
  (servingAll ?? []).forEach((t) => {
    const b = t.booth_id as string | null;
    if (!b) return;
    if (!latestServingByBooth.has(b))
      latestServingByBooth.set(b, t.ticket as string);
  });

  const boothViews = (booths ?? []).map((b) => ({
    id: b.id as string,
    name: b.name as string,
    serving: latestServingByBooth.get(b.id as string) ?? null,
  }));

  const { data: waitingRows } = await supa
    .from("tickets")
    .select("id,ticket,service")
    .eq("store_id", me.store_id)
    .eq("status", "waiting")
    .order("id", { ascending: true })
    .limit(60)
    .returns<WaitingRow[]>();

  const queues: Record<Service, string[]> = { A: [], B: [], C: [] };
  for (const r of waitingRows ?? []) queues[r.service].push(r.ticket);

  const { count: beforeMe } = await supa
    .from("tickets")
    .select("*", { head: true, count: "exact" })
    .eq("store_id", me.store_id)
    .eq("service", me.service)
    .eq("status", "waiting")
    .lt("id", me.id);

  return NextResponse.json({
    store: { id: store?.id ?? me.store_id, name: store?.name ?? "Store" },
    my: {
      ticket: me.ticket,
      service: me.service as Service,
      waitingBefore: beforeMe ?? 0,
    },
    booths: boothViews,
    queues,
  });
}
