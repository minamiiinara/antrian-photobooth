// app/kiosk/page.tsx (Server)
import { redirect } from "next/navigation";
import { getServerUserAndStore } from "@/lib/auth-server";
import KioskClient from "./kiosk-client"; // komponen client-mu

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
  return <KioskClient storeId={storeAccess.store_id} />;
}
