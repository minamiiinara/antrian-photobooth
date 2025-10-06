// app/kiosk/page.tsx (Server)
import { redirect } from "next/navigation";
import { getServerUserAndStore } from "@/lib/auth-server";
import KioskClient from "./kiosk-client"; // komponen client-mu
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export default async function KioskPage() {
  const { user, storeAccess } = await getServerUserAndStore();
  if (!user) redirect("/login");
  if (!storeAccess) {
    return (
      <main className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Tidak diizinkan
        </h1>
        <p className="text-slate-600 mt-2">
          Akun Anda tidak terdaftar pada cabang mana pun.
        </p>
      </main>
    );
  }
  // --- TAMBAHKAN KODE INI ---
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: store } = await supabase
    .from("stores")
    .select("name")
    .eq("id", storeAccess.store_id)
    .single();
  // --- END ---
  return (
    <KioskClient
      storeId={storeAccess.store_id}
      storeName={store?.name ?? "Nama Cabang Tidak Ditemukan"} // <-- Kirim prop baru
    />
  );
}
