"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supaClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supaClient.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/admin");
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const { error } = await supaClient.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    await supaClient.auth.getSession(); // pastikan cookie siap
    router.replace("/admin"); // jangan window.location
  }

  return (
    <section className="grid place-items-center min-h-[70dvh]">
      <div className="w-full max-w-md">
        <div className="bg-white/80 backdrop-blur rounded-3xl shadow-[0_10px_30px_-10px_rgba(0,0,0,.15)] p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-center">
            Login Admin
          </h1>
          <p className="text-sm text-slate-500 text-center mt-1">
            Masuk dengan email & password Supabase.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-inner focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Password
              </label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.currentTarget.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-inner focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400"
                placeholder="••••••••"
              />
            </div>

            {err && <div className="text-sm text-rose-600">{err}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-medium tracking-tight hover:bg-indigo-700 active:scale-[.99] disabled:opacity-50"
            >
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
