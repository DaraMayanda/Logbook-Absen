'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'

export default function PengajuanCutiPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [leaveType, setLeaveType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [leaveBalance, setLeaveBalance] = useState<number | null>(12) // default
  const [loading, setLoading] = useState(false)

  // 🔹 Pastikan hanya render di client
  useEffect(() => {
    setMounted(true)
  }, [])

  // 🔹 Ambil sisa cuti dari Supabase (profiles)
  useEffect(() => {
    if (!mounted) return

    const fetchProfile = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError || !user) {
          router.push('/login')
          return
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('annual_leave_balance')
          .eq('id', user.id)
          .single()

        if (!error && data?.annual_leave_balance !== undefined) {
          setLeaveBalance(data.annual_leave_balance)
        }
      } catch (err) {
        console.error('Fetch profile error:', err)
      }
    }

    fetchProfile()
  }, [mounted, router])

  // 🔹 Handle submit pengajuan cuti
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!leaveType || !startDate || !endDate || !reason) {
      toast.error('Semua field wajib diisi')
      return
    }

    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Anda belum login')
      setLoading(false)
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffDays =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1

    // 🔹 Validasi jika sisa cuti tahunan tidak mencukupi
    if (
      leaveType === 'Cuti Tahunan' &&
      leaveBalance !== null &&
      diffDays > leaveBalance
    ) {
      toast.error('Sisa cuti tahunan tidak mencukupi')
      setLoading(false)
      return
    }

    // 🔹 Insert pengajuan cuti ke tabel leave_requests
    const { error: insertError } = await supabase.from('leave_requests').insert({
      user_id: user.id,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason: reason,
      status: 'Menunggu Persetujuan', // belum disetujui
    })

    if (insertError) {
      toast.error(
        `Gagal mengajukan cuti: ${insertError.message || 'Kesalahan tidak diketahui'}`
      )
      setLoading(false)
      return
    }

    toast.success('Pengajuan cuti berhasil dikirim!')

    // 🔹 Reset form
    setLeaveType('')
    setStartDate('')
    setEndDate('')
    setReason('')
    setLoading(false)

    // 🔹 Kembali ke dashboard setelah delay
    setTimeout(() => router.push('/dashboard'), 1200)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-white">
      <Toaster position="top-center" reverseOrder={false} />

      {/* Header */}
      <div className="bg-[#1E3A8A] text-white text-xl font-bold p-4 rounded-b-lg flex items-center">
        <button onClick={() => router.back()} className="mr-2 text-lg">
          ←
        </button>
        Pengajuan Cuti
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Jenis Cuti */}
        <div>
          <label className="block text-sm font-medium">Jenis Cuti</label>
          <select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
            className="w-full border rounded-lg p-2 mt-1 bg-gray-50"
          >
            <option value="">Pilih Jenis Cuti</option>
            <option value="Cuti Tahunan">Cuti Tahunan</option>
            <option value="Cuti Sakit">Cuti Sakit</option>
            <option value="Cuti Karena Alasan Penting">
              Cuti Karena Alasan Penting
            </option>
            <option value="Cuti Melahirkan">Cuti Melahirkan</option>
            <option value="Cuti di Luar Tanggungan Negara">
              Cuti di Luar Tanggungan Negara
            </option>
          </select>
        </div>

        {/* Tanggal Mulai */}
        <div>
          <label className="block text-sm font-medium">Tanggal Mulai</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border rounded-lg p-2 mt-1 bg-gray-50"
          />
        </div>

        {/* Tanggal Selesai */}
        <div>
          <label className="block text-sm font-medium">Tanggal Selesai</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border rounded-lg p-2 mt-1 bg-gray-50"
          />
        </div>

        {/* Keterangan */}
        <div>
          <label className="block text-sm font-medium">Keterangan</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border rounded-lg p-2 mt-1 bg-gray-50"
            placeholder="Tuliskan alasan pengajuan cuti..."
          />
        </div>

        {/* Sisa Cuti */}
        {leaveBalance !== null && (
          <div className="border border-green-400 bg-green-50 text-green-800 font-semibold rounded-lg p-3">
            Sisa Cuti Tahunan <br />
            <span className="text-xl font-bold">{leaveBalance} hari</span>
          </div>
        )}

        {/* Tombol Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1E3A8A] text-white font-bold py-3 rounded-xl shadow-md hover:bg-[#1A3475] transition"
        >
          {loading ? 'Mengirim...' : 'Ajukan Cuti'}
        </button>

        <p className="text-xs text-blue-800 bg-blue-50 p-3 rounded-lg">
          <b>Catatan:</b> Pengajuan cuti akan dikirim ke atasan untuk persetujuan.
          Sisa cuti akan berkurang setelah pengajuan disetujui.
        </p>
      </form>
    </div>
  )
}
