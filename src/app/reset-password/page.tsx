'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [userReady, setUserReady] = useState(false)

  // Cek apakah user aktif (login sementara dari link email)
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!user || error) setError('Link reset password tidak valid atau kadaluarsa.')
      else setUserReady(true)
    }
    checkUser()
  }, [])

  // Validasi password kuat
  const validatePassword = (pwd: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/
    return regex.test(pwd)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userReady) return

    if (!validatePassword(password)) {
      setError('Password harus minimal 8 karakter, berisi huruf besar, huruf kecil, angka, dan simbol.')
      return
    }

    if (password !== confirmPassword) {
      setError('Password dan konfirmasi password tidak cocok.')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setMessage('Password berhasil diperbarui! Mengalihkan ke login...')
      setTimeout(() => router.replace('/login'), 2000)
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 font-sans">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-blue-100 p-3 rounded-full mb-3">
            <Lock className="text-[#003366] w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-[#003366]">Reset Password</h2>
          <p className="text-gray-500 text-sm mt-1">
            Masukkan password baru untuk akun Anda
          </p>
        </div>

        {message && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm text-center font-medium">{message}</div>}
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm text-center font-medium">{error}</div>}

        <form onSubmit={handleReset} className="space-y-5">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password Baru"
              className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={!userReady || loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Konfirmasi Password"
              className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={!userReady || loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
            >
              {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={!userReady || loading}
            className="w-full bg-[#003366] text-white py-3 rounded-lg font-bold hover:bg-blue-800 transition disabled:bg-gray-400 shadow-md hover:shadow-lg transform active:scale-95 duration-200"
          >
            {loading ? 'Menyimpan...' : 'Perbarui Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
