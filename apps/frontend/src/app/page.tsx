"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hydrateAuthFromStorage, useAuth } from "@/store/auth";

export default function Home() {
  const router = useRouter();
  const { token } = useAuth();
  useEffect(() => {
    hydrateAuthFromStorage();
  }, []);
  useEffect(() => {
    if (token) router.replace("/dashboard");
    else router.replace("/login");
  }, [token, router]);
  return null;
}
