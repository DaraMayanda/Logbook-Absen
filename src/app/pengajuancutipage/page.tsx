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
  address: string
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
  const [address, setAddress] = useState('')
  const [halfDay, setHalfDay] = useState(false)
  const [halfDayShift, setHalfDayShift] = useState<'pagi' | 'siang' | ''>('')
  const [annualLeaveCut, setAnnualLeaveCut] = useState(true)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [leaveBalance, setLeaveBalance] = useState<number | null>(null)

  useEffect(() => setMounted(true), [])

  // ================= AMBIL USER & KUOTA =================
  useEffect(() => {
    if (!mounted) return
    const fetchUserAndQuota = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const currentYear = new Date().getFullYear()
      const { data: quotaData, error: quotaError } = await supabase
        .from('master_leave_quota')
        .select('annual_quota, used_leave')
        .eq('user_id', user.id)
        .eq('year', currentYear)
        .single()

      if (quotaError && quotaError.code === 'PGRST116') {
        const { error: insertError } = await supabase
          .from('master_leave_quota')
          .insert({ user_id: user.id, year: currentYear, annual_quota: 12, used_leave: 0 })
        if (insertError) toast.error('Gagal membuat kuota tahunan')
        else setLeaveBalance(12)
      } else if (quotaData) setLeaveBalance(quotaData.annual_quota - quotaData.used_leave)
    }
    fetchUserAndQuota()
  }, [mounted, router])

  // ================= FETCH RIWAYAT & UPDATE KUOTA =================
  const fetchLeaveRequests = async () => {
    if (!userId) return

    const { data: requests } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!requests) return

    const { data: approvals } = await supabase
      .from('leave_approvals')
      .select('leave_request_id, level, status')
      .in('leave_request_id', requests.map(r => r.id))

    const merged = requests.map((req: LeaveRequest) => {
      const level2 = approvals?.find(a => a.leave_request_id === req.id && a.level === 2)
      const level1 = approvals?.find(a => a.leave_request_id === req.id && a.level === 1)

      let finalStatus = req.status
      if (level2?.status === 'approved') finalStatus = 'Disetujui'
      else if (level2?.status === 'rejected') finalStatus = 'Ditolak'
      else if (level1?.status === 'rejected') finalStatus = 'Ditolak'
      else if (level1?.status === 'approved') finalStatus = 'Menunggu Persetujuan Kepala'

      return { ...req, status: finalStatus }
    })

    setLeaveRequests(merged)
    await updateLeaveQuotaIfApproved()
  }

  // ================= UPDATE KUOTA OTOMATIS =================
  const updateLeaveQuotaIfApproved = async () => {
    if (!userId) return
    const currentYear = new Date().getFullYear()

    const { data: approvedLeaves } = await supabase
      .from('leave_requests')
      .select('leave_days, half_day')
      .eq('user_id', userId)
      .eq('leave_type', 'Cuti Tahunan')
      .eq('annual_leave_cut', true)
      .eq('status', 'Disetujui')

    if (!approvedLeaves || approvedLeaves.length === 0) return

    const totalUsed = approvedLeaves.reduce((sum, lr) => sum + lr.leave_days, 0)

    const { data: quota } = await supabase
      .from('master_leave_quota')
      .select('annual_quota')
      .eq('user_id', userId)
      .eq('year', currentYear)
      .single()

    if (!quota) return

    await supabase
      .from('master_leave_quota')
      .update({ used_leave: totalUsed })
      .eq('user_id', userId)
      .eq('year', currentYear)

    setLeaveBalance(quota.annual_quota - totalUsed)
  }

  // ================= LISTEN REALTIME =================
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('realtime-leave-approval')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leave_approvals', filter: `status=eq.approved` },
        () => fetchLeaveRequests()
      )
      .subscribe()

    return () => {
      // @ts-ignore
      supabase.removeChannel(channel)
    }
  }, [userId])

  useEffect(() => { fetchLeaveRequests() }, [userId])

  // ================= SUBMIT =================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leaveType || !startDate || !endDate || !reason || !address)
      return toast.error('Semua field wajib diisi')
    if (!userId) return toast.error('User belum terdeteksi')

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
      p_address: address,
      p_half_day: halfDay,
      p_half_day_shift: halfDayShift || null,
      p_annual_leave_cut: annualLeaveCut,
    })

    if (error) toast.error(`Gagal submit: ${error.message}`)
    else {
      toast.success(data?.[0]?.message || 'Pengajuan berhasil dikirim')
      setLeaveType(''); setStartDate(''); setEndDate(''); setReason(''); setAddress('')
      setHalfDay(false); setHalfDayShift('')
      fetchLeaveRequests()
    }
    setLoading(false)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-white p-4">
      <Toaster position="top-center" />
      <div className="flex items-center mb-4 space-x-2 cursor-pointer" onClick={() => router.push('/dashboard')}>
        <ArrowLeft size={24} />
        <h1 className="text-xl font-bold">Pengajuan Cuti / Izin</h1>
      </div>

      {/* FORM PENGAJUAN */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>Jenis Cuti</label>
          <select className="w-full border p-2 rounded" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
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
          <input type="date" className="w-full border p-2 rounded" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>

        <div>
          <label>Tanggal Selesai</label>
          <input type="date" className="w-full border p-2 rounded" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div>
          <label>Alamat selama cuti</label>
          <textarea className="w-full border p-2 rounded" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Tuliskan alamat selama cuti..." />
        </div>

        <div>
          <label>Alasan cuti</label>
          <textarea className="w-full border p-2 rounded" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tuliskan alasan cuti..." />
        </div>

        <div className="flex items-center space-x-2">
          <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} />
          <span>Cuti Setengah Hari</span>
        </div>

        {halfDay && (
          <div>
            <label>Pilih Shift</label>
            <select className="w-full border p-2 rounded" value={halfDayShift} onChange={(e) => setHalfDayShift(e.target.value as 'pagi' | 'siang')}>
              <option value="">-- Pilih --</option>
              <option value="pagi">Pagi</option>
              <option value="siang">Siang</option>
            </select>
          </div>
        )}

        {leaveType === 'Cuti Tahunan' && (
          <div className="flex items-center space-x-2">
            <input type="checkbox" checked={annualLeaveCut} onChange={(e) => setAnnualLeaveCut(e.target.checked)} />
            <span>Potong kuota tahunan</span>
          </div>
        )}

        {leaveBalance !== null && (
          <div className="p-2 bg-green-100 rounded">
            Sisa Cuti Tahunan: <strong>{leaveBalance}</strong> hari
          </div>
        )}

        <button type="submit" className="w-full bg-blue-700 text-white p-2 rounded" disabled={loading}>
          {loading ? 'Mengirim...' : 'Ajukan Cuti'}
        </button>
      </form>

      {/* RIWAYAT PENGAJUAN */}
      <div className="mt-6">
        <h2 className="font-bold mb-2">Riwayat Pengajuan</h2>
        {leaveRequests.length === 0 ? (
          <p>Belum ada pengajuan</p>
        ) : (
          <ul className="space-y-2">
            {leaveRequests.map((lr) => (
              <li key={lr.id} className="border p-2 rounded flex justify-between">
                <div>
                  <p>
                    {lr.leave_type} ({lr.leave_days} hari) {lr.half_day ? `- Setengah Hari (${lr.half_day_shift})` : ''}
                  </p>
                  <p>{lr.start_date} s/d {lr.end_date}</p>
                  <p>Alamat: {lr.address}</p>
                  <p>Alasan: {lr.reason}</p>
                </div>
                <span className={`px-2 py-1 rounded-full ${
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
