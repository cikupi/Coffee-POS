"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const currency = new Intl.NumberFormat("id-ID");

type Variant = { id: string; label: string; product: { id: string; name: string } };
type OrderItem = { id: string; qty: number; price: number; discount?: number; variant: Variant };

type Order = {
  id: string;
  code: string;
  status: string;
  dineType: string;
  discount: number;
  subtotal: number;
  total: number;
  paid: number;
  paymentType: string;
  note?: string | null;
  createdAt: string;
  customer?: { id: string; name: string } | null;
  cashier?: { id: string; name: string } | null;
  items: OrderItem[];
};

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

export default function RiwayatPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | "">("");
  const [from, setFrom] = useState<string>(formatDate(new Date()));
  const [to, setTo] = useState<string>(formatDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editNote, setEditNote] = useState("");
  const [confirmRefundOpen, setConfirmRefundOpen] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      params.set("from", startOfDay(new Date(from)).toISOString());
      params.set("to", endOfDay(new Date(to)).toISOString());
      const res = await api<{ orders: Order[] }>(`/api/orders?${params.toString()}`);
      setOrders(res.orders || []);
    } catch (e: any) {
      setError(e.message || "Gagal memuat riwayat");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const shown = useMemo(() => orders.slice(0, 100), [orders]);

  function openDetail(o: Order) {
    setSelected(o);
    setDetailOpen(true);
  }

  function reprint() {
    if (!selected) return;
    setTimeout(() => window.print(), 200);
  }

  function openEdit(o: Order) {
    setSelected(o);
    setEditNote(o.note || "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!selected) return;
    try {
      await api(`/api/orders/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ note: editNote }),
      });
      toast.success('Catatan transaksi diperbarui');
      setEditOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Gagal memperbarui');
    }
  }

  function openRefund(o: Order) {
    setSelected(o);
    setConfirmRefundOpen(true);
  }

  async function doRefund() {
    if (!selected) return;
    try {
      await api(`/api/orders/${selected.id}/refund`, { method: 'POST' });
      toast.success('Transaksi berhasil diretur');
      setConfirmRefundOpen(false);
      setDetailOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Gagal retur');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Riwayat Transaksi</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Input placeholder="Cari kode transaksi…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-64" />
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-sm">s/d</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v === "__ALL__" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Semua status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">Semua Status</SelectItem>
              <SelectItem value="COMPLETED">Selesai</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CANCELLED">Batal</SelectItem>
              <SelectItem value="REFUNDED">Retur</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={load} disabled={loading}>Terapkan</Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded">{error}</div>}

      <div className="bg-white border rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left px-3 py-2">Waktu</th>
              <th className="text-left px-3 py-2">Kode</th>
              <th className="text-left px-3 py-2">Pelanggan</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Metode</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-right px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-3" colSpan={6}>Memuat…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td className="px-3 py-3" colSpan={6}>Tidak ada transaksi</td></tr>
            ) : shown.map((o) => (
              <tr key={o.id} className="border-t align-top">
                <td className="px-3 py-2">{new Date(o.createdAt).toLocaleString("id-ID")}</td>
                <td className="px-3 py-2">{o.code}</td>
                <td className="px-3 py-2">{o.customer?.name || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs border ${o.status === 'REFUNDED' ? 'bg-red-50 text-red-700 border-red-200' : o.status === 'CANCELLED' ? 'bg-stone-100 text-stone-700 border-stone-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{o.status}</span>
                </td>
                <td className="px-3 py-2">{o.paymentType}</td>
                <td className="px-3 py-2 text-right">Rp{currency.format(Number(o.total))}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openDetail(o)}>Detail</Button>
                    <Button size="sm" onClick={() => { setSelected(o); setDetailOpen(true); }}>Reprint</Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(o)} disabled={o.status === 'REFUNDED' || o.status === 'CANCELLED'}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => openRefund(o)} disabled={o.status === 'REFUNDED'}>Retur</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Transaksi</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 print:block">
              <div className="flex justify-between text-sm">
                <div>
                  <div className="font-semibold">{selected.code}</div>
                  <div>{new Date(selected.createdAt).toLocaleString("id-ID")}</div>
                </div>
                <div className="text-right text-sm">
                  <div>Pelanggan: {selected.customer?.name || '-'}</div>
                  <div>Kasir: {selected.cashier?.name || '-'}</div>
                </div>
              </div>
              {selected.note ? (
                <div className="text-sm"><span className="font-medium">Catatan:</span> <span className="whitespace-pre-line">{selected.note}</span></div>
              ) : null}
              <div className="border-t my-2" />
              <div className="space-y-1 text-sm">
                {selected.items.map((it) => (
                  <div key={it.id} className="flex justify-between">
                    <div>{it.variant.product.name} - {it.variant.label} x{it.qty}</div>
                    <div>Rp{currency.format(Number(it.price) * it.qty - Number(it.discount || 0))}</div>
                  </div>
                ))}
              </div>
              <div className="border-t my-2" />
              <div className="flex justify-between"><span>Subtotal</span><span>Rp{currency.format(Number(selected.subtotal))}</span></div>
              <div className="flex justify-between"><span>Diskon</span><span>Rp{currency.format(Number(selected.discount))}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>Rp{currency.format(Number(selected.total))}</span></div>
              <div className="flex justify-between"><span>Bayar</span><span>Rp{currency.format(Number(selected.paid))}</span></div>
              <div className="flex justify-between"><span>Metode</span><span>{selected.paymentType}</span></div>
              <div className="pt-3 flex justify-end gap-2 no-print">
                <Button variant="outline" onClick={() => setDetailOpen(false)}>Tutup</Button>
                <Button onClick={reprint}>Print</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaksi</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-stone-600">Ubah catatan transaksi</div>
            <textarea className="w-full border rounded p-2 h-28" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button onClick={saveEdit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Refund */}
      <Dialog open={confirmRefundOpen} onOpenChange={setConfirmRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Retur</DialogTitle>
          </DialogHeader>
          <div className="text-sm">Yakin ingin meretur transaksi ini? Stok akan dikembalikan dan status menjadi REFUNDED.</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRefundOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={doRefund}>Ya, Retur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
