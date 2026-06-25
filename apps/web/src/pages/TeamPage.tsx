import { useEffect, useState, useCallback } from "react";
import { api, apiJson } from "../lib/api";
import { useBusiness, type Role } from "../lib/businessContext";
import { Sheet } from "./TransactionsPage";

interface Member {
  membershipId: string;
  userId: string;
  role: Role;
  name: string;
  email: string;
}

const roleLabel: Record<Role, string> = {
  owner: "Pemilik",
  admin: "Admin",
  pencatat: "Pencatat",
  viewer: "Pengamat",
};
const roleDesc: Record<Role, string> = {
  owner: "Akses penuh",
  admin: "Kelola data, kategori, akun & anggota",
  pencatat: "Mencatat & mengubah transaksi",
  viewer: "Hanya melihat (tidak bisa mencatat)",
};

export default function TeamPage() {
  const { current } = useBusiness();
  const businessId = current?.id ?? "";
  const canManage = current?.role === "owner" || current?.role === "admin";
  const isOwner = current?.role === "owner";
  const [members, setMembers] = useState<Member[]>([]);
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState<Member | null>(null);
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
          <button className="btn-primary py-2" onClick={() => setAdd(true)}>
            + Anggota
          </button>
        )}
      </div>

      {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}

      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.membershipId} className="card flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium">{m.name}</p>
              <p className="truncate text-xs text-slate-400">{m.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{roleLabel[m.role]}</span>
              {canManage && (
                <button className="text-slate-300 hover:text-brand" onClick={() => setEdit(m)} title="Kelola">
                  ⋯
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {add && (
        <AddMember
          businessId={businessId}
          isOwner={isOwner}
          onClose={() => setAdd(false)}
          onDone={(t) => {
            setMsg(t);
            void load();
          }}
        />
      )}
      {edit && (
        <ManageMember
          businessId={businessId}
          member={edit}
          isOwner={isOwner}
          onClose={() => setEdit(null)}
          onDone={(t) => {
            setMsg(t);
            void load();
          }}
        />
      )}
    </div>
  );
}

function roleOptions(isOwner: boolean): Role[] {
  return isOwner ? ["viewer", "pencatat", "admin", "owner"] : ["viewer", "pencatat", "admin"];
}

function AddMember({ businessId, isOwner, onClose, onDone }: { businessId: string; isOwner: boolean; onClose: () => void; onDone: (m: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("pencatat");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await apiJson(`/api/businesses/${businessId}/members`, { method: "POST", body: { name, email, password, role } });
      onDone(`Akun ${email} dibuat. Bagikan email & password ke anggota untuk login.`);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Sheet title="Buat akun anggota" onClose={onClose}>
      <div>
        <label className="label">Nama</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="label">Email (untuk login)</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label">Password (min. 8 karakter)</label>
        <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label className="label">Peran</label>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {roleOptions(isOwner).map((r) => (
            <option key={r} value={r}>
              {roleLabel[r]} — {roleDesc[r]}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" onClick={submit}>
        Buat akun
      </button>
      <p className="text-xs text-slate-400">Registrasi publik ditutup — anggota hanya bisa login dengan akun yang Anda buat di sini.</p>
    </Sheet>
  );
}

function ManageMember({ businessId, member, isOwner, onClose, onDone }: { businessId: string; member: Member; isOwner: boolean; onClose: () => void; onDone: (m: string) => void }) {
  const [role, setRole] = useState<Role>(member.role);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function saveRole() {
    setError(null);
    try {
      await apiJson(`/api/businesses/${businessId}/members/${member.userId}`, { method: "PATCH", body: { role } });
      onDone("Peran diperbarui.");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function resetPw() {
    setError(null);
    if (newPassword.length < 8) return setError("Password minimal 8 karakter");
    try {
      await apiJson(`/api/businesses/${businessId}/members/${member.userId}/password`, { method: "POST", body: { password: newPassword } });
      onDone(`Password ${member.email} direset. Bagikan password baru ke anggota.`);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function remove() {
    setError(null);
    const res = await api(`/api/businesses/${businessId}/members/${member.userId}`, { method: "DELETE" });
    if (res.ok) {
      onDone(`${member.name} dikeluarkan.`);
      onClose();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Gagal");
    }
  }

  return (
    <Sheet title={`Kelola: ${member.name}`} onClose={onClose}>
      <div>
        <label className="label">Peran</label>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {roleOptions(isOwner).map((r) => (
            <option key={r} value={r}>
              {roleLabel[r]} — {roleDesc[r]}
            </option>
          ))}
        </select>
        <button className="btn-primary mt-2 w-full" onClick={saveRole}>
          Simpan peran
        </button>
      </div>
      <div className="border-t border-slate-100 pt-3">
        <label className="label">Reset password</label>
        <input className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password baru (min. 8)" />
        <button className="btn-ghost mt-2 w-full" onClick={resetPw}>
          Reset password
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <button className="btn-ghost w-full text-red-600" onClick={remove}>
        Keluarkan dari usaha
      </button>
    </Sheet>
  );
}
