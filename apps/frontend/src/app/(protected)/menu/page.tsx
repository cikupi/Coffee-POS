"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/store/auth";
import { toast } from "sonner";

// Deterministic currency formatter to avoid SSR/CSR mismatch
const currency = new Intl.NumberFormat("id-ID");

type Variant = {
  id: string;
  label: string;
  price: number;
  cost?: number;
  sku?: string | null;
  stock: number;
};

type Product = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  variants: Variant[];
};

export default function MenuPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState<string>("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<{ name: string; category: string; description?: string; imageUrl?: string; isActive: boolean; variants: { label: string; price: number; stock: number }[] }>({
    name: "",
    category: "Coffee",
    description: "",
    imageUrl: "",
    isActive: true,
    variants: [],
  });
  // Category input mode: select existing or add new
  const [categoryMode, setCategoryMode] = useState<"SELECT" | "NEW">("SELECT");
  const [newCategory, setNewCategory] = useState<string>("");
  const [vOpen, setVOpen] = useState(false);
  const [vEditing, setVEditing] = useState<Variant | null>(null);
  const [vForm, setVForm] = useState<{ label: string; price: number; cost?: number; stock: number }>({ label: "", price: 0, cost: 0, stock: 0 });
  const [vProductId, setVProductId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const q = selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : "";
      const res = await api<{ products: Product[] }>(`/api/products${q}`);
      setItems(res.products);
      const cat = await api<{ categories: string[] }>("/api/products/categories");
      setCategories(cat.categories);
    } catch (e: any) {
      setError(e.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedCategory]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const inName = p.name.toLowerCase().includes(q);
      const inCategory = p.category?.toLowerCase().includes(q);
      const inVariants = (p.variants || []).some(v => v.label.toLowerCase().includes(q));
      return inName || inCategory || inVariants;
    });
  }, [items, search]);

  function onAdd() {
    setEditing(null);
    setForm({ name: "", category: categories[0] || "Coffee", description: "", imageUrl: "", isActive: true, variants: [] });
    setCategoryMode("SELECT");
    setNewCategory("");
    setOpen(true);
  }
  function onEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, category: p.category, description: p.description || "", imageUrl: p.imageUrl || "", isActive: p.isActive, variants: [] });
    if (categories.includes(p.category)) {
      setCategoryMode("SELECT");
      setNewCategory("");
    } else {
      setCategoryMode("NEW");
      setNewCategory(p.category);
    }
    setOpen(true);
  }

  async function onDelete(p: Product) {
    if (!confirm(`Hapus produk ${p.name}?`)) return;
    await api(`/api/products/${p.id}`, { method: "DELETE" });
    await load();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const finalCategory = categoryMode === "NEW" ? newCategory.trim() : form.category;
      if (!finalCategory) { toast.error("Kategori wajib diisi"); return; }
      const payloadBase = {
        name: form.name.trim(),
        category: finalCategory,
        description: form.description?.trim() ? form.description.trim() : undefined,
        imageUrl: form.imageUrl?.trim() ? form.imageUrl.trim() : undefined,
        isActive: form.isActive,
      } as any;
      if (editing) {
        await api(`/api/products/${editing.id}`, { method: "PUT", body: JSON.stringify(payloadBase) });
      } else {
        const payload = { ...payloadBase } as any;
        if (form.variants && form.variants.length > 0) payload.variants = form.variants;
        await api(`/api/products`, { method: "POST", body: JSON.stringify(payload) });
      }
      setOpen(false);
      await load();
      toast.success("Produk tersimpan");
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan produk");
    }
  }

  function addVariant(productId: string) {
    setVProductId(productId);
    setVEditing(null);
    setVForm({ label: "", price: 0, stock: 0 });
    setVOpen(true);
  }

  function editVariant(v: Variant, productId: string) {
    setVProductId(productId);
    setVEditing(v);
    setVForm({ label: v.label, price: Number((v as any).price), cost: Number((v as any).cost ?? 0), stock: v.stock });
    setVOpen(true);
  }

  async function deleteVariant(v: Variant) {
    if (!confirm(`Hapus varian ${v.label}?`)) return;
    await api(`/api/products/variants/${v.id}`, { method: "DELETE" });
    await load();
  }

  async function adjustStock(v: Variant) {
    const mode = prompt("Ketik 'set' untuk set nilai, atau masukkan angka delta (contoh: 10 atau -5)", "set");
    if (mode === null) return;
    if (mode.trim().toLowerCase() === "set") {
      const set = Number(prompt("Set stok menjadi", String(v.stock)) || String(v.stock));
      await api(`/api/products/variants/${v.id}/stock`, { method: "PATCH", body: JSON.stringify({ set }) });
    } else {
      const delta = Number(mode);
      if (Number.isNaN(delta)) return toast.error("Input tidak valid");
      await api(`/api/products/variants/${v.id}/stock`, { method: "PATCH", body: JSON.stringify({ delta }) });
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Menu & Produk</h1>
        {isAdmin && (
          <div className="flex gap-2 w-full sm:w-auto">
            <Button className="w-full sm:w-auto" onClick={onAdd}>Tambah Produk</Button>
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              onClick={async () => {
                try {
                  const res = await api<{ updated: number; totalMissing: number }>("/api/products/variants/assign-sku", { method: "POST" });
                  toast.success(`Kode barang diisi otomatis untuk ${res.updated}/${res.totalMissing} varian`);
                  await load();
                } catch (e: any) {
                  toast.error(e.message || "Gagal mengisi kode barang");
                }
              }}
            >
              Generate Kode Barang
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Cari produk/varian/kategori…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-600 hidden sm:inline">Kategori:</span>
          <Select value={selectedCategory ?? "__ALL__"} onValueChange={(v) => setSelectedCategory(v === "__ALL__" ? undefined : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Semua kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">Semua</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded">{error}</div>}

      <div className="bg-white border rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left px-3 py-2">Nama</th>
              <th className="text-left px-3 py-2">Kategori</th>
              <th className="text-left px-3 py-2">Varian</th>
              <th className="text-right px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-3" colSpan={4}>Memuat...</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td className="px-3 py-3" colSpan={4}>{items.length === 0 ? "Belum ada produk" : "Tidak ada hasil"}</td></tr>
            ) : filteredItems.map((p) => (
              <tr key={p.id} className="border-t align-top">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">{p.category}</td>
                <td className="px-3 py-2">
                  <div className="space-y-2">
                    {p.variants.map((v) => (
                      <div key={v.id} className="flex items-center gap-2">
                        <span className="min-w-[120px]">{v.label}</span>
                        <span suppressHydrationWarning>Rp{currency.format(Number(v.price as any))}</span>
                        {(v as any).cost !== undefined && (<span className="text-xs text-stone-600">HPP: Rp{currency.format(Number((v as any).cost))}</span>)}
                        <span className="text-xs text-stone-600">Stok: {v.stock}</span>
                        {isAdmin && (
                          <div className="ml-auto flex flex-wrap gap-2 justify-end">
                            <Button size="sm" variant="secondary" onClick={() => editVariant(v, p.id)}>Edit</Button>
                            <Button size="sm" variant="outline" onClick={() => adjustStock(v)}>Stok</Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteVariant(v)}>Hapus</Button>
                          </div>
                        )}
                      </div>
                    ))}
                    {isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => addVariant(p.id)}>Tambah Varian</Button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {isAdmin && (
                    <div className="flex justify-end flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => onEdit(p)}>Edit</Button>
                      <Button variant="destructive" onClick={() => onDelete(p)}>Hapus</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-sm">Nama</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Kategori</label>
              {categoryMode === "SELECT" ? (
                <div className="flex items-center gap-2">
                  <Select
                    value={form.category}
                    onValueChange={(v) => {
                      if (v === "__NEW__") {
                        setCategoryMode("NEW");
                        setNewCategory("");
                        // keep current category value as is
                        return;
                      }
                      setForm((f) => ({ ...f, category: v }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                      <SelectItem value="__NEW__">+ Tambah kategori baru…</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={() => { setCategoryMode("NEW"); setNewCategory(""); }}>Baru</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input placeholder="Nama kategori baru" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} required />
                  <Button type="button" variant="secondary" onClick={() => { const pick = categories[0] || "Coffee"; setCategoryMode("SELECT"); setForm((f) => ({ ...f, category: pick })); }}>Pilih</Button>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm">Deskripsi</label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm">Gambar URL</label>
              <Input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Variant Form Dialog */}
      <Dialog open={vOpen} onOpenChange={setVOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{vEditing ? "Edit Varian" : "Tambah Varian"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const body = {
                  label: String(vForm.label || '').trim(),
                  price: Number.isFinite(Number(vForm.price)) ? Number(vForm.price) : 0,
                  cost: Number.isFinite(Number(vForm.cost)) ? Number(vForm.cost) : 0,
                  stock: Number.isFinite(Number(vForm.stock)) ? Number(vForm.stock) : 0,
                };
                if (vEditing) {
                  await api(`/api/products/variants/${vEditing.id}`, { method: "PUT", body: JSON.stringify(body) });
                } else if (vProductId) {
                  await api(`/api/products/${vProductId}/variants`, { method: "POST", body: JSON.stringify(body) });
                }
                setVOpen(false);
                await load();
              } catch (e: any) {
                toast.error(e.message || "Gagal menyimpan varian");
              }
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-sm">Label</label>
              <Input value={vForm.label} onChange={(e) => setVForm((f) => ({ ...f, label: e.target.value }))} required />
            </div>
            <div>
              <label className="text-sm">Harga</label>
              <Input type="number" value={vForm.price} onChange={(e) => setVForm((f) => ({ ...f, price: Number(e.target.value) }))} required />
            </div>
            <div>
              <label className="text-sm">Biaya (HPP)</label>
              <Input type="number" value={vForm.cost ?? 0} onChange={(e) => setVForm((f) => ({ ...f, cost: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-sm">Stok</label>
              <Input type="number" value={vForm.stock} onChange={(e) => setVForm((f) => ({ ...f, stock: Number(e.target.value) }))} required />
            </div>
            {/* SKU dihilangkan dari UI; kode barang dibuat otomatis di backend */}
            <DialogFooter>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
