'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [redirectTo, setRedirectTo] = useState('/dashboard')

  const router = useRouter()
  const searchParams = useSearchParams()

  // Hindari error di server render
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const redirected = searchParams.get('redirectedFrom')
      if (redirected) setRedirectTo(redirected)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (!email.trim() || !password) throw new Error('Email dan password wajib diisi.')

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) throw signInError
      if (!data?.session) throw new Error('Pastikan email sudah terverifikasi.')

      // Simpan session
      if (typeof window !== 'undefined') {
        localStorage.setItem('supabaseSession', JSON.stringify(data.session))
      }

      const userId = data.user.id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, position, role, is_admin')
        .eq('id', userId)
        .single()

      if (profileError) throw profileError

      // Simpan profile ke localStorage agar bisa diakses di dashboard
      if (typeof window !== 'undefined') {
        localStorage.setItem('userProfile', JSON.stringify(profile))
      }

      // Arahkan sesuai role
      if (profile.is_admin) {
        router.push('/dashboardadmin')
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Terjadi kesalahan saat login.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setError(null)
    setMessage(null)
    if (!email.trim()) {
      setError('Masukkan email terlebih dahulu untuk reset password.')
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://logbook-absen.vercel.app'}/reset-password`,
      })
      if (error) throw error
      setMessage('Link reset password telah dikirim ke email kamu.')
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim link reset password.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      {/* Header */}
      <div className="w-full bg-[#003366] px-8 pt-12 pb-24 text-white">
        <h1 className="text-center text-3xl font-bold">Sign In to Your Account</h1>
        <p className="mt-2 text-center text-sm text-blue-100">
          Enter your email and password to log in
        </p>
      </div>

      {/* Form */}
      <div className="-mt-16 w-full max-w-md self-center">
        <div className="space-y-8 rounded-lg bg-white p-8 shadow-lg">
          <form className="space-y-6" onSubmit={handleLogin}>
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="block w-full rounded-lg border-gray-300 py-3 px-3 shadow-sm focus:border-[#4A90E2] focus:ring-[#4A90E2] sm:text-sm"
                placeholder="Masukkan Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="block w-full rounded-lg border-gray-300 py-3 px-3 shadow-sm focus:border-[#4A90E2] focus:ring-[#4A90E2] sm:text-sm"
                placeholder="Masukkan Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="text-right mt-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-medium text-[#4A90E2] hover:text-[#003366]"
                >
                  Lupa password?
                </button>
              </div>
            </div>

            {/* Error / Message */}
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            {message && <p className="text-sm text-green-600 text-center">{message}</p>}

            {/* Tombol login */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-full border border-transparent bg-[#003366] py-3 px-4 text-sm font-medium text-white shadow-sm hover:bg-[#004080] focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {loading ? 'Memproses...' : 'Login'}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-gray-600">
            Belum punya akun?{' '}
            <Link href="/register" className="font-medium text-[#4A90E2] hover:text-[#003366]">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
