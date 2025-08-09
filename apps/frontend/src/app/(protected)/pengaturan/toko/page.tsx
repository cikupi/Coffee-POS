"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";
import { toast } from "sonner";

export default function StoreSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api<{ settings: Record<string, any> }>("/api/settings");
      setValues(res.settings || {});
    } finally {
      setLoading(false);
    }
  };

  const exportBackup = async () => {
    try {
      // read token from localStorage using the same key as api() helper
      const token = typeof window !== 'undefined' ? localStorage.getItem('pos_token') : null;
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'}/api/settings/backup`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(text || 'Gagal export backup');
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error((e as any)?.message || 'Export gagal');
    }
  };

  const importBackup = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await api("/api/settings/restore", {
        method: "POST",
        body: JSON.stringify(json),
      });
      await load();
      toast.success('Import sukses');
    } catch (e) {
      console.error(e);
      toast.error('Import gagal');
    } finally {
      setImporting(false);
    }
  };

  const save = async () => {
    setLoading(true);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          storeName: values.storeName || "",
          logoUrl: values.logoUrl || "",
          storeAddress: values.storeAddress || "",
          receiptNotes: values.receiptNotes || "",
          taxRate: Number(values.taxRate || 0),
          serviceCharge: Number(values.serviceCharge || 0),
          touchKeyboardEnabled: Boolean(values.touchKeyboardEnabled),
        }),
      });
      toast.success("Pengaturan disimpan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Pengaturan Toko</h1>
      <Card>
        <CardHeader>
          <CardTitle>Branding & Pajak</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-w-xl">
          <div>
            <label className="text-sm">Nama Toko</label>
            <Input
              value={values.storeName || ""}
              onChange={(e) => setValues((s) => ({ ...s, storeName: e.target.value }))}
              placeholder="Nama usaha"
            />
          </div>
          <div>
            <label className="text-sm">Logo URL</label>
            <Input
              value={values.logoUrl || ""}
              onChange={(e) => setValues((s) => ({ ...s, logoUrl: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-sm">Alamat Toko</label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm"
              rows={3}
              value={values.storeAddress || ""}
              onChange={(e) => setValues((s) => ({ ...s, storeAddress: e.target.value }))}
              placeholder="Jl. Contoh No. 123, Kota"
            />
          </div>
          <div>
            <label className="text-sm">Catatan Struk (Footer)</label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm"
              rows={2}
              value={values.receiptNotes || ""}
              onChange={(e) => setValues((s) => ({ ...s, receiptNotes: e.target.value }))}
              placeholder="Terimakasih atas pembeliannya"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Pajak (%)</label>
              <Input
                type="number"
                value={values.taxRate ?? ""}
                onChange={(e) => setValues((s) => ({ ...s, taxRate: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm">Service Charge (%)</label>
              <Input
                type="number"
                value={values.serviceCharge ?? ""}
                onChange={(e) => setValues((s) => ({ ...s, serviceCharge: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              id="touchKeyboardEnabled"
              type="checkbox"
              checked={Boolean(values.touchKeyboardEnabled)}
              onChange={(e) => setValues((s) => ({ ...s, touchKeyboardEnabled: e.target.checked }))}
            />
            <label htmlFor="touchKeyboardEnabled" className="text-sm">
              Aktifkan On-Screen Keyboard di Kasir (perangkat sentuh)
            </label>
          </div>
          <div className="flex justify-between pt-2">
            {user?.role === 'ADMIN' ? (
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={exportBackup}>Export Backup</Button>
                <label className="inline-flex items-center gap-2">
                  <span className="text-sm">Import</span>
                  <Input type="file" accept="application/json" disabled={importing} onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importBackup(f);
                    e.currentTarget.value = '';
                  }} />
                </label>
              </div>
            ) : <div />}
            <Button onClick={save} disabled={loading}>{loading ? "Menyimpan..." : "Simpan"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
