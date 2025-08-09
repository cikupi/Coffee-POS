"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Role = "ADMIN" | "KASIR" | "BARISTA";

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  createdAt?: string;
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<{ name: string; email: string; phone?: string; role: Role; password?: string }>({
    name: "",
    email: "",
    phone: "",
    role: "KASIR",
    password: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ users: User[] }>("/api/users");
      setUsers(res.users);
    } catch (e: any) {
      setError(e.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function onAdd() {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", role: "KASIR", password: "" });
    setOpen(true);
  }

  function onEdit(u: User) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, phone: u.phone ?? "", role: u.role });
    setOpen(true);
  }

  async function onDelete(u: User) {
    if (!confirm(`Hapus user ${u.name}?`)) return;
    try {
      await api(`/api/users/${u.id}`, { method: "DELETE" });
      await load();
      toast.success("User dihapus");
    } catch (e: any) {
      toast.error(e.message || "Gagal menghapus");
    }
  }

  async function onResetPassword(u: User) {
    const pwd = prompt("Password baru untuk user ini:", "password123");
    if (!pwd) return;
    try {
      await api(`/api/users/${u.id}/reset-password`, { method: "PATCH", body: JSON.stringify({ password: pwd }) });
      toast.success("Password direset");
    } catch (e: any) {
      toast.error(e.message || "Gagal reset password");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      if (editing) {
        await api(`/api/users/${editing.id}`, { method: "PUT", body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, role: form.role }) });
      } else {
        await api(`/api/users`, { method: "POST", body: JSON.stringify({ ...form }) });
      }
      setOpen(false);
      await load();
      toast.success("User disimpan");
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan");
    }
  }

  if (me?.role !== "ADMIN") {
    return <div className="text-sm text-stone-600">Akses ditolak. Hanya Admin yang dapat mengelola user.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Manajemen User</h1>
        <Button className="w-full sm:w-auto" onClick={onAdd}>Tambah User</Button>
      </div>
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded">{error}</div>}
      <div className="bg-white border rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left px-3 py-2">Nama</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Telepon</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="text-right px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-3" colSpan={5}>Memuat...</td></tr>
            ) : users.length === 0 ? (
              <tr><td className="px-3 py-3" colSpan={5}>Belum ada data</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.phone ?? "-"}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => onEdit(u)}>Edit</Button>
                    <Button variant="destructive" onClick={() => onDelete(u)}>Hapus</Button>
                    <Button variant="outline" onClick={() => onResetPassword(u)}>Reset Password</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Tambah User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-sm">Nama</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="text-sm">Email</label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="text-sm">Telepon</label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm">Role</label>
              <Select value={form.role} onValueChange={(v: Role) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="KASIR">Kasir</SelectItem>
                  <SelectItem value="BARISTA">Barista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editing && (
              <div>
                <label className="text-sm">Password</label>
                <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
              </div>
            )}
            <DialogFooter>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
