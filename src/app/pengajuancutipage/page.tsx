'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

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
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [leaveBalance, setLeaveBalance] = useState<number | null>(null)

  useEffect(() => setMounted(true), [])

  // =================== AMBIL USER & KUOTA ===================
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
      } else if (quotaData) {
        setLeaveBalance(quotaData.annual_quota - quotaData.used_leave)
      }
    }
    fetchUserAndQuota()
  }, [mounted, router])

  // =================== FETCH RIWAYAT ===================
  const fetchLeaveRequests = async () => {
    if (!userId) return

    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching requests:', error.message)
      return
    }

    if (!requests || requests.length === 0) {
      setLeaveRequests([])
      return
    }

    const { data: approvals } = await supabase
      .from('leave_approvals')
      .select('leave_request_id, level, status')
      .in('leave_request_id', requests.map(r => r.id))

    const merged = requests.map((req: LeaveRequest) => {
      const level2 = approvals?.find(a => a.leave_request_id === req.id && a.level === 2)
      const level1 = approvals?.find(a => a.leave_request_id === req.id && a.level === 1)

      let finalStatus = req.status
      if (level2?.status === 'Disetujui') finalStatus = 'Disetujui'
      else if (level2?.status === 'Ditolak') finalStatus = 'Ditolak'
      else if (level1?.status === 'Ditolak') finalStatus = 'Ditolak'
      else if (level1?.status === 'Disetujui') finalStatus = 'Disetujui'

      const diffDays = req.half_day
        ? 0.5
        : Math.ceil((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / (1000 * 3600 * 24)) + 1

      return { ...req, status: finalStatus, leave_days: diffDays }
    })

    setLeaveRequests(merged)
  }

  useEffect(() => { fetchLeaveRequests() }, [userId])

  // =================== AUTO REFRESH KUOTA ===================
  useEffect(() => {
    if (!mounted || !userId) return
    const fetchQuota = async () => {
      const currentYear = new Date().getFullYear()
      const { data: quotaData } = await supabase
        .from('master_leave_quota')
        .select('annual_quota, used_leave')
        .eq('user_id', userId)
        .eq('year', currentYear)
        .single()

      if (quotaData) {
        setLeaveBalance(quotaData.annual_quota - quotaData.used_leave)
      }
    }
    fetchQuota()
  }, [mounted, userId, leaveRequests]) // auto-refresh saat leaveRequests berubah

  // =================== SUBMIT PENGAJUAN ===================
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

    const overlap = leaveRequests
      .filter(lr => lr.status === 'Menunggu Persetujuan Kepala')
      .some(lr => (new Date(startDate) <= new Date(lr.end_date)) && (new Date(endDate) >= new Date(lr.start_date)))

    if (overlap) {
      toast.error('❌ Anda masih punya pengajuan aktif yang overlap dengan tanggal ini.')
      setLoading(false)
      return
    }

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
      setLeaveType('')
      setStartDate('')
      setEndDate('')
      setReason('')
      setAddress('')
      setHalfDay(false)
      setHalfDayShift('')
      fetchLeaveRequests()
    }

    setLoading(false)
  }

  const filteredRequests = leaveRequests.filter((lr) =>
    lr.leave_type.toLowerCase().includes(search.toLowerCase()) ||
    lr.reason.toLowerCase().includes(search.toLowerCase()) ||
    lr.status.toLowerCase().includes(search.toLowerCase())
  )

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <Toaster position="top-center" />
      <div className="flex items-center mb-6 space-x-2 text-blue-700 hover:text-blue-900 transition cursor-pointer"
           onClick={() => router.push('/dashboard')}>
        <ArrowLeft size={22} />
        <h1 className="text-xl sm:text-2xl font-semibold">Pengajuan Cuti </h1>
      </div>

      {/* FORM */}
      <Card className="mb-8 shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl font-semibold text-gray-800">
            Formulir Pengajuan Cuti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Jenis Cuti */}
            <div>
              <label className="font-medium">Jenis Cuti</label>
              <select
                className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
              >
                <option value="">Pilih Jenis Cuti</option>
                <option value="Cuti Tahunan">Cuti Tahunan</option>
                <option value="Cuti Sakit">Cuti Sakit</option>
                <option value="Cuti Karena Alasan Penting">Cuti Karena Alasan Penting</option>
                <option value="Cuti Melahirkan">Cuti Melahirkan</option>
                <option value="Cuti di Luar Tanggungan Negara">Cuti di Luar Tanggungan Negara</option>
              </select>
            </div>

            {/* Tanggal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-medium">Tanggal Mulai</label>
                <input type="date" className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                       value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="font-medium">Tanggal Selesai</label>
                <input type="date" className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                       value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            {/* Alamat */}
            <div>
              <label className="font-medium">Alamat Selama Cuti</label>
              <textarea className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                        value={address} onChange={(e) => setAddress(e.target.value)}
                        placeholder="Tuliskan alamat selama cuti..." />
            </div>

            {/* Alasan */}
            <div>
              <label className="font-medium">Alasan Cuti</label>
              <textarea className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                        value={reason} onChange={(e) => setReason(e.target.value)}
                        placeholder="Tuliskan alasan cuti..." />
            </div>

            {/* Setengah hari */}
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} />
              <span>Cuti Setengah Hari</span>
            </div>

            {halfDay && (
              <div>
                <label>Pilih Shift</label>
                <select className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                        value={halfDayShift} onChange={(e) => setHalfDayShift(e.target.value as 'pagi' | 'siang')}>
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
              <div className="p-2 bg-green-100 text-green-800 rounded text-sm text-center">
                Sisa Cuti Tahunan: <strong>{leaveBalance}</strong> hari
              </div>
            )}

            <button type="submit"
                    className="w-full bg-blue-700 text-white p-2 rounded-md hover:bg-blue-800 transition flex items-center justify-center"
                    disabled={loading}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Ajukan Cuti'}
            </button>
          </form>
        </CardContent>
      </Card>

     {/* RIWAYAT */}
<Card className="shadow-sm border border-gray-200">
  <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-2">
    <CardTitle className="text-lg font-semibold text-gray-800">Riwayat Pengajuan</CardTitle>
    <input
      type="text"
      placeholder="Cari data..."
      className="border p-2 rounded-md focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  </CardHeader>
  <CardContent>
    {filteredRequests.length === 0 ? (
      <p className="text-gray-600 text-sm text-center py-2">Belum ada pengajuan</p>
    ) : (
      <div className="overflow-x-auto md:overflow-visible w-full max-w-full">
        <div className="min-w-[600px] md:min-w-0">
          <table className="w-full table-auto border-collapse text-xs sm:text-sm text-center">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-2 border">Jenis Cuti</th>
                <th className="p-2 border">Tanggal</th>
                <th className="p-2 border">Durasi</th>
                <th className="p-2 border">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((lr) => (
                <tr key={lr.id} className="hover:bg-gray-50 transition">
                  <td className="p-2 border">{lr.leave_type}</td>
                  <td className="p-2 border">
                    {lr.start_date} – {lr.end_date}
                  </td>
                  <td className="p-2 border">
                    {lr.half_day ? '½ Hari' : `${lr.leave_days} Hari`}
                  </td>
                  <td className="p-2 border">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        lr.status === 'Disetujui'
                          ? 'bg-green-200 text-green-800'
                          : lr.status === 'Ditolak'
                          ? 'bg-red-200 text-red-800'
                          : 'bg-yellow-200 text-yellow-800'
                      }`}
                    >
                      {lr.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </CardContent>
</Card>
    </div>
  )
}
