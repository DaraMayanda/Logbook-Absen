'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Memuat...');
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    const processToken = async () => {
      const hash = window.location.hash;
      if (!hash.includes('access_token')) {
        setStatus('Link reset password tidak valid atau sudah kedaluwarsa.');
        return;
      }

      const params = new URLSearchParams(hash.replace('#', ''));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token') || '';

      if (!access_token) {
        setStatus('Token tidak ditemukan.');
        return;
      }

      // ✅ Tunggu session benar-benar diset
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        setStatus('Token tidak valid atau sudah kedaluwarsa.');
      } else {
        setStatus('Silakan masukkan kata sandi baru.');
        setTokenReady(true);
      }
    };

    processToken();
  }, [supabase]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return setStatus('Masukkan password baru.');

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus('Gagal memperbarui kata sandi: ' + error.message);
    } else {
      setStatus('✅ Kata sandi berhasil diperbarui! Mengarahkan ke halaman login...');
      setTimeout(() => router.push('/login'), 2000);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-6 rounded-2xl shadow-lg w-96">
        <h2 className="text-2xl font-bold text-center mb-4">Reset Password</h2>
        {tokenReady ? (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <input
              type="password"
              placeholder="Password baru"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded-lg"
              required
            />
            <button
              type="submit"
              className="w-full bg-[#003366] text-white py-2 rounded-lg hover:bg-opacity-90"
            >
              Perbarui Password
            </button>
          </form>
        ) : (
          <p className="text-center text-gray-700">{status}</p>
        )}
      </div>
    </div>
  );
}
