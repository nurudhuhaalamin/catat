import { useEffect, useState, useCallback } from "react";
import { apiJson } from "../lib/api";
import { useBusiness } from "../lib/businessContext";
import { Sheet } from "./TransactionsPage";

interface Member {
  membershipId: string;
  userId: string;
  role: "owner" | "admin" | "staff";
  name: string;
  email: string;
}

const roleLabel: Record<string, string> = { owner: "Pemilik", admin: "Admin", staff: "Staf" };

export default function TeamPage() {
  const { current } = useBusiness();
  const businessId = current?.id ?? "";
  const canManage = current?.role === "owner" || current?.role === "admin";
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    const data = await apiJson<{ members: Member[] }>(`/api/businesses/${businessId}/members`);
    setMembers(data.members);
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Tim</h2>
        {canManage && (
          <button className="btn-primary py-2" onClick={() => setOpen(true)}>
            + Undang
          </button>
        )}
      </div>

      {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}

      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.membershipId} className="card flex items-center justify-between">
            <div>
              <p className="font-medium">{m.name}</p>
              <p className="text-xs text-slate-400">{m.email}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{roleLabel[m.role]}</span>
          </li>
        ))}
      </ul>

      {open && (
        <InviteSheet
          businessId={businessId}
          isOwner={current?.role === "owner"}
          onClose={() => setOpen(false)}
          onDone={(text) => {
            setMsg(text);
            void load();
          }}
        />
      )}
    </div>
  );
}

function InviteSheet({
  businessId,
  isOwner,
  onClose,
  onDone,
}: {
  businessId: string;
  isOwner: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "staff" | "owner">("staff");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      const res = await apiJson<{ status: string; token?: string }>(`/api/businesses/${businessId}/invitations`, {
        method: "POST",
        body: { email, role },
      });
      onDone(
        res.status === "added"
          ? "Anggota berhasil ditambahkan."
          : `Undangan dibuat. Bagikan kode ini ke ${email}: ${res.token}`,
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Sheet title="Undang anggota tim" onClose={onClose}>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="label">Peran</label>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="staff">Staf (catat transaksi)</option>
          <option value="admin">Admin (kelola data + undang)</option>
          {isOwner && <option value="owner">Pemilik (akses penuh)</option>}
        </select>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" onClick={submit}>
        Kirim undangan
      </button>
      <p className="text-xs text-slate-400">
        Jika emailnya sudah punya akun Catat, ia langsung ditambahkan. Jika belum, bagikan kode undangan agar ia daftar lalu
        memasukkannya di menu Lainnya → Terima undangan.
      </p>
    </Sheet>
  );
}
