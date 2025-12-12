'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Lock, User, LogIn } from 'lucide-react'

export default function LoginClient() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()

  // Ambil query redirect jika ada (misal ditendang dari dashboard)
  useEffect(() => {
    const redirected = searchParams.get('redirectedFrom')
    if (redirected) {
      setRedirectTo(redirected)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (!email.trim() || !password)
        throw new Error('Email dan password wajib diisi.')

      // 1. Login ke Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) throw signInError
      if (!data?.session) throw new Error('Login gagal. Coba cek email/password.')

      console.log('[DEBUG] Login sukses, menyimpan session...')

      // 2. Refresh Router (WAJIB ADA!)
      // Ini memberitahu Middleware di server bahwa ada cookie baru
      router.refresh()
      
      // 3. Beri jeda sedikit agar cookie benar-benar tertulis di browser
      await new Promise(resolve => setTimeout(resolve, 1000))

      const userId = data.user.id

      // 4. Ambil profile untuk cek Role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', userId)
        .single()

      if (profileError) {
        // Jika profile tidak ditemukan, jangan error, anggap pegawai biasa dulu
        console.warn('[DEBUG] Profile tidak ditemukan, lanjut sebagai user biasa.')
      }

      // 5. Tentukan Admin atau Bukan
      const isAdmin =
        profile?.is_admin === true || 
        profile?.role === 'kasubbag' || 
        profile?.role === 'kepala_kantor' ||
        profile?.role === 'admin'

      // 6. Redirect sesuai Role
      if (isAdmin) {
        router.replace('/dashboardadmin')
      } else {
        if (redirectTo) {
          router.replace(redirectTo)
        } else {
          router.replace('/dashboard')
        }
      }

    } catch (err: any) {
      console.error('[DEBUG] Login error:', err)
      setError(err.message === 'Invalid login credentials' 
        ? 'Email atau password salah.' 
        : err.message || 'Terjadi kesalahan saat login.')
      setLoading(false)
    }
    // Jika sukses, biarkan loading true agar user tidak klik tombol lagi
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Masukkan email terlebih dahulu untuk reset password.')
      return
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`, 
      })
      if (error) throw error
      setMessage('Link reset password telah dikirim ke email kamu.')
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim link reset password.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mb-4">
            <Lock className="h-8 w-8 text-blue-700" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Logbook & Absensi
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Silakan masuk untuk memulai aktivitas
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}
        
        {message && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md">
            <p className="text-sm text-green-700 font-medium">{message}</p>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4 rounded-md shadow-sm">
            {/* Email Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                placeholder="Email Pegawai"
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Lupa password?
            </button>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative flex w-full justify-center rounded-lg border border-transparent py-3 px-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 
                ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'}`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center">
                  <LogIn className="mr-2 h-5 w-5" />
                  Masuk Aplikasi
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}