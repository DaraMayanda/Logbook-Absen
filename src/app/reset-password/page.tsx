'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

export default function ResetPasswordPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Memuat...');

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes('access_token')) {
      setStatus('Link reset password tidak valid atau sudah kadaluarsa.');
      return;
    }

    const params = new URLSearchParams(hash.replace('#', ''));
    const access_token = params.get('access_token');

    if (access_token) {
      supabase.auth.setSession({
        access_token,
        refresh_token: params.get('refresh_token') || '',
      });
      setStatus('Silakan masukkan kata sandi baru.');
    }
  }, [supabase]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus('Gagal memperbarui kata sandi: ' + error.message);
    } else {
      setStatus('✅ Kata sandi berhasil diperbarui! Mengarahkan ke halaman login...');
      setTimeout(() => router.push('/login'), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 relative overflow-hidden">
      {/* Elemen dekorasi */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-300 rounded-full blur-3xl opacity-20 animate-pulse"></div>

      <div className="relative bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl w-96 border border-blue-100">
        <div className="flex flex-col items-center">
          <div className="bg-blue-600 p-3 rounded-full mb-4">
            <Lock className="text-white w-6 h-6" />
          </div>
          <h2 className="text-2xl font-semibold text-blue-800 mb-2">Reset Password</h2>
          <p className="text-gray-600 text-center mb-4 text-sm">
            {status.includes('Silakan')
              ? 'Masukkan password baru untuk akun Anda'
              : status}
          </p>
        </div>

        {status.includes('Silakan') && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <input
              type="password"
              placeholder="Password baru"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-700 text-white py-2 rounded-lg hover:bg-blue-800 transition-all duration-200"
            >
              Perbarui Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
