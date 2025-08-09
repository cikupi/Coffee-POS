"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("admin@coffee.local");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api<{ token: string; user: any }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAuth(res.token, res.user);
      router.replace("/kasir");
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <Card className="w-full max-w-sm shadow">
        <CardHeader>
          <CardTitle className="text-center">☕ Coffee POS Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-sm">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" required />
            </div>
            <div>
              <label className="text-sm">Password</label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••" required />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <Button disabled={loading} className="w-full" type="submit">
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <div className="text-xs text-stone-500 mt-3">
            Seed users (after DB setup): admin@coffee.local, kasir@coffee.local, barista@coffee.local (password123)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
