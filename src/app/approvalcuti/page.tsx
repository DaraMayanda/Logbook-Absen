'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QRCodeCanvas } from 'qrcode.react'
import * as XLSX from 'xlsx'
import { Loader2, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

type LeaveRequest = {
  id: number
  user_id: string
  leave_type: string
  leave_days: number
  half_day: boolean
  start_date: string
  end_date: string
  status: 'Menunggu' | 'Disetujui' | 'Ditolak'
  annual_leave_cut: boolean
  profiles?: {
    full_name: string
    position: string
  }
}

type LeaveApproval = {
  id: number
  leave_request_id: number
  approver_id: string
  level: 1 | 2
  status: 'Menunggu' | 'Disetujui' | 'Ditolak'
  approved_at: string | null
  qr_code_url: string | null
}

export default function ApprovalCutiPage() {
  const router = useRouter()
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [approvals, setApprovals] = useState<LeaveApproval[]>([])
  const [approverRole, setApproverRole] = useState<'kasubbag' | 'kepala_kantor'>('kasubbag')
  const [loadingId, setLoadingId] = useState<number | null>(null)

  // =====================================================
  // 🔹 Fetch leave requests
  const fetchLeaveRequests = async () => {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, profiles(full_name, position)')
      .order('created_at', { ascending: false })
    if (!error && data) setLeaveRequests(data as LeaveRequest[])
  }

  // 🔹 Fetch approvals
  const fetchApprovals = async () => {
    const { data, error } = await supabase
      .from('leave_approvals')
      .select('*')
      .order('approved_at', { ascending: false })
    if (!error && data) setApprovals(data as LeaveApproval[])
  }

  // =====================================================
useEffect(() => {
  const init = async () => {
    await fetchLeaveRequests()
    await fetchApprovals()
  }
  init()

  // Realtime subscription
  const channel = supabase
    .channel('realtime-approvals')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'leave_approvals' },
      async () => {
        await fetchApprovals()
        await fetchLeaveRequests()
      }
    )
    .subscribe()

  // Cleanup
  return () => {
    // @ts-ignore Supabase typing issue
    supabase.removeChannel(channel)
  }
}, [])


  // =====================================================
  const getApprovalStatus = (leaveId: number, level: 1 | 2) => {
    return approvals.find(a => a.leave_request_id === leaveId && a.level === level)?.status || 'Menunggu'
  }

  // =====================================================
  const insertApproval = async (leave_request_id: number, status: 'Disetujui' | 'Ditolak') => {
    setLoadingId(leave_request_id)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const approver_id = userData.user?.id
      if (!approver_id) return alert('❌ Tidak ditemukan ID pengguna.')

      const level = approverRole === 'kasubbag' ? 1 : 2

      // Level 2 hanya bisa approve jika level 1 sudah Disetujui
      if (level === 2) {
        const level1 = approvals.find(a => a.leave_request_id === leave_request_id && a.level === 1)
        if (!level1 || level1.status !== 'Disetujui') {
          alert('❌ Kepala Kantor hanya dapat menyetujui jika Kasubbag sudah menyetujui.')
          return
        }
      }

      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('id', leave_request_id)
        .single()
      if (leaveError || !leaveData) return alert('❌ Data cuti tidak ditemukan.')

      const leaveDays = Number(leaveData.leave_days || 1)
      const isHalfDay = leaveData.half_day
      const annualLeaveCut = leaveData.annual_leave_cut

      const existingApproval = approvals.find(a => a.leave_request_id === leave_request_id && a.level === level)
      const qrValue = level === 2 && status === 'Disetujui'
        ? `${window.location.origin}/leave/${leave_request_id}`
        : existingApproval?.qr_code_url || null

      // Insert atau update approval
      if (existingApproval) {
        await supabase
          .from('leave_approvals')
          .update({ status, approver_id, approved_at: new Date().toISOString(), qr_code_url: qrValue })
          .eq('leave_request_id', leave_request_id)
          .eq('level', level)
      } else {
        await supabase
          .from('leave_approvals')
          .insert([{ leave_request_id, approver_id, level, status, approved_at: new Date().toISOString(), qr_code_url: qrValue }])
      }

      // Update status leave_requests
      if (status === 'Disetujui' || status === 'Ditolak') {
        await supabase
          .from('leave_requests')
          .update({ status, approved_by: approver_id })
          .eq('id', leave_request_id)
      }

      // Update kuota jika Level 2 disetujui & cuti tahunan
      if (status === 'Disetujui' && level === 2 && annualLeaveCut) {
        const { data: quotaData } = await supabase
          .from('master_leave_quota')
          .select('*')
          .eq('user_id', leaveData.user_id)
          .eq('year', new Date().getFullYear())
          .single()
        if (quotaData) {
          const usedLeave = Number(quotaData.used_leave || 0)
          const deduct = isHalfDay ? leaveDays / 2 : leaveDays
          await supabase
            .from('master_leave_quota')
            .update({ used_leave: usedLeave + deduct })
            .eq('id', quotaData.id)
        }
      }

      alert(`✅ Pengajuan berhasil ${status.toLowerCase()} oleh ${approverRole === 'kasubbag' ? 'Kasubbag' : 'Kepala Kantor'}.`)
      await fetchApprovals()
      await fetchLeaveRequests()
    } catch (err) {
      console.error('❌ Error Supabase:', err)
      alert('❌ Gagal menyimpan persetujuan.')
    } finally {
      setLoadingId(null)
    }
  }

  // =====================================================
  const exportToExcel = () => {
    const rekap = approvals.filter(a => a.status !== 'Menunggu')
    const formattedData = rekap.map(r => ({
      ID: r.id,
      'Leave Request ID': r.leave_request_id,
      Level: r.level,
      Status: r.status,
      'Tanggal Persetujuan': r.approved_at,
      'QR Code URL': r.qr_code_url || '-',
    }))
    const worksheet = XLSX.utils.json_to_sheet(formattedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Cuti')
    XLSX.writeFile(workbook, 'rekap_cuti.xlsx')
  }

  const pendingRequests = leaveRequests.filter(req => getApprovalStatus(req.id, 2) === 'Menunggu')
  const riwayatRequests = leaveRequests.filter(req => getApprovalStatus(req.id, 2) !== 'Menunggu')

  // =====================================================
  return (
    <div className="p-6 space-y-10">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => router.push('/dashboardadmin')}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Dashboard
        </Button>
      </div>

      <h1 className="text-2xl font-semibold mb-6">Persetujuan Cuti Pegawai</h1>

      <div className="mb-6 flex gap-4">
        <Button
          variant={approverRole === 'kasubbag' ? 'default' : 'outline'}
          onClick={() => setApproverRole('kasubbag')}
        >
          Kasubbag
        </Button>
        <Button
          variant={approverRole === 'kepala_kantor' ? 'default' : 'outline'}
          onClick={() => setApproverRole('kepala_kantor')}
        >
          Kepala Kantor
        </Button>
      </div>

      {/* Pending Requests */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Pengajuan Cuti Menunggu Persetujuan</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-gray-500">Tidak ada pengajuan cuti yang menunggu.</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map(req => {
                const statusKasubbag = getApprovalStatus(req.id, 1)
                const statusKepala = getApprovalStatus(req.id, 2)
                const disabledKasubbag = approverRole === 'kasubbag' && statusKasubbag !== 'Menunggu'
                const disabledKepala = approverRole === 'kepala_kantor' && statusKepala !== 'Menunggu'
                const disabled = disabledKasubbag || disabledKepala

                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between border p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-800">{req.profiles?.full_name}</span>
                      <span className="text-sm text-gray-600">{req.profiles?.position}</span> {/* ✅ posisi */}
                      <span className="text-sm text-gray-600">
                        {req.leave_type} ({req.start_date} - {req.end_date})
                      </span>
                      <span className="text-sm text-gray-500">
                        Kasubbag: {statusKasubbag} | Kepala Kantor: {statusKepala}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={disabled || loadingId === req.id}
                        onClick={() => insertApproval(req.id, 'Disetujui')}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {loadingId === req.id ? <Loader2 className="animate-spin h-4 w-4" /> : 'Setujui'}
                      </Button>
                      <Button
                        size="sm"
                        disabled={disabled || loadingId === req.id}
                        onClick={() => insertApproval(req.id, 'Ditolak')}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        {loadingId === req.id ? <Loader2 className="animate-spin h-4 w-4" /> : 'Tolak'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Riwayat Requests */}
      <Card className="border shadow-sm">
        <CardHeader className="flex justify-between items-center">
          <CardTitle>Riwayat Persetujuan Cuti</CardTitle>
          <Button onClick={exportToExcel} className="bg-blue-600 hover:bg-blue-700 text-white">
            Export Excel
          </Button>
        </CardHeader>
        <CardContent>
          {riwayatRequests.length === 0 ? (
            <p className="text-gray-500">Belum ada riwayat persetujuan cuti.</p>
          ) : (
            <div className="space-y-3">
              {riwayatRequests.map(req => {
                const statusKepala = getApprovalStatus(req.id, 2)
                const approval = approvals.find(a => a.leave_request_id === req.id && a.level === 2)

                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between border p-4 rounded-xl bg-white shadow-sm"
                  >
                    <div className="flex flex-col">
                      <p className="font-medium text-gray-800">{req.profiles?.full_name}</p>
                      <p className="text-sm text-gray-600">{req.profiles?.position}</p> {/* ✅ posisi */}
                      <p className="text-sm text-gray-600">
                        {req.leave_type} ({req.start_date} - {req.end_date})
                      </p>
                      <p
                        className={`text-sm font-semibold ${
                          statusKepala === 'Disetujui'
                            ? 'text-green-600'
                            : statusKepala === 'Ditolak'
                            ? 'text-red-600'
                            : 'text-gray-500'
                        }`}
                      >
                        {statusKepala}
                      </p>
                    </div>

                    {statusKepala === 'Disetujui' && approval?.qr_code_url && (
                      <QRCodeCanvas value={approval.qr_code_url} size={80} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
