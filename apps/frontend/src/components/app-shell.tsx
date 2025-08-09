"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, LayoutDashboard, ShoppingCart, Settings, ChevronLeft, ChevronRight, LogOut, History } from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";

type NavItem = { href: string; label: string; adminOnly?: boolean };

function getNavItems(role?: string): NavItem[] {
  const base: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", adminOnly: true },
    { href: "/kasir", label: "Kasir" },
    { href: "/riwayat", label: "Riwayat" },
    { href: "/pengaturan", label: "Pengaturan" },
  ];
  if (role === 'ADMIN') return base;
  return base.filter((i) => !i.adminOnly);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, clear } = useAuth();
  const items = useMemo(() => getNavItems(user?.role), [user?.role]);
  const title = useMemo(() => items.find((n) => pathname?.startsWith(n.href))?.label ?? "Dashboard", [pathname, items]);
  const [collapsed, setCollapsed] = useState(false);

  // Persist sidebar mode on desktop
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = window.localStorage.getItem('sidebar_collapsed');
    if (v === '1') setCollapsed(true);
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('sidebar_collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  function NavIcon({ href }: { href: string }) {
    if (href.startsWith('/dashboard')) return <LayoutDashboard className="h-5 w-5" />;
    if (href.startsWith('/kasir')) return <ShoppingCart className="h-5 w-5" />;
    if (href.startsWith('/riwayat')) return <History className="h-5 w-5" />;
    if (href.startsWith('/pengaturan')) return <Settings className="h-5 w-5" />;
    return <Menu className="h-5 w-5" />;
  }

  const Sidebar = (
    <aside className={`hidden md:flex md:fixed md:inset-y-0 md:left-0 ${collapsed ? 'md:w-16' : 'md:w-64'} h-screen flex-col bg-stone-900 text-stone-100 overflow-y-auto`}
    >
      <div className="h-16 flex items-center justify-between px-3 border-b border-stone-800">
        <div className={`flex items-center gap-2 ${collapsed ? 'justify-center w-full' : ''}`}>
          <span className={`text-lg font-semibold ${collapsed ? 'hidden' : 'inline'}`}>☕ Coffee POS</span>
          {collapsed && <span className="text-lg">☕</span>}
        </div>
        <Button variant="ghost" size="icon" className={`hidden md:inline-flex ${collapsed ? '' : ''}`} onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>
      <nav className="p-2 space-y-1">
        {items.map((n: NavItem) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-3 px-3 py-2 rounded hover:bg-stone-800 ${pathname?.startsWith(n.href) ? "bg-stone-800" : ""}`}
          >
            <NavIcon href={n.href} />
            <span className={`${collapsed ? 'hidden' : 'inline'}`}>{n.label}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-auto p-3 border-t border-stone-800 text-sm">
        <div className={`mb-2 ${collapsed ? 'hidden' : 'block'}`}>{user ? `${user.name} · ${user.role}` : "Guest"}</div>
        <Button
          variant="secondary"
          className={`w-full ${collapsed ? 'justify-center px-2' : ''}`}
          onClick={clear}
          aria-label="Logout"
          title="Logout"
        >
          {collapsed ? <LogOut className="h-4 w-4" /> : 'Logout'}
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      {Sidebar}
      <div className={`flex min-h-screen flex-col ${collapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <header className="h-16 flex items-center justify-between px-4 border-b bg-white">
          <div className="flex items-center gap-2">
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64">
                  {Sidebar}
                </SheetContent>
              </Sheet>
            </div>
            <div className="font-semibold">{title}</div>
          </div>
          <div className="hidden md:flex">
            <Button variant="outline" size="sm" onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? 'Perlebar Sidebar' : 'Perkecil Sidebar'}
            </Button>
          </div>
        </header>
        <main className="p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
