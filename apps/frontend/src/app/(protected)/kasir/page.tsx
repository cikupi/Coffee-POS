"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { VirtualNumpad } from "@/components/virtual-numpad";
import { VirtualKeyboard } from "@/components/virtual-keyboard";

// Shared types
type Variant = { id: string; label: string; price: number; stock: number; sku?: string | null; product: { id: string; name: string; category: string; imageUrl?: string | null } };

type Product = { id: string; name: string; category: string; imageUrl?: string | null; variants: Omit<Variant, "product">[] };

type Customer = { id: string; name: string; phone?: string | null; deposit?: number };

type CartItem = { variant: Variant; qty: number; discount: number };

const currency = new Intl.NumberFormat("id-ID");
const rp = (n: number) => currency.format(Math.round(Number(n || 0)));

export default function CashierPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shift, setShift] = useState<any | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<"CASH" | "QRIS" | "CARD" | "DEPOSIT">("CASH");
  const [paid, setPaid] = useState<number>(0);
  const [dineType, setDineType] = useState<"DINE_IN" | "TAKEAWAY">("TAKEAWAY");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  // Inline add-customer dialog state
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [settings, setSettings] = useState<Record<string, any>>({});

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [openShiftOpen, setOpenShiftOpen] = useState(false);
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [closingCash, setClosingCash] = useState<number>(0);
  // Order note (catatan pembeli)
  const [orderNote, setOrderNote] = useState<string>("");

  // Virtual Numpad state
  const [numpadOpen, setNumpadOpen] = useState(false);
  const [numpadVal, setNumpadVal] = useState<number>(0);
  const [numpadAllowDecimal, setNumpadAllowDecimal] = useState(false);
  const [numpadSetter, setNumpadSetter] = useState<((n: number) => void) | null>(null);
  const [touchMode, setTouchMode] = useState(false);
  // Virtual text keyboard
  const [vkOpen, setVkOpen] = useState(false);
  const [vkVal, setVkVal] = useState("");
  const [vkSetter, setVkSetter] = useState<((s: string) => void) | null>(null);

  function openNumpad(initial: number, setter: (n: number) => void, allowDecimal = false) {
    setNumpadVal(initial || 0);
    setNumpadSetter(() => setter);
    setNumpadAllowDecimal(allowDecimal);
    setNumpadOpen(true);
  }

  async function createCustomer() {
    try {
      const name = newCustomerName.trim();
      const phone = newCustomerPhone.trim();
      if (!name) { toast.error("Nama pelanggan wajib diisi"); return; }
      const res = await api<{ customer: Customer }>("/api/customers", {
        method: "POST",
        body: JSON.stringify({ name, ...(phone ? { phone } : {}) }),
      });
      // Refresh list and select the new customer
      const cs = await api<{ customers: Customer[] }>("/api/customers");
      setCustomers(cs.customers);
      setCustomerId(res.customer.id);
      setAddCustomerOpen(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      toast.success("Pelanggan ditambahkan");
    } catch (e: any) {
      toast.error(e.message || "Gagal menambah pelanggan");
    }
  }

  function openKeyboard(initial: string, setter: (s: string) => void) {
    setVkVal(initial || "");
    setVkSetter(() => setter);
    setVkOpen(true);
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const touch = ('ontouchstart' in window) || (navigator as any)?.maxTouchPoints > 0;
      setTouchMode(!!touch);
    }
  }, []);

  const touchKeyboard = useMemo(() => touchMode && Boolean((settings as any)?.touchKeyboardEnabled), [touchMode, settings]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const q = selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : "";
      const res = await api<{ products: Product[] }>(`/api/products${q}`);
      setProducts(res.products);
      const cat = await api<{ categories: string[] }>("/api/products/categories");
      setCategories(cat.categories);
      const s = await api<{ shift: any }>("/api/shifts/current");
      setShift(s.shift || null);
      // fetch recent customers (simple list)
      const cs = await api<{ customers: Customer[] }>("/api/customers");
      setCustomers(cs.customers);
      // fetch settings for receipt header/footer
      const st = await api<{ settings: Record<string, any> }>("/api/settings");
      setSettings(st.settings || {});
    } catch (e: any) {
      setError(e.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedCategory]);

  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return products;
    return products
      .map((p) => ({
        ...p,
        variants: p.variants.filter((v) =>
          p.name.toLowerCase().includes(q) || v.label.toLowerCase().includes(q)
        ),
      }))
      .filter((p) => p.variants.length > 0);
  }, [products, searchTerm]);

  // Sort products by saved order from settings
  const orderKey = useMemo(() => selectedCategory || "__ALL__", [selectedCategory]);
  const orderedProducts = useMemo(() => {
    const prod = filteredProducts;
    const map = (settings as any)?.productOrder || {};
    const order: string[] | undefined = map[orderKey];
    if (!order || order.length === 0) return prod;
    const orderIndex = new Map(order.map((id, i) => [id, i] as const));
    return [...prod].sort((a, b) => {
      const ai = orderIndex.has(a.id) ? (orderIndex.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.has(b.id) ? (orderIndex.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name);
    });
  }, [filteredProducts, settings, orderKey]);

  // DnD handlers for reordering products (disabled during search)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  function onDragStartProduct(index: number) {
    if (searchTerm) return; // disable when searching
    setDragIndex(index);
  }
  function onDragOverProduct(e: React.DragEvent) {
    if (searchTerm) return;
    e.preventDefault();
  }
  async function onDropProduct(overIndex: number) {
    if (searchTerm) return;
    if (dragIndex === null || dragIndex === overIndex) { setDragIndex(null); return; }
    const list = [...orderedProducts];
    const [moved] = list.splice(dragIndex, 1);
    list.splice(overIndex, 0, moved);
    setDragIndex(null);
    // Build new order for this key, append the rest of ids from this category not shown currently
    const newIdsVisible = list.map(p => p.id);
    const allInCategory = products
      .filter(p => !selectedCategory || p.category === selectedCategory)
      .map(p => p.id);
    const rest = allInCategory.filter(id => !newIdsVisible.includes(id));
    const newOrder = [...newIdsVisible, ...rest];
    try {
      const existing = (settings as any)?.productOrder || {};
      const body = { productOrder: { ...existing, [orderKey]: newOrder } } as any;
      await api("/api/settings", { method: "PUT", body: JSON.stringify(body) });
      // optimistic local update
      setSettings((s) => ({ ...(s || {}), productOrder: body.productOrder }));
      toast.success("Urutan menu disimpan");
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan urutan");
    }
  }

  function addVariant(p: Product, v: Product["variants"][number]) {
    if (v.stock <= 0) return;
    const full: Variant = { ...v, product: { id: p.id, name: p.name, category: p.category, imageUrl: p.imageUrl } } as any;
    setCart((c) => {
      const idx = c.findIndex((i) => i.variant.id === v.id);
      if (idx >= 0) {
        const copy = [...c];
        const nextQty = copy[idx].qty + 1;
        copy[idx] = { ...copy[idx], qty: Math.min(nextQty, v.stock) };
        return copy;
      }
      return [...c, { variant: full, qty: 1, discount: 0 }];
    });
  }

  function updateQty(variantId: string, qty: number) {
    setCart((c) => c.map((i) => (i.variant.id === variantId ? { ...i, qty: Math.max(1, Math.min(qty, i.variant.stock)) } : i)));
  }
  function removeItem(variantId: string) {
    setCart((c) => c.filter((i) => i.variant.id !== variantId));
  }

  const subtotal = useMemo(() => cart.reduce((sum, i) => sum + Number(i.variant.price) * i.qty - (i.discount || 0), 0), [cart]);
  const total = Math.max(0, subtotal - (orderDiscount || 0));
  const change = Math.max(0, (Number.isFinite(paid) ? paid : 0) - total);

  const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);
  const customerDeposit = Number(selectedCustomer?.deposit || 0);
  const depositInsufficient = paymentType === 'DEPOSIT' && total > customerDeposit;

  useEffect(() => {
    // Auto set paid when using DEPOSIT
    if (paymentType === 'DEPOSIT') {
      setPaid(total);
    }
  }, [paymentType, total]);

  async function checkout() {
    if (!shift) { toast.error("Tidak ada shift aktif. Silakan buka shift terlebih dahulu."); return; }
    if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
    if (paymentType !== 'DEPOSIT' && paid < total) { toast.error("Bayar kurang dari total"); return; }
    if (paymentType === 'DEPOSIT') {
      if (!customerId) { toast.error("Pelanggan wajib dipilih untuk pembayaran deposit"); return; }
      // Allow proceeding even if deposit is insufficient (will result in negative balance)
      if (depositInsufficient) { toast("Saldo deposit tidak mencukupi, transaksi tetap diproses dan deposit menjadi minus"); }
    }
    try {
      const body: any = {
        dineType,
        discount: orderDiscount,
        paymentType,
        paid,
        items: cart.map((i) => ({ variantId: i.variant.id, qty: i.qty, discount: i.discount })),
      };
      if (customerId) body.customerId = customerId;
      if (orderNote && orderNote.trim()) body.note = orderNote.trim();
      const res = await api<{ order: any }>("/api/orders", { method: "POST", body: JSON.stringify(body) });
      setLastOrder(res.order);
      setReceiptOpen(true);
      // reset cart
      setCart([]);
      setOrderDiscount(0);
      setPaid(0);
      setOrderNote("");
      // reload stock
      await load();
      // trigger print after open
      setTimeout(() => window.print(), 200);
    } catch (e: any) {
      toast.error(e.message || "Gagal membuat order");
    }
  }

  async function openShift() {
    try {
      await api(`/api/shifts/open`, { method: "POST", body: JSON.stringify({ openingCash, notes: "" }) });
      setOpenShiftOpen(false);
      setOpeningCash(0);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Gagal membuka shift");
    }
  }

  async function closeShift() {
    try {
      await api(`/api/shifts/close`, { method: "POST", body: JSON.stringify({ closingCash, notes: "" }) });
      setCloseShiftOpen(false);
      setClosingCash(0);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Gagal menutup shift");
    }
  }

  function renderReceipt(order: any) {
    const items = order.items as any[];
    const storeName = (settings.storeName as string) || "";
    const logoUrl = (settings.logoUrl as string) || "";
    const address = (settings.storeAddress as string) || "";
    const footer = (settings.receiptNotes as string) || "Terimakasih atas pembeliannya";
    return (
      <div className="p-4 text-sm">
        <div className="text-center space-y-1">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName || 'Logo'} className="mx-auto h-10 object-contain" />
          ) : null}
          {storeName ? <h2 className="font-semibold">{storeName}</h2> : null}
          {address ? <div className="text-xs text-stone-600 whitespace-pre-line">{address}</div> : null}
        </div>
        <div className="flex justify-between"><span>Kode</span><span>{order.code}</span></div>
        <div className="flex justify-between mb-2"><span>Tanggal</span><span>{new Date(order.createdAt).toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Point of Sales</span><span>{order.cashier?.name || '-'}</span></div>
        <div className="flex justify-between mb-2"><span>Pelanggan</span><span>{order.customer?.name || '-'}</span></div>
        <div className="border-t my-2" />
        <div className="space-y-1">
          {items.map((it) => (
            <div key={it.id} className="flex justify-between">
              <div>{it.variant.product.name} - {it.variant.label} x{it.qty}</div>
              <div>Rp{rp(Number(it.price) * it.qty - Number(it.discount || 0))}</div>
            </div>
          ))}
        </div>
        <div className="border-t my-2" />
        {order.note ? (
          <div className="mb-2"><span className="font-medium">Catatan:</span> <span className="whitespace-pre-line">{order.note}</span></div>
        ) : null}
        <div className="border-t my-2" />
        <div className="flex justify-between"><span>Subtotal</span><span>Rp{rp(Number(order.subtotal))}</span></div>
        <div className="flex justify-between"><span>Diskon</span><span>Rp{rp(Number(order.discount))}</span></div>
        <div className="flex justify-between font-semibold"><span>Total</span><span>Rp{rp(Number(order.total))}</span></div>
        <div className="flex justify-between"><span>Bayar</span><span>Rp{rp(Number(order.paid))}</span></div>
        <div className="flex justify-between"><span>Kembalian</span><span>Rp{rp(Math.max(0, Number(order.paid) - Number(order.total)))}</span></div>
        <div className="flex justify-between"><span>Metode</span><span>{order.paymentType}</span></div>
        {order.paymentType === 'DEPOSIT' && order.customer?.id ? (
          <div className="flex justify-between">
            <span>Sisa Deposit</span>
            <span>
              Rp{rp(Number(customers.find(c => c.id === order.customer?.id)?.deposit || 0))}
            </span>
          </div>
        ) : null}
        <p className="text-center mt-3 whitespace-pre-line">{footer}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Items</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {shift ? (
            <>
              <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">Shift aktif</span>
              <Button className="flex-1 sm:flex-none" variant="outline" onClick={() => setCloseShiftOpen(true)}>Tutup Shift</Button>
            </>
          ) : (
            <Button className="flex-1 sm:flex-none" onClick={() => setOpenShiftOpen(true)}>Buka Shift</Button>
          )}
          <Select value={dineType} onValueChange={(v) => setDineType(v as any)}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Dine Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TAKEAWAY">Takeaway</SelectItem>
              <SelectItem value="DINE_IN">Dine In</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentType} onValueChange={(v) => setPaymentType(v as any)}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Metode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="QRIS">QRIS</SelectItem>
              <SelectItem value="CARD">Kartu</SelectItem>
              <SelectItem value="DEPOSIT">Deposit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white border rounded p-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xl font-semibold">{selectedCategory || 'Semua Produk'}</h2>
            <div className="flex items-center gap-2 w-full">
              <div className="relative flex-1">
                <Input
                  placeholder="Cari produk/varian"
                  className="pl-10 w-full"
                  value={searchTerm}
                  readOnly={touchMode}
                  onFocus={() => { if (touchMode) openKeyboard(searchTerm, setSearchTerm); }}
                  onTouchStart={() => { if (touchMode) openKeyboard(searchTerm, setSearchTerm); }}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden>🔍</span>
              </div>
              {/* link to Pengaturan → Menu & Produk */}
              <Button
                variant="outline"
                className="shrink-0"
                aria-label="Menu & Produk"
                title="Menu & Produk"
                onClick={() => router.push('/pengaturan/menu')}
              >
                ⚙️
              </Button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setSelectedCategory(undefined)}
              className={`px-3 py-1 rounded-full text-sm border ${!selectedCategory ? 'bg-black text-white' : 'bg-stone-100 text-stone-800 hover:bg-stone-200'}`}
            >Semua</button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-3 py-1 rounded-full text-sm border ${selectedCategory === c ? 'bg-black text-white' : 'bg-stone-100 text-stone-800 hover:bg-stone-200'}`}
              >{c}</button>
            ))}
          </div>
          {loading ? (
            <div>Memuat...</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {orderedProducts.map((p, idx) => (
                <div
                  key={p.id}
                  className="relative border rounded-xl overflow-hidden bg-white shadow-sm"
                  draggable={!searchTerm}
                  onDragStart={() => onDragStartProduct(idx)}
                  onDragOver={onDragOverProduct}
                  onDrop={() => onDropProduct(idx)}
                  title={searchTerm ? "Reorder dinonaktifkan saat pencarian aktif" : "Klik & tarik untuk mengurutkan"}
                >
                  <div className="relative">
                    <div className="aspect-[4/3] bg-stone-100 overflow-hidden">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-stone-400">No Image</div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="font-medium truncate" title={p.name}>{p.name}</div>
                      <div className="mt-2 space-y-2">
                        {p.variants.map((v) => (
                          <div key={v.id} className="flex items-center justify-between text-sm">
                            <span className="truncate mr-2">{v.label}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold">Rp{rp(Number(v.price))}</span>
                              <button
                                className="h-8 w-8 rounded-full bg-black text-white grid place-items-center disabled:opacity-50"
                                onClick={() => addVariant(p, v)}
                                disabled={v.stock <= 0}
                                aria-label={`Tambah ${p.name} ${v.label}`}
                              >+
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl p-3 space-y-3 shadow-sm">
          <h2 className="text-xl font-semibold">Current Order</h2>
          {cart.length === 0 ? (
            <div className="text-sm text-stone-600">Belum ada item</div>
          ) : (
            <div className="space-y-2">
              {cart.map((i) => (
                <div key={i.variant.id} className="flex items-center gap-3 border rounded-lg p-2">
                  <div className="h-12 w-12 rounded bg-stone-100 overflow-hidden shrink-0">
                    {i.variant.product.imageUrl ? (
                      <img src={i.variant.product.imageUrl} alt={i.variant.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-stone-400 text-xs">IMG</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{i.variant.product.name}</div>
                    <div className="text-sm text-stone-600 truncate">{i.variant.label}</div>
                    <div className="text-sm font-semibold">Rp{rp(Number(i.variant.price))}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="h-7 w-7 rounded-full border grid place-items-center" onClick={() => updateQty(i.variant.id, Math.max(1, i.qty - 1))} aria-label="Kurangi">-</button>
                    <div className="w-6 text-center">{i.qty}</div>
                    <button className="h-7 w-7 rounded-full border grid place-items-center" onClick={() => updateQty(i.variant.id, i.qty + 1)} aria-label="Tambah">+</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm">Pelanggan</label>
              <Select value={customerId} onValueChange={(v) => setCustomerId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih pelanggan (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setAddCustomerOpen(true)}>Tambah</Button>
              {customerId && (
                <Button variant="outline" size="sm" onClick={() => setCustomerId("")}>Kosongkan</Button>
              )}
            </div>
            {selectedCustomer && paymentType === 'DEPOSIT' ? (
              <div className="text-xs text-stone-600 -mt-2">Deposit pelanggan: Rp{rp(customerDeposit)}</div>
            ) : null}
            <div>
              <label className="text-sm">Catatan Pembeli</label>
              <textarea
                className="w-full border rounded px-2 py-1 text-sm min-h-[60px]"
                placeholder="Contoh: kurang manis, tanpa es, dll (opsional)"
                value={orderNote}
                readOnly={touchKeyboard}
                onFocus={() => { if (touchKeyboard) openKeyboard(orderNote, setOrderNote); }}
                onTouchStart={() => { if (touchKeyboard) openKeyboard(orderNote, setOrderNote); }}
                onChange={(e) => setOrderNote(e.target.value)}
              />
            </div>
            <div className="rounded-lg bg-stone-50 p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>Rp{rp(subtotal)}</span></div>
              <div className="flex justify-between"><span>Diskon</span><span>Rp{rp(orderDiscount)}</span></div>
              <div className="flex justify-between"><span>Metode</span><span>{paymentType}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">Diskon</label>
              <Input
                type="number"
                className="w-28"
                value={orderDiscount}
                readOnly={touchKeyboard}
                onFocus={() => { if (touchKeyboard) openNumpad(orderDiscount, setOrderDiscount); }}
                onTouchStart={() => { if (touchKeyboard) openNumpad(orderDiscount, setOrderDiscount); }}
                onChange={(e) => setOrderDiscount(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>Rp{rp(total)}</span></div>
            <div className="flex items-center gap-2">
              <label className="text-sm">Bayar</label>
              <Input
                type="number"
                min={0}
                className="w-32"
                value={paid}
                readOnly={touchKeyboard}
                onFocus={() => { if (touchKeyboard && paymentType !== 'DEPOSIT') openNumpad(paid, (n) => setPaid(n), false); }}
                onTouchStart={() => { if (touchKeyboard && paymentType !== 'DEPOSIT') openNumpad(paid, (n) => setPaid(n), false); }}
                onChange={(e) => setPaid(Number(e.target.value || 0))}
                disabled={paymentType === 'DEPOSIT'}
              />
            </div>
            <div className="flex justify-between text-sm"><span>Kembalian</span><span>Rp{rp(paymentType === 'DEPOSIT' ? 0 : change)}</span></div>
            <div className="text-xs text-amber-700">{paymentType === 'DEPOSIT' ? (depositInsufficient ? 'Saldo deposit tidak cukup' : 'Pembayaran menggunakan deposit') : ''}</div>
            <Button className="w-full h-12 text-base bg-violet-600 hover:bg-violet-700" onClick={checkout} disabled={!shift || cart.length === 0 || !Number.isFinite(paid) || (paymentType !== 'DEPOSIT' && paid < total) || (paymentType === 'DEPOSIT' && !customerId)}>Lanjutkan</Button>
          </div>
        </div>
      </div>

      {/* Open Shift */}
      <Dialog open={openShiftOpen} onOpenChange={setOpenShiftOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buka Shift</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Uang Buka (kas awal)</label>
              <Input
                type="number"
                value={openingCash}
                readOnly={touchKeyboard}
                onFocus={() => { if (touchKeyboard) openNumpad(openingCash, setOpeningCash); }}
                onTouchStart={() => { if (touchKeyboard) openNumpad(openingCash, setOpeningCash); }}
                onChange={(e) => setOpeningCash(Number(e.target.value))}
              />
            </div>
            <DialogFooter>
              <Button onClick={openShift}>Buka</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Customer */}
      <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Pelanggan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Nama</label>
              <Input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Contoh: Budi"
              />
            </div>
            <div>
              <label className="text-sm">No. HP (opsional)</label>
              <Input
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCustomerOpen(false)}>Batal</Button>
            <Button onClick={createCustomer}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Virtual Numpad for touch devices */}
      <VirtualNumpad
        open={numpadOpen}
        value={numpadVal}
        onChange={(n) => {
          setNumpadVal(n);
          if (numpadSetter) numpadSetter(n);
        }}
        onClose={() => setNumpadOpen(false)}
        allowDecimal={numpadAllowDecimal}
      />

      {/* Virtual Keyboard for text on touch devices */}
      <VirtualKeyboard
        open={vkOpen}
        value={vkVal}
        onChange={(s) => {
          setVkVal(s);
          if (vkSetter) vkSetter(s);
        }}
        onClose={() => setVkOpen(false)}
      />

      {/* Close Shift */}
      <Dialog open={closeShiftOpen} onOpenChange={setCloseShiftOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tutup Shift</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Uang Tutup (kas akhir)</label>
              <Input
                type="number"
                value={closingCash}
                readOnly={touchKeyboard}
                onFocus={() => { if (touchKeyboard) openNumpad(closingCash, setClosingCash); }}
                onTouchStart={() => { if (touchKeyboard) openNumpad(closingCash, setClosingCash); }}
                onChange={(e) => setClosingCash(Number(e.target.value))}
              />
            </div>
            <DialogFooter>
              <Button variant="destructive" onClick={closeShift}>Tutup Shift</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Struk Pembayaran</DialogTitle>
          </DialogHeader>
          {lastOrder && renderReceipt(lastOrder)}
          <DialogFooter>
            {lastOrder && (
              <a
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
                href={`https://wa.me/?text=${encodeURIComponent(`Terima kasih! Pesanan ${lastOrder.code} total Rp${currency.format(Number(lastOrder.total))}`)}`}
              >
                Share via WhatsApp
              </a>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
