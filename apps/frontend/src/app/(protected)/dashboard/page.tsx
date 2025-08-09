"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Sales = {
  count: number;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  avgTicket: number;
};

type Bestseller = { variantId: string; name: string; variant: string; qty: number; revenue: number };

export default function DashboardPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sales, setSales] = useState<Sales | null>(null);
  const [bestsellers, setBestsellers] = useState<Bestseller[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const [s, b] = await Promise.all([
        api<Sales>(`/api/reports/sales?${qs.toString()}`),
        api<{ bestsellers: Bestseller[] }>(`/api/reports/bestsellers?${qs.toString()}`),
      ]);
      setSales(s);
      setBestsellers(b.bestsellers);
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

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[160px] sm:flex-none">
          <label className="text-sm">Dari</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[160px] sm:flex-none">
          <label className="text-sm">Sampai</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto" onClick={load} disabled={loading}>
            {loading ? "Memuat..." : "Terapkan"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Transaksi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{sales?.count ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Omzet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">Rp {((sales?.total ?? 0)).toLocaleString("id-ID")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rata-rata Nota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">Rp {((sales?.avgTicket ?? 0)).toLocaleString("id-ID")}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Produk Terlaris</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 md:mx-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 px-2">Produk</th>
                  <th className="py-2 px-2">Varian</th>
                  <th className="py-2 px-2">Qty</th>
                  <th className="py-2 px-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {bestsellers.map((b) => (
                  <tr key={b.variantId} className="border-b">
                    <td className="py-2 px-2">{b.name}</td>
                    <td className="py-2 px-2">{b.variant}</td>
                    <td className="py-2 px-2">{b.qty}</td>
                    <td className="py-2 px-2">Rp {b.revenue.toLocaleString("id-ID")}</td>
                  </tr>
                ))}
                {bestsellers.length === 0 && (
                  <tr>
                    <td className="py-4 px-2 text-center text-stone-500" colSpan={4}>
                      Belum ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
