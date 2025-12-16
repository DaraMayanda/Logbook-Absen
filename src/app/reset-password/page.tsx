'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [userReady, setUserReady] = useState(false)

  // Cek session saat load
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        setError('Link reset password tidak valid atau sudah kadaluarsa.')
      } else {
        setUserReady(true)
      }
    }
    checkUser()
  }, [])

  // Fungsi Validasi Password Kuat
  const validatePassword = (pwd: string) => {
    const minLength = 8
    const hasUpperCase = /[A-Z]/.test(pwd)
    const hasLowerCase = /[a-z]/.test(pwd)
    const hasNumbers = /\d/.test(pwd)
    const hasNonalphas = /[\W_]/.test(pwd) // Simbol

    if (pwd.length < minLength) return "Password minimal 8 karakter."
    if (!hasUpperCase) return "Password harus memiliki huruf besar (A-Z)."
    if (!hasLowerCase) return "Password harus memiliki huruf kecil (a-z)."
    if (!hasNumbers) return "Password harus memiliki angka (0-9)."
    if (!hasNonalphas) return "Password harus memiliki simbol (!@#$%^&*)."
    return null
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userReady) return

    setError(null)
    setMessage(null)

    // 1. Cek Kesamaan Password
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.')
      return
    }

    // 2. Cek Kekuatan Password
    const weakError = validatePassword(password)
    if (weakError) {
      setError(weakError)
      return
    }

    setLoading(true)

    try {
      // 3. Update Password di Supabase
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      // 4. SUKSES & LOGOUT (PENTING AGAR TIDAK LANGSUNG KE DASHBOARD)
      // Kita sign out user agar session lama mati, jadi dia dipaksa login ulang dengan password baru
      await supabase.auth.signOut()

      setMessage('Password berhasil diperbarui! Silakan login kembali dengan password baru.')
      
      // Redirect ke login setelah 2 detik
      setTimeout(() => {
        router.replace('/login')
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'Gagal mengubah password.')
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
          <p className="text-gray-500 text-sm mt-1 text-center">
            Buat password baru yang aman (Minimal 8 karakter, Huruf Besar, Kecil, Angka & Simbol)
          </p>
        </div>

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-4 text-sm flex items-start gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{message}</span>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4 text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-5">
          {/* Input Password Baru */}
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

          {/* Input Konfirmasi Password */}
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Ulangi Password Baru"
              className={`w-full p-3 pr-10 border rounded-lg focus:ring-2 outline-none transition ${
                confirmPassword && password !== confirmPassword 
                  ? 'border-red-500 focus:ring-red-500 bg-red-50' 
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={!userReady || loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Indikator Match Password */}
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-red-600 mt-1">* Password tidak cocok</p>
          )}

          <button
            type="submit"
            disabled={!userReady || loading}
            className="w-full bg-[#003366] text-white py-3 rounded-lg font-bold hover:bg-blue-800 transition disabled:bg-gray-400 shadow-md hover:shadow-lg transform active:scale-95 duration-200 flex justify-center items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Menyimpan...
              </>
            ) : (
              'Simpan Password Baru'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}