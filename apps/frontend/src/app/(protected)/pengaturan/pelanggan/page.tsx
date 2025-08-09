"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/store/auth";
import { toast } from "sonner";

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  points: number;
  deposit?: number;
  createdAt: string;
};

export default function CustomersPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [pointsDelta, setPointsDelta] = useState<Record<string, string>>({});
  const [depositDelta, setDepositDelta] = useState<Record<string, string>>({});
  const isAdmin = useMemo(() => user?.role === "ADMIN", [user]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api<{ customers: Customer[]; total: number }>(
        `/api/customers?q=${encodeURIComponent(query)}`
      );
      setCustomers(res.customers);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm({ name: "", phone: "", email: "" });
    setModalOpen(true);
  };
  const openEdit = (c: Customer) => {
    setEditId(c.id);
    setForm({ name: c.name, phone: c.phone || "", email: c.email || "" });
    setModalOpen(true);
  };
  const save = async () => {
    try {
      if (!form.name.trim()) return;
      if (editId) {
        await api(`/api/customers/${editId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone.trim() || undefined,
            email: form.email.trim() || undefined,
          }),
        });
      } else {
        await api(`/api/customers`, {
          method: "POST",
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone.trim() || undefined,
            email: form.email.trim() || undefined,
          }),
        });
      }
      setModalOpen(false);
      await load();
      toast.success("Pelanggan disimpan");
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan pelanggan");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus pelanggan ini?")) return;
    try {
      await api(`/api/customers/${id}`, { method: "DELETE" });
      await load();
      toast.success("Pelanggan dihapus");
    } catch (e: any) {
      toast.error(e.message || "Gagal menghapus");
    }
  };

  const adjustPoints = async (id: string) => {
    const delta = Number(pointsDelta[id] || "0");
    if (!delta) return;
    try {
      await api(`/api/customers/${id}/points`, {
        method: "POST",
        body: JSON.stringify({ delta }),
      });
      setPointsDelta((s) => ({ ...s, [id]: "" }));
      await load();
      toast.success("Poin diperbarui");
    } catch (e: any) {
      toast.error(e.message || "Gagal update poin");
    }
  };

  const adjustDeposit = async (id: string) => {
    const delta = Number(depositDelta[id] || "0");
    if (!delta) return;
    try {
      await api(`/api/customers/${id}/deposit`, {
        method: "POST",
        body: JSON.stringify({ delta }),
      });
      setDepositDelta((s) => ({ ...s, [id]: "" }));
      await load();
      toast.success("Deposit diperbarui");
    } catch (e: any) {
      toast.error(e.message || "Gagal update deposit");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Data Pelanggan</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <Input
            className="flex-1 min-w-[200px]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama/telepon/email"
          />
          <div className="flex gap-2 w-full sm:w-auto">
            <Button className="flex-1 sm:flex-none" onClick={load} disabled={loading}>
              {loading ? "Memuat..." : "Cari"}
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={openCreate}>Tambah</Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="overflow-x-auto -mx-2 md:mx-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 px-2">Nama</th>
                  <th className="py-2 px-2">Telepon</th>
                  <th className="py-2 px-2">Email</th>
                  <th className="py-2 px-2">Poin</th>
                  <th className="py-2 px-2">Deposit</th>
                  <th className="py-2 px-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-stone-50">
                    <td className="py-2 px-2 font-medium">{c.name}</td>
                    <td className="py-2 px-2">{c.phone || "-"}</td>
                    <td className="py-2 px-2">{c.email || "-"}</td>
                    <td className="py-2 px-2">{c.points}</td>
                    <td className="py-2 px-2">Rp{new Intl.NumberFormat('id-ID').format(Number(c.deposit || 0))}</td>
                    <td className="py-2 px-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                          Edit
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="destructive" onClick={() => remove(c.id)}>
                            Hapus
                          </Button>
                        )}
                        <div className="flex items-center gap-2">
                          <Input
                            className="w-20"
                            type="number"
                            value={pointsDelta[c.id] || ""}
                            onChange={(e) =>
                              setPointsDelta((s) => ({ ...s, [c.id]: e.target.value }))
                            }
                            placeholder="± poin"
                          />
                          <Button size="sm" onClick={() => adjustPoints(c.id)}>
                            Update
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            className="w-28"
                            type="number"
                            value={depositDelta[c.id] || ""}
                            onChange={(e) =>
                              setDepositDelta((s) => ({ ...s, [c.id]: e.target.value }))
                            }
                            placeholder="± deposit"
                          />
                          <Button size="sm" onClick={() => adjustDeposit(c.id)}>
                            Deposit
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && !loading && (
                  <tr>
                    <td className="py-4 px-2 text-center text-stone-500" colSpan={6}>
                      Tidak ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Pelanggan" : "Tambah Pelanggan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Nama</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Nama pelanggan"
              />
            </div>
            <div>
              <label className="text-sm">Telepon</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <div>
              <label className="text-sm">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                placeholder="email@contoh.com"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button onClick={save}>{editId ? "Simpan" : "Tambah"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
