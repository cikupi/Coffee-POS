"use client";
import AuthGuard from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "sonner";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>
        {children}
        <Toaster richColors position="top-right" />
      </AppShell>
    </AuthGuard>
  );
}
