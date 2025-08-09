"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ProfilePage() {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [cpass, setCpass] = useState("");
  const [npass, setNpass] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api<{ user: { name: string; email: string; phone?: string } }>("/api/users/profile/me");
        setName(res.user.name);
        setEmail(res.user.email);
        setPhone(res.user.phone || "");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/users/profile/me", { method: "PUT", body: JSON.stringify({ name, phone }) });
      toast.success("Profil tersimpan");
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan profil");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!cpass || !npass) return;
    setLoading(true);
    try {
      await api("/api/users/profile/change-password", { method: "PATCH", body: JSON.stringify({ currentPassword: cpass, newPassword: npass }) });
      setCpass("");
      setNpass("");
      toast.success("Password diubah");
    } catch (e: any) {
      toast.error(e.message || "Gagal mengubah password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold">Profil Saya</h1>
        <p className="text-sm text-stone-600">Kelola informasi profil akun.</p>
      </div>

      <form onSubmit={saveProfile} className="space-y-3 bg-white p-4 border rounded">
        <div>
          <label className="text-sm">Nama</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm">Email</label>
          <Input value={email} disabled />
        </div>
        <div>
          <label className="text-sm">Telepon</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading}>Simpan Profil</Button>
      </form>

      <form onSubmit={changePassword} className="space-y-3 bg-white p-4 border rounded">
        <div className="font-semibold">Ubah Password</div>
        <div>
          <label className="text-sm">Password Saat Ini</label>
          <Input type="password" value={cpass} onChange={(e) => setCpass(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm">Password Baru</label>
          <Input type="password" value={npass} onChange={(e) => setNpass(e.target.value)} required />
        </div>
        <Button type="submit" disabled={loading}>Ubah Password</Button>
      </form>
    </div>
  );
}
