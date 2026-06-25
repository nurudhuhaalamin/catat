import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../lib/api";
import { useBusiness } from "../lib/businessContext";

export default function OnboardingPage() {
  const { businesses, refresh, setCurrentId } = useBusiness();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiJson<{ business: { id: string } }>("/api/businesses", {
        method: "POST",
        body: { name, currency: "IDR" },
      });
      await refresh();
      setCurrentId(data.business.id);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center p-6">
      <h1 className="mb-1 text-2xl font-bold text-brand-dark">
        {businesses.length ? "Tambah lini usaha" : "Buat lini usaha pertama"}
      </h1>
      <p className="mb-6 text-slate-500">Satu sistem untuk semua usaha Anda. Bisa tambah usaha kapan saja.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Nama usaha</label>
          <input className="input" required placeholder="mis. Toko Sembako Berkah" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Menyimpan…" : "Buat usaha"}
        </button>
        {businesses.length > 0 && (
          <button type="button" className="btn-ghost w-full" onClick={() => navigate("/")}>
            Batal
          </button>
        )}
      </form>
    </div>
  );
}
