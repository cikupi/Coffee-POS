"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hydrateAuthFromStorage, useAuth } from "@/store/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, token } = useAuth();

  useEffect(() => {
    hydrateAuthFromStorage();
  }, []);

  useEffect(() => {
    if (!token || !user) router.replace("/login");
  }, [token, user, router]);

  if (!token || !user) return null;
  return <>{children}</>;
}
