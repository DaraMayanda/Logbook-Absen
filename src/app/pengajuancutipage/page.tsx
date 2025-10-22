'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'

type LeaveRequest = {
  id: number
  leave_type: string
  start_date: string
  end_date: string
  reason: string
  status: string
  created_at: string
  half_day: boolean
  half_day_shift: string | null
  annual_leave_cut: boolean
  leave_days: number
}

export default function PengajuanCutiPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [leaveType, setLeaveType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [halfDay, setHalfDay] = useState(false)
  const [halfDayShift, setHalfDayShift] = useState<'pagi' | 'siang' | ''>('')
  const [annualLeaveCut, setAnnualLeaveCut] = useState(true)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [leaveBalance, setLeaveBalance] = useState<number | null>(null)

  useEffect(() => setMounted(true), [])

  // Ambil user dan kuota tahunan
  useEffect(() => {
    if (!mounted) return

    const fetchUserAndQuota = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)
      const currentYear = new Date().getFullYear()

      // Cek apakah sudah ada kuota
      const { data: quotaData, error: quotaError } = await supabase
        .from('master_leave_quota')
        .select('annual_quota, used_leave')
        .eq('user_id', user.id)
        .eq('year', currentYear)
        .single()

      if (quotaError && quotaError.code === 'PGRST116') {
        // Belum ada kuota → buat otomatis
        const { error: insertError } = await supabase
          .from('master_leave_quota')
          .insert({
            user_id: user.id,
            year: currentYear,
            annual_quota: 12,
            used_leave: 0,
          })

        if (insertError) {
          toast.error('Gagal membuat kuota tahunan')
          return
        }

        setLeaveBalance(12)
      } else if (quotaData) {
        setLeaveBalance(quotaData.annual_quota - quotaData.used_leave)
      }
    }

    fetchUserAndQuota()
  }, [mounted, router])

  // Fetch riwayat cuti
  const fetchLeaveRequests = async () => {
    if (!userId) return
    const { data } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (data) setLeaveRequests(data as LeaveRequest[])
  }

  useEffect(() => {
    fetchLeaveRequests()
  }, [userId])

  // Handle submit cuti
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leaveType || !startDate || !endDate || !reason) {
      return toast.error('Semua field wajib diisi')
    }
    if (!userId) return toast.error('User belum terdeteksi')

    // Hitung durasi cuti
    const diffDays = halfDay
      ? 0.5
      : Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)) + 1

    if (leaveType === 'Cuti Tahunan' && leaveBalance !== null && annualLeaveCut && diffDays > leaveBalance) {
      return toast.error('Sisa cuti tahunan tidak mencukupi')
    }

    setLoading(true)
    const { data, error } = await supabase.rpc('submit_leave', {
      p_user_id: userId,
      p_leave_type: leaveType,
      p_start_date: startDate,
      p_end_date: endDate,
      p_reason: reason,
      p_half_day: halfDay,
      p_half_day_shift: halfDayShift || null,
      p_annual_leave_cut: annualLeaveCut,
    })

    if (error) {
      toast.error(`Gagal submit: ${error.message}`)
    } else {
      toast.success(data?.[0]?.message || 'Pengajuan berhasil')
      setLeaveType('')
      setStartDate('')
      setEndDate('')
      setReason('')
      setHalfDay(false)
      setHalfDayShift('')
      fetchLeaveRequests()
    }

    setLoading(false)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-white p-4">
      <Toaster position="top-center" />

      {/* Header dengan panah kembali */}
      <div
        className="flex items-center mb-4 space-x-2 cursor-pointer"
        onClick={() => router.push('/dashboard')}
      >
        <ArrowLeft size={24} />
        <h1 className="text-xl font-bold">Pengajuan Cuti / Izin</h1>
      </div>

      {/* Form Pengajuan */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>Jenis Cuti</label>
          <select
            className="w-full border p-2 rounded"
            value={leaveType}
            onChange={e => setLeaveType(e.target.value)}
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
          <label>Tanggal Mulai</label>
          <input
            type="date"
            className="w-full border p-2 rounded"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <label>Tanggal Selesai</label>
          <input
            type="date"
            className="w-full border p-2 rounded"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>

        <div>
          <label>Alasan</label>
          <textarea
            className="w-full border p-2 rounded"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Tuliskan alasan cuti..."
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={halfDay}
            onChange={e => setHalfDay(e.target.checked)}
          />
          <span>Cuti Setengah Hari</span>
        </div>

        {halfDay && (
          <div>
            <label>Pilih Shift</label>
            <select
              className="w-full border p-2 rounded"
              value={halfDayShift}
              onChange={e => setHalfDayShift(e.target.value as 'pagi' | 'siang')}
            >
              <option value="">-- Pilih --</option>
              <option value="pagi">Pagi</option>
              <option value="siang">Siang</option>
            </select>
          </div>
        )}

        {leaveType === 'Cuti Tahunan' && (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={annualLeaveCut}
              onChange={e => setAnnualLeaveCut(e.target.checked)}
            />
            <span>Potong kuota tahunan</span>
          </div>
        )}

        {leaveBalance !== null && (
          <div className="p-2 bg-green-100 rounded">
            Sisa Cuti Tahunan: <strong>{leaveBalance}</strong> hari
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-blue-700 text-white p-2 rounded"
          disabled={loading}
        >
          {loading ? 'Mengirim...' : 'Ajukan Cuti'}
        </button>
      </form>

      {/* Riwayat Pengajuan */}
      <div className="mt-6">
        <h2 className="font-bold mb-2">Riwayat Pengajuan</h2>
        {leaveRequests.length === 0 ? (
          <p>Belum ada pengajuan</p>
        ) : (
          <ul className="space-y-2">
            {leaveRequests.map(lr => (
              <li
                key={lr.id}
                className="border p-2 rounded flex justify-between"
              >
                <div>
                  <p>
                    {lr.leave_type} ({lr.leave_days} hari){' '}
                    {lr.half_day ? `- Setengah Hari (${lr.half_day_shift})` : ''}
                  </p>
                  <p>{lr.start_date} s/d {lr.end_date}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded-full ${
                    lr.status === 'Disetujui'
                      ? 'bg-green-200 text-green-800'
                      : lr.status === 'Ditolak'
                      ? 'bg-red-200 text-red-800'
                      : 'bg-yellow-200 text-yellow-800'
                  }`}
                >
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
