'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'

type LeaveRequest = {
  id: number
  leave_type: string
  start_date: string
  end_date: string
  reason: string
  status: string
  created_at: string
}

export default function PengajuanCutiPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [leaveType, setLeaveType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [leaveBalance, setLeaveBalance] = useState<number | null>(12) // default
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])

  // 🔹 Mount check
  useEffect(() => setMounted(true), [])

  // 🔹 Ambil user dan sisa cuti
  useEffect(() => {
    if (!mounted) return

    const fetchUserAndProfile = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      const { data, error } = await supabase
        .from('profiles')
        .select('annual_leave_balance')
        .eq('id', user.id)
        .single()

      if (!error && data?.annual_leave_balance !== undefined) {
        setLeaveBalance(data.annual_leave_balance)
      }
    }

    fetchUserAndProfile()
  }, [mounted, router])

  // 🔹 Fetch riwayat cuti user + polling realtime sederhana
  const fetchLeaveRequests = async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error && data) setLeaveRequests(data as LeaveRequest[])
  }

  useEffect(() => {
    fetchLeaveRequests()
    const interval = setInterval(fetchLeaveRequests, 10000) // polling tiap 10 detik
    return () => clearInterval(interval)
  }, [userId])

  // 🔹 Submit pengajuan cuti
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leaveType || !startDate || !endDate || !reason) {
      toast.error('Semua field wajib diisi')
      return
    }
    if (!userId) return toast.error('User belum terdeteksi')

    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1

    if (leaveType === 'Cuti Tahunan' && leaveBalance !== null && diffDays > leaveBalance) {
      toast.error('Sisa cuti tahunan tidak mencukupi')
      return
    }

    setLoading(true)
    const { error: insertError } = await supabase.from('leave_requests').insert({
      user_id: userId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason,
      status: 'Menunggu Persetujuan'
    })

    if (insertError) {
      toast.error(`Gagal mengajukan cuti: ${insertError.message}`)
      setLoading(false)
      return
    }

    toast.success('Pengajuan cuti berhasil dikirim!')
    setLeaveType('')
    setStartDate('')
    setEndDate('')
    setReason('')
    fetchLeaveRequests()
    setLoading(false)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-white">
      <Toaster position="top-center" reverseOrder={false} />

      {/* Header */}
      <div className="bg-[#1E3A8A] text-white text-xl font-bold p-4 rounded-b-lg flex items-center">
        <button onClick={() => router.back()} className="mr-2 text-lg">←</button>
        Pengajuan Cuti
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
            <option value="Cuti Karena Alasan Penting">Cuti Karena Alasan Penting</option>
            <option value="Cuti Melahirkan">Cuti Melahirkan</option>
            <option value="Cuti di Luar Tanggungan Negara">Cuti di Luar Tanggungan Negara</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Tanggal Mulai</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border rounded-lg p-2 mt-1 bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Tanggal Selesai</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border rounded-lg p-2 mt-1 bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Keterangan</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border rounded-lg p-2 mt-1 bg-gray-50"
            placeholder="Tuliskan alasan pengajuan cuti..."
          />
        </div>

        {leaveBalance !== null && (
          <div className="border border-green-400 bg-green-50 text-green-800 font-semibold rounded-lg p-3">
            Sisa Cuti Tahunan <br />
            <span className="text-xl font-bold">{leaveBalance} hari</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1E3A8A] text-white font-bold py-3 rounded-xl shadow-md hover:bg-[#1A3475] transition"
        >
          {loading ? 'Mengirim...' : 'Ajukan Cuti'}
        </button>
      </form>

      {/* Riwayat Pengajuan */}
      <div className="p-4 mt-6">
        <h2 className="font-bold mb-2 text-gray-800">Riwayat Pengajuan Cuti</h2>
        {leaveRequests.length === 0 ? (
          <p className="text-gray-500">Belum ada pengajuan cuti</p>
        ) : (
          <ul className="space-y-3">
            {leaveRequests.map((lr) => (
              <li key={lr.id} className="p-3 border rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-semibold">{lr.leave_type}</p>
                  <p className="text-sm text-gray-500">{lr.start_date} s/d {lr.end_date}</p>
                </div>
                <span className={`font-bold px-3 py-1 rounded-full text-sm ${
                  lr.status === 'Disetujui' ? 'bg-green-200 text-green-800' :
                  lr.status === 'Ditolak' ? 'bg-red-200 text-red-800' :
                  'bg-yellow-200 text-yellow-800'
                }`}>
                  {lr.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
