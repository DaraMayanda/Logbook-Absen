'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import React from 'react' // Ensure React is imported for type consistency

const InputIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
    {children}
  </div>
)

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [position, setPosition] = useState('PPNPN')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      // --- VALIDASI CLIENT SIDE ---
      if (!fullName.trim() || !email.trim() || !password || !position.trim()) {
        throw new Error('Semua field harus diisi.')
      }

      if (password.length < 6) {
        throw new Error('Password minimal 6 karakter.')
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        throw new Error('Format email tidak valid.')
      }

      // 1️⃣ Register ke Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'pegawai',
            position
          },
          // URL ini adalah URL yang akan dibuka setelah pengguna mengklik link di email.
          emailRedirectTo: `${window.location.origin}/login` 
        }
      })
      
      // Jika Supabase mengembalikan error (misalnya, email sudah ada atau password lemah)
      if (signUpError) {
        throw signUpError
      }

      // 2️⃣ Tampilkan pesan sukses dan reset form
      // Pengecekan `data.user` dapat memastikan proses berhasil.
      if (data.user || data.session === null) { 
        setSuccess('✅ Registrasi berhasil! Cek email Anda untuk verifikasi dan login.')
        setFullName('')
        setEmail('')
        setPassword('')
        setPosition('PPNPN')
      } else {
         // Case fallback, misal email sudah terdaftar tapi bukan error
         setSuccess('Registrasi berhasil. Silakan cek email Anda untuk verifikasi. Akun mungkin sudah terdaftar.')
      }

      // CATATAN PENTING: Pembuatan profil di tabel 'profiles' ditangani oleh Database Trigger.

    } catch (err: any) {
      // Penanganan Error yang lebih robust
      console.error('Error register:', JSON.stringify(err, null, 2))
      setError(
        err.message || 
        'Terjadi kesalahan saat registrasi. Pastikan email belum terdaftar dan password minimal 6 karakter.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      {/* Header */}
      <div className="w-full bg-[#003366] px-8 pt-12 pb-24 text-white">
        <h1 className="text-center text-3xl font-bold">Create Your Account</h1>
        <p className="mt-2 text-center text-sm text-blue-100">
          Isi data diri Anda untuk melanjutkan
        </p>
      </div>

      {/* Form */}
      <div className="-mt-16 w-full max-w-md self-center">
        <div className="space-y-8 rounded-lg bg-white p-8 shadow-lg">
          {/* FIX: suppressHydrationWarning ditambahkan di sini untuk mengabaikan atribut yang disuntikkan ekstensi browser */}
          <form 
            className="space-y-6" 
            onSubmit={handleRegister} 
            suppressHydrationWarning={true}
          >
            {/* Nama Lengkap */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Nama Lengkap
              </label>
              <div className="relative mt-1">
                <InputIcon>
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </InputIcon>
                <input
                  id="fullName"
                  type="text"
                  required
                  className="block w-full rounded-lg border-gray-300 py-3 pl-10 pr-3 shadow-sm focus:border-[#4A90E2] focus:ring-[#4A90E2] sm:text-sm"
                  placeholder="Masukkan Nama Lengkap"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="relative mt-1">
                <InputIcon>
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </InputIcon>
                <input
                  id="email"
                  type="email"
                  required
                  className="block w-full rounded-lg border-gray-300 py-3 pl-10 pr-3 shadow-sm focus:border-[#4A90E2] focus:ring-[#4A90E2] sm:text-sm"
                  placeholder="Masukkan Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative mt-1">
                <InputIcon>
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                      clipRule="evenodd"
                    />
                  </svg>
                </InputIcon>
                <input
                  id="password"
                  type="password"
                  required
                  className="block w-full rounded-lg border-gray-300 py-3 pl-10 pr-3 shadow-sm focus:border-[#4A90E2] focus:ring-[#4A90E2] sm:text-sm"
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Jenis Pengguna */}
            <div>
              <label htmlFor="position" className="block text-sm font-medium text-gray-700">
                Jenis Pengguna
              </label>
              <select
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="mt-1 block w-full rounded-lg border-gray-300 py-3 pl-3 pr-3 shadow-sm focus:border-[#4A90E2] focus:ring-[#4A90E2] sm:text-sm"
              >
                <option value="PPNPN">PPNPN</option>
                <option value="Supir">Supir</option>
                <option value="Satpam">Satpam</option>
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-full border border-transparent bg-[#003366] py-3 px-4 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {loading ? 'Memproses...' : 'Register'}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-gray-600">
            Sudah punya akun?{' '}
            <Link href="/login" className="font-medium text-[#4A90E2] hover:text-[#003366]">
              Login di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
