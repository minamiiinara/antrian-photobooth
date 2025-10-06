// lib/auth-server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export type StoreAccess = { store_id: string; role: string } | null;

export async function getServerUserAndStore(): Promise<{
  user: { id: string; email?: string | null } | null;
  storeAccess: StoreAccess;
}> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // NO-OP di Server Component
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, storeAccess: null };

  // cek user_store (semua yg login dianggap user, tapi harus terdaftar)
  const { data: us } = await supabase
    .from("user_store")
    .select("store_id, role")
    .eq("user_id", user.id)
    .maybeSingle<{ store_id: string; role: string }>();

  return { user: { id: user.id, email: user.email }, storeAccess: us ?? null };
}
