// app/admin/page.tsx (SERVER)
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import AdminClient from "./adminClient";

export default async function AdminPage() {
  // auth di server
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // server component: tidak set cookie di sini
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ambil cabang user (user_store)
  const { data: us } = await supabase
    .from("user_store")
    .select("store_id, role")
    .eq("user_id", user.id)
    .single();

  if (!us?.store_id) {
    return (
      <main className="p-8">Akun tidak terhubung ke cabang mana pun.</main>
    );
  }

  return <AdminClient email={user.email ?? ""} storeId={us.store_id} />;
}
