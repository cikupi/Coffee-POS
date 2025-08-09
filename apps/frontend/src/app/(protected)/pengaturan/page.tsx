import Link from "next/link";

type Item = {
  href: string;
  title: string;
  desc: string;
  icon: string; // emoji to avoid extra deps
  accent: string; // tailwind color class
};

const items: Item[] = [
  { href: "/pengaturan/menu", title: "Menu & Produk", desc: "Kelola kategori, produk, varian, dan harga.", icon: "🍽️", accent: "from-rose-100 to-rose-50" },
  { href: "/pengaturan/laporan", title: "Laporan", desc: "Ringkasan penjualan, produk terlaris, dan performa.", icon: "📊", accent: "from-indigo-100 to-indigo-50" },
  { href: "/pengaturan/users", title: "Manajemen User", desc: "Tambah kasir, atur peran & izin akses.", icon: "👥", accent: "from-amber-100 to-amber-50" },
  { href: "/pengaturan/profil", title: "Profil Saya", desc: "Ubah nama, email, kata sandi akun Anda.", icon: "🧑", accent: "from-emerald-100 to-emerald-50" },
  { href: "/pengaturan/pelanggan", title: "Pelanggan", desc: "Kelola pelanggan, deposit, dan poin loyalti.", icon: "🗂️", accent: "from-cyan-100 to-cyan-50" },
  { href: "/pengaturan/toko", title: "Pengaturan Toko", desc: "Nama toko, alamat, struk, pajak, dan preferensi.", icon: "🏬", accent: "from-violet-100 to-violet-50" },
];

export default function SettingsIndexPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pengaturan</h1>
          <p className="text-sm text-stone-600 mt-1">Kelola semua konfigurasi aplikasi POS Anda dari satu tempat.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="group">
            <div className="relative overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md">
              <div className={`absolute inset-0 bg-gradient-to-br ${it.accent} opacity-60`} />
              <div className="relative p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 grid place-items-center rounded-lg bg-white/70 border text-lg">
                    <span aria-hidden>{it.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate group-hover:text-stone-900">{it.title}</h3>
                    <p className="text-sm text-stone-600 line-clamp-2">{it.desc}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-stone-600">Buka</span>
                  <span className="translate-x-0 transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
