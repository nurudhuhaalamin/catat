import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { signIn } from "../lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn.email({ email, password });
    setLoading(false);
    if (error) setError(error.message ?? "Gagal masuk");
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center p-6">
      <h1 className="mb-1 text-2xl font-bold text-brand-dark">Catat</h1>
      <p className="mb-6 text-slate-500">Masuk ke akun Anda</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Kata sandi</label>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Memproses…" : "Masuk"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Belum punya akun?{" "}
        <Link to="/register" className="font-semibold text-brand">
          Daftar
        </Link>
      </p>
    </div>
  );
}
