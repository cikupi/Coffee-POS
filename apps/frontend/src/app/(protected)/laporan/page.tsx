"use client";
import { useEffect, useMemo, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type SalesSummary = { count: number; subtotal: number; discount: number; total: number; paid: number; avgTicket: number };
type RevenueByDay = Record<string, number>;
type Bestseller = { variantId: string; name: string; variant: string; qty: number; revenue: number };
type ProfitResp = { revenue: number; cost: number; profit: number; margin: number };
type PaymentsResp = { totals: Record<string, number> };
type DepositTotalResp = { total: number };

const currency = new Intl.NumberFormat("id-ID");

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function addDays(d: Date, days: number) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }

export default function LaporanPage() {
  const [rangePreset, setRangePreset] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");
  const [from, setFrom] = useState<string>(formatDate(new Date()));
  const [to, setTo] = useState<string>(formatDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [revenue, setRevenue] = useState<RevenueByDay>({});
  const [bestsellers, setBestsellers] = useState<Bestseller[]>([]);
  const [profit, setProfit] = useState<ProfitResp | null>(null);
  const [payments, setPayments] = useState<Record<string, number>>({});
  const [depositTotal, setDepositTotal] = useState<number | null>(null);
  const cqdTotal = useMemo(() => {
    const p = payments || {};
    return Number(p.CASH || 0) + Number(p.QRIS || 0) + Number(p.DEPOSIT || 0);
  }, [payments]);

  useEffect(() => {
    // preset handler
    const today = new Date();
    if (rangePreset === "DAILY") {
      const f = formatDate(today);
      setFrom(f); setTo(f);
    } else if (rangePreset === "WEEKLY") {
      const dow = today.getDay(); // 0-6, 0:Sunday
      const mondayOffset = (dow + 6) % 7; // days since Monday
      const monday = addDays(today, -mondayOffset);
      const sunday = addDays(monday, 6);
      setFrom(formatDate(monday));
      setTo(formatDate(sunday));
    } else if (rangePreset === "MONTHLY") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFrom(formatDate(first));
      setTo(formatDate(last));
    }
  }, [rangePreset]);

  function prettyPaymentLabel(k: string) {
    const map: Record<string, string> = {
      CASH: "Tunai",
      TRANSFER: "Transfer",
      QRIS: "QRIS",
      DEBIT: "Debit",
      CREDIT: "Kredit",
      EWALLET: "E-Wallet",
      E_WALLET: "E-Wallet",
      DEPOSIT: "Deposit",
      OTHER: "Lainnya",
    };
    return map[k] || k;
  }

  async function load() {
    setLoading(true); setError(null);
    try {
      const params = `?from=${encodeURIComponent(startOfDay(new Date(from)).toISOString())}&to=${encodeURIComponent(endOfDay(new Date(to)).toISOString())}`;
      const [s, r, b, p, pay, dep] = await Promise.all([
        api<SalesSummary>(`/api/reports/sales${params}`),
        api<{ revenue: RevenueByDay }>(`/api/reports/revenue${params}`),
        api<{ bestsellers: Bestseller[] }>(`/api/reports/bestsellers${params}`),
        api<ProfitResp>(`/api/reports/profit${params}`),
        api<PaymentsResp>(`/api/reports/payments${params}`),
        api<DepositTotalResp>(`/api/reports/deposit-total`),
      ]);
      setSummary(s);
      setRevenue(r.revenue || {});
      setBestsellers(b.bestsellers || []);
      setProfit(p);
      setPayments(pay.totals || {});
      setDepositTotal(typeof dep.total === 'number' ? dep.total : 0);
    } catch (e: any) {
      setError(e.message || "Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [from, to]);

  const revPoints = useMemo(() => {
    const entries = Object.entries(revenue).sort((a,b) => a[0] < b[0] ? -1 : 1);
    return entries.map(([date, val]) => ({ date, val }));
  }, [revenue]);

  const totalRevenue = useMemo(() => revPoints.reduce((s, p) => s + p.val, 0), [revPoints]);

  async function downloadCSV() {
    try {
      const params = `?from=${encodeURIComponent(startOfDay(new Date(from)).toISOString())}&to=${encodeURIComponent(endOfDay(new Date(to)).toISOString())}`;
      const url = `${API_BASE}/api/reports/sales/export${params}`;
      const token = typeof window !== 'undefined' ? localStorage.getItem('pos_token') : null;
      if (!token) {
        throw new Error('Tidak ada token. Silakan login ulang.');
      }
      const resp = await fetch(url, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(text || `Gagal mengunduh CSV (${resp.status})`);
      }
      const blob = await resp.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `sales_${from}_to_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(dlUrl);
    } catch (e: any) {
      toast.error(e.message || 'Gagal export CSV');
    }
  }

  function exportPDF() {
    // rely on browser's print to PDF
    toast.info("Gunakan dialog Print untuk menyimpan sebagai PDF");
    setTimeout(() => window.print(), 200);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Laporan Lengkap</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={rangePreset} onValueChange={(v) => setRangePreset(v as any)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Preset" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Harian</SelectItem>
              <SelectItem value="WEEKLY">Mingguan</SelectItem>
              <SelectItem value="MONTHLY">Bulanan</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-sm">s/d</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>
          <Button variant="outline" onClick={downloadCSV}>Export CSV (Excel)</Button>
          <Button onClick={exportPDF}>Export PDF</Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded">{error}</div>}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded p-3">
          <div className="text-xs text-stone-500">Transaksi</div>
          <div className="text-xl font-semibold">{summary ? summary.count : (loading ? "…" : 0)}</div>
        </div>
        <div className="bg-white border rounded p-3">
          <div className="text-xs text-stone-500">Omzet</div>
          <div className="text-xl font-semibold">Rp{currency.format(summary ? summary.total : 0)}</div>
        </div>
        <div className="bg-white border rounded p-3">
          <div className="text-xs text-stone-500">Rata-rata Struk</div>
          <div className="text-xl font-semibold">Rp{currency.format(summary ? summary.avgTicket : 0)}</div>
        </div>
        <div className="bg-white border rounded p-3">
          <div className="text-xs text-stone-500">Diskon</div>
          <div className="text-xl font-semibold">Rp{currency.format(summary ? summary.discount : 0)}</div>
        </div>
      </div>

      {/* Saldo Deposit Terkumpul (saat ini) */}
      <div className="bg-white border rounded p-3">
        <h2 className="font-semibold mb-2">Saldo Deposit Pelanggan</h2>
        <div className="text-xl font-semibold">Rp{currency.format(depositTotal ?? 0)}</div>
      </div>

      {/* Payment Totals */}
      <div className="bg-white border rounded p-3">
        <h2 className="font-semibold mb-2">Total per Jenis Pembayaran</h2>
        {Object.keys(payments).length === 0 ? (
          <div className="text-sm text-stone-600">{loading ? "Menghitung..." : "Tidak ada data"}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(payments)
              .sort((a,b) => b[1] - a[1])
              .map(([k, v]) => (
                <div key={k} className="bg-white border rounded p-3">
                  <div className="text-xs text-stone-500">{prettyPaymentLabel(k)}</div>
                  <div className="text-xl font-semibold">Rp{currency.format(v)}</div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white border rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Grafik Penjualan</h2>
          <div className="text-sm text-stone-600">Total: Rp{currency.format(totalRevenue)}</div>
        </div>
        {revPoints.length === 0 ? (
          <div className="text-sm text-stone-600">Tidak ada data</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg width={Math.max(600, revPoints.length * 48)} height={240} className="bg-stone-50 rounded">
              {(() => {
                const max = Math.max(...revPoints.map(p => p.val), 1);
                const chartH = 180;
                return revPoints.map((p, idx) => {
                  const barW = 28;
                  const gap = 20;
                  const x = 40 + idx * (barW + gap);
                  const h = Math.round((p.val / max) * chartH);
                  const y = 200 - h;
                  return (
                    <g key={p.date}>
                      <rect x={x} y={y} width={barW} height={h} fill="#4f46e5" />
                      <text x={x + barW / 2} y={215} textAnchor="middle" fontSize="10">{p.date.slice(5)}</text>
                      <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="10">{currency.format(p.val)}</text>
                    </g>
                  );
                });
              })()}
              {/* axis line */}
              <line x1={30} y1={200} x2={Math.max(560, revPoints.length * 48)} y2={200} stroke="#999" />
            </svg>
          </div>
        )}
      </div>

      {/* Top Sellers */}
      <div className="bg-white border rounded p-3">
        <h2 className="font-semibold mb-2">Tren Menu Terlaris</h2>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-3 py-2">Produk</th>
                <th className="text-left px-3 py-2">Varian</th>
                <th className="text-right px-3 py-2">Qty</th>
                <th className="text-right px-3 py-2">Omzet</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-3" colSpan={4}>Memuat...</td></tr>
              ) : bestsellers.length === 0 ? (
                <tr><td className="px-3 py-3" colSpan={4}>Tidak ada data</td></tr>
              ) : bestsellers.map((b) => (
                <tr key={b.variantId} className="border-t">
                  <td className="px-3 py-2">{b.name}</td>
                  <td className="px-3 py-2">{b.variant}</td>
                  <td className="px-3 py-2 text-right">{b.qty}</td>
                  <td className="px-3 py-2 text-right">Rp{currency.format(b.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Profit & Margin */}
      <div className="bg-white border rounded p-3">
        <h2 className="font-semibold mb-2">Laporan Keuntungan & Margin</h2>
        {!profit ? (
          <div className="text-sm text-stone-600">{loading ? "Menghitung..." : "Tidak ada data"}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border rounded p-3">
              <div className="text-xs text-stone-500">Revenue (setelah diskon)</div>
              <div className="text-xl font-semibold">Rp{currency.format(profit.revenue)}</div>
            </div>
            <div className="bg-white border rounded p-3">
              <div className="text-xs text-stone-500">Biaya (HPP)</div>
              <div className="text-xl font-semibold">Rp{currency.format(profit.cost)}</div>
            </div>
            <div className="bg-white border rounded p-3">
              <div className="text-xs text-stone-500">Laba</div>
              <div className="text-xl font-semibold">Rp{currency.format(profit.profit)}</div>
            </div>
            <div className="bg-white border rounded p-3">
              <div className="text-xs text-stone-500">Margin</div>
              <div className="text-xl font-semibold">{(profit.margin * 100).toFixed(1)}%</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
