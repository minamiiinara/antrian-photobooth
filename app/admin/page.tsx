// app/admin/page.tsx (SERVER)
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import AdminClient from "./adminClient";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Ambil data user_store (termasuk kolom 'name' baru)
  const { data: us } = await supabase
    .from("user_store")
    .select("store_id, role, name") // <-- Tambahkan 'name'
    .eq("user_id", user.id)
    .single();

  if (!us?.store_id) {
    return (
      <main className="p-8">Akun tidak terhubung ke cabang mana pun.</main>
    );
  }

  // Ambil data nama store
  const { data: store } = await supabase
    .from("stores")
    .select("name")
    .eq("id", us.store_id)
    .single();

  const displayName = us.name || user.email || "";
  const storeName = store?.name || "Nama Cabang Tidak Ditemukan";

  return (
    <AdminClient
      displayName={displayName}
      storeId={us.store_id}
      storeName={storeName}
    />
  );
}
