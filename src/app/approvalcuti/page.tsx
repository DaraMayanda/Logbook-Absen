'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QRCodeCanvas } from 'qrcode.react'
import * as XLSX from 'xlsx'
import { Loader2, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ApprovalCutiPage() {
  const router = useRouter()
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [approverRole, setApproverRole] = useState<'kasubbag' | 'kepala_kantor'>('kasubbag')
  const [approvals, setApprovals] = useState<any[]>([])
  const [rekap, setRekap] = useState<any[]>([])
  const [loadingId, setLoadingId] = useState<number | null>(null)

  // 🔹 Ambil data pengajuan cuti
  const fetchLeaveRequests = async () => {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
    if (!error && data) setLeaveRequests(data)
  }

  // 🔹 Ambil data persetujuan
  const fetchApprovals = async () => {
    const { data, error } = await supabase
      .from('leave_approvals')
      .select('id, leave_request_id, level, status, approved_at, qr_code_url')
      .order('approved_at', { ascending: false })

    if (!error && data) {
      setApprovals(data)
      setRekap(data.filter(a => a.status !== 'Menunggu'))
    }
  }

  useEffect(() => {
    fetchLeaveRequests()
    fetchApprovals()
  }, [])

  const getApprovalStatus = (leaveId: number, level: number) => {
    return approvals.find(a => a.leave_request_id === leaveId && a.level === level)?.status || 'Menunggu'
  }

  // 🔹 Simpan approval
  const insertApproval = async (leave_request_id: number, status: 'Disetujui' | 'Ditolak') => {
    setLoadingId(leave_request_id)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const approver_id = userData.user?.id
      if (!approver_id) return alert('❌ Tidak ditemukan ID pengguna.')

      const level = approverRole === 'kasubbag' ? 1 : 2

      // Cegah approve ganda
      const existing = approvals.find(a => a.leave_request_id === leave_request_id && a.level === level)
      if (existing && existing.status !== 'Menunggu') {
        alert('⚠️ Sudah diproses sebelumnya.')
        return
      }

      // Kepala kantor hanya bisa approve jika Kasubbag sudah approve
      if (level === 2) {
        const kasubbagApproval = approvals.find(
          a => a.leave_request_id === leave_request_id && a.level === 1 && a.status === 'Disetujui'
        )
        if (!kasubbagApproval) {
          alert('❌ Kepala Kantor hanya dapat menyetujui jika Kasubbag sudah menyetujui.')
          return
        }
      }

      const { error } = await supabase.from('leave_approvals').insert([
        {
          leave_request_id,
          approver_id,
          level,
          status,
          approved_at: new Date().toISOString(),
        },
      ])

      if (error) throw error

      // Buat QR code hanya jika disetujui kepala kantor
      if (status === 'Disetujui' && level === 2) {
        const qrContent = `Cuti disetujui Kepala Kantor - ID: ${leave_request_id}`
        await supabase
          .from('leave_approvals')
          .update({ qr_code_url: qrContent })
          .eq('leave_request_id', leave_request_id)
          .eq('level', 2)
      }

      alert(`✅ Pengajuan berhasil ${status.toLowerCase()} oleh ${approverRole === 'kasubbag' ? 'Kasubbag' : 'Kepala Kantor'}.`)
      fetchApprovals()
    } catch (err) {
      console.error(err)
      alert('❌ Gagal menyimpan persetujuan.')
    } finally {
      setLoadingId(null)
    }
  }

  const exportToExcel = () => {
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

  return (
    <div className="p-6 space-y-10">
      {/* 🔙 Tombol kembali ke dashboard */}
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

      {/* Pilihan Role */}
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

      {/* === PENDING APPROVALS === */}
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
                const disabledKasubbag =
                  approverRole === 'kasubbag' && (statusKasubbag === 'Disetujui' || statusKasubbag === 'Ditolak')
                const disabledKepala =
                  approverRole === 'kepala_kantor' && (statusKepala === 'Disetujui' || statusKepala === 'Ditolak')

                const disabled = disabledKasubbag || disabledKepala

                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between border p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-800">{req.profiles?.full_name || '-'}</span>
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

      {/* === RIWAYAT === */}
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
                    <div>
                      <p className="font-medium text-gray-800">{req.profiles?.full_name || '-'}</p>
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
