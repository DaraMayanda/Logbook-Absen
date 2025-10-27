'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QRCodeCanvas } from 'qrcode.react'
import * as XLSX from 'xlsx'
import { Loader2, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

// ======================= TYPES =======================
type LeaveRequest = {
  id: number
  user_id: string
  leave_type: string
  start_date?: string
  end_date?: string
  status?: 'Menunggu' | 'Disetujui' | 'Ditolak'
  address?: string
  approved_by?: string
  created_at?: string
  profiles?: { full_name?: string; position?: string }
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

// ======================= COMPONENT =======================
export default function ApprovalCutiPage() {
  const router = useRouter()
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [approvals, setApprovals] = useState<LeaveApproval[]>([])
  const [approverRole, setApproverRole] = useState<'kasubbag' | 'kepala_kantor' | null>(null)
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [loadingPage, setLoadingPage] = useState<boolean>(true)
  const [globalFilter, setGlobalFilter] = useState('')

  // ======================= HELPERS =======================
  const getApprovalRecord = (leaveId: number, level: 1 | 2) =>
    approvals.find((a) => a.leave_request_id === leaveId && a.level === level) || null

  const getApprovalStatus = (leaveId: number, level: 1 | 2) =>
    getApprovalRecord(leaveId, level)?.status || 'Menunggu'

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  // ======================= FETCH =======================
  const fetchLeaveRequests = async () => {
    try {
      setLoadingPage(true)
      const { data, error } = await supabase
        .from('leave_requests')
        .select(
          `id,user_id,leave_type,start_date,end_date,status,address,approved_by,created_at,
           profiles(full_name,position)`
        )
        .order('created_at', { ascending: false })
      if (error) throw error

      const safeData = Array.isArray(data)
        ? data.map((d: any) => ({
            ...d,
            profiles: Array.isArray(d.profiles) ? d.profiles[0] : d.profiles,
          }))
        : []

      setLeaveRequests(safeData as LeaveRequest[])
    } catch (err) {
      console.error('Error fetch leave_requests:', err)
      setLeaveRequests([])
    } finally {
      setLoadingPage(false)
    }
  }

  const fetchApprovals = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_approvals')
        .select('*')
        .order('approved_at', { ascending: false })
      if (error) throw error
      setApprovals(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetch leave_approvals:', err)
      setApprovals([])
    }
  }

  const fetchApproverRole = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const email = userData.user?.email
      if (!email) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('email', email)
        .single()
      if (profile?.role === 'kasubbag') setApproverRole('kasubbag')
      else if (profile?.role === 'kepala_kantor') setApproverRole('kepala_kantor')
      console.log('🧩 Role from profile:', profile?.role)
    } catch (err) {
      console.error('Error fetchApproverRole:', err)
    }
  }

  // ======================= EFFECT =======================
  useEffect(() => {
    const init = async () => await Promise.all([fetchLeaveRequests(), fetchApprovals(), fetchApproverRole()])
    init()
    const channel = supabase
      .channel('realtime-approvals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_approvals' },
        async () => await Promise.all([fetchLeaveRequests(), fetchApprovals()])
      )
      .subscribe()
    return () => {
      // @ts-ignore
      supabase.removeChannel(channel)
    }
  }, [])

  // ======================= APPROVAL ACTION =======================
  const insertApproval = async (leave_request_id: number, status: 'Disetujui' | 'Ditolak') => {
    if (!approverRole) return alert('Role belum ditentukan.')
    setLoadingId(leave_request_id)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const approver_id = userData.user?.id
      if (!approver_id) return alert('❌ Tidak ditemukan ID pengguna.')

      const level = approverRole === 'kasubbag' ? 1 : 2
      const kasubApproval = getApprovalRecord(leave_request_id, 1)

      if (level === 2 && kasubApproval?.status !== 'Disetujui') {
        return alert('❌ Kepala Kantor hanya dapat menyetujui jika Kasubbag sudah menyetujui.')
      }

      const existing = getApprovalRecord(leave_request_id, level)
      const qrValue =
        level === 2 && status === 'Disetujui'
          ? `${window.location.origin}/leave/${leave_request_id}`
          : existing?.qr_code_url || null

      if (existing) {
        await supabase
          .from('leave_approvals')
          .update({
            status,
            approver_id,
            approved_at: new Date().toISOString(),
            qr_code_url: qrValue,
          })
          .eq('leave_request_id', leave_request_id)
          .eq('level', level)
      } else {
        await supabase.from('leave_approvals').insert([
          {
            leave_request_id,
            approver_id,
            level,
            status,
            approved_at: new Date().toISOString(),
            qr_code_url: qrValue,
          },
        ])
      }

      // ⚡ Update status hanya untuk Kepala Kantor
      if (level === 2) {
        await supabase
          .from('leave_requests')
          .update({ status, approved_by: approver_id })
          .eq('id', leave_request_id)
      }

      await Promise.all([fetchApprovals(), fetchLeaveRequests()])
    } catch (err) {
      console.error(err)
      alert('❌ Gagal menyimpan persetujuan.')
    } finally {
      setLoadingId(null)
    }
  }

  // ======================= EXPORT EXCEL =======================
  const exportToExcel = () => {
    if (!approvals.length) return alert('Belum ada data untuk diekspor.')
    const rekap = approvals.filter((a) => a.status !== 'Menunggu')
    const formattedData = rekap.map((r) => ({
      ID: r.id,
      'Leave Request ID': r.leave_request_id,
      Level: r.level,
      Status: r.status,
      'Tanggal Persetujuan': r.approved_at ? new Date(r.approved_at).toISOString() : '-',
      'QR Code URL': r.qr_code_url || '-',
    }))
    const worksheet = XLSX.utils.json_to_sheet(formattedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Cuti')
    XLSX.writeFile(workbook, 'rekap_cuti.xlsx')
  }

  // ======================= PRINT =======================
  const printLeaveRequest = (lr: LeaveRequest, approvalLevel2?: LeaveApproval | null) => {
    const statusKepala = getApprovalStatus(lr.id, 2)
    const approvedAt = approvalLevel2?.approved_at || ''
    const win = window.open('', '_blank')
    if (!win) return
    const html = `
      <html><head><title>Cetak Cuti</title></head><body>
      <h1>Surat Permohonan Cuti</h1>
      <p>Nama: ${lr.profiles?.full_name || '-'}</p>
      <p>Jabatan: ${lr.profiles?.position || '-'}</p>
      <p>Jenis Cuti: ${lr.leave_type}</p>
      <p>Periode: ${formatDate(lr.start_date)} s/d ${formatDate(lr.end_date)}</p>
      <p>Status Kepala Kantor: ${statusKepala}</p>
      <p>Tanggal Persetujuan: ${formatDate(approvedAt)}</p>
      </body></html>`
    win.document.write(html)
    win.document.close()
    setTimeout(() => {
      win.print()
      win.close()
    }, 300)
  }

  // ======================= FILTER DATA SESUAI ROLE =======================
  const pendingRequests = useMemo(() => {
    if (approverRole === 'kasubbag') {
      return leaveRequests.filter((lr) => !getApprovalRecord(lr.id, 1)) // belum ada approval level 1
    }
    if (approverRole === 'kepala_kantor') {
      return leaveRequests.filter((lr) => {
        const kasubbagApproval = getApprovalRecord(lr.id, 1)
        const kepalaApproval = getApprovalRecord(lr.id, 2)
        return kasubbagApproval?.status === 'Disetujui' && (!kepalaApproval || kepalaApproval.status === 'Menunggu')
      })
    }
    return []
  }, [leaveRequests, approvals, approverRole])

  const riwayatRequests = useMemo(
    () => leaveRequests.filter((lr) => lr.status === 'Disetujui' || lr.status === 'Ditolak'),
    [leaveRequests]
  )

  const riwayatData = useMemo(
    () =>
      riwayatRequests.map((lr) => {
        const approvalLevel2 = approvals.find((a) => a.leave_request_id === lr.id && a.level === 2)
        return {
          nama: lr.profiles?.full_name || '-',
          jabatan: lr.profiles?.position || '-',
          jenis: lr.leave_type || '-',
          periode: `${formatDate(lr.start_date)} - ${formatDate(lr.end_date)}`,
          alamat: lr.address || '-',
          status: lr.status || 'Menunggu',
          qr: approvalLevel2?.qr_code_url || null,
          lr,
          approvalLevel2,
        }
      }),
    [riwayatRequests, approvals]
  )

  // ======================= TABLE =======================
  const columns = useMemo<ColumnDef<typeof riwayatData[0]>[]>(() => [
    { accessorKey: 'nama', header: 'Nama' },
    { accessorKey: 'jabatan', header: 'Jabatan' },
    { accessorKey: 'jenis', header: 'Jenis Cuti' },
    { accessorKey: 'periode', header: 'Periode' },
    { accessorKey: 'alamat', header: 'Alamat' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => (
        <span
          className={`font-semibold ${
            info.getValue() === 'Disetujui'
              ? 'text-green-600'
              : info.getValue() === 'Ditolak'
              ? 'text-red-600'
              : 'text-gray-500'
          }`}
        >
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'actions',
      header: 'Aksi',
      cell: (info) => (
        <div className="flex items-center gap-2">
          {info.row.original.qr && <QRCodeCanvas value={info.row.original.qr} size={50} />}
          <Button
            size="sm"
            className="bg-gray-700 hover:bg-gray-800 text-white"
            onClick={() => printLeaveRequest(info.row.original.lr, info.row.original.approvalLevel2)}
          >
            Cetak
          </Button>
        </div>
      ),
    },
  ], [])

  const table = useReactTable({
    data: riwayatData,
    columns,
    state: { globalFilter },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  })

  // ======================= RENDER =======================
  if (loadingPage)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    )

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => router.push('/dashboardadmin')}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            onClick={exportToExcel}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Export Rekap Approvals
          </Button>
        </div>
      </div>

      <h1 className="text-2xl font-semibold">
        Persetujuan Cuti Pegawai ({approverRole === 'kasubbag' ? 'Kasubbag' : 'Kepala Kantor'})
      </h1>

      {/* ================= PENDING TABLE ================= */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Daftar Pengajuan Menunggu Persetujuan</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-gray-500">Tidak ada pengajuan menunggu persetujuan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2">Nama</th>
                    <th className="border px-3 py-2">Jabatan</th>
                    <th className="border px-3 py-2">Jenis Cuti</th>
                    <th className="border px-3 py-2">Periode</th>
                    <th className="border px-3 py-2">Alamat</th>
                    <th className="border px-3 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="border px-3 py-2">{req.profiles?.full_name}</td>
                      <td className="border px-3 py-2">{req.profiles?.position}</td>
                      <td className="border px-3 py-2">{req.leave_type}</td>
                      <td className="border px-3 py-2">
                        {formatDate(req.start_date)} - {formatDate(req.end_date)}
                      </td>
                      <td className="border px-3 py-2">{req.address || '-'}</td>
                      <td className="border px-3 py-2 text-center">
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            disabled={loadingId === req.id}
                            onClick={() => insertApproval(req.id, 'Disetujui')}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {loadingId === req.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Setujui'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            disabled={loadingId === req.id}
                            onClick={() => insertApproval(req.id, 'Ditolak')}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            {loadingId === req.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Tolak'
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================= RIWAYAT TABLE ================= */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Riwayat Persetujuan Cuti</CardTitle>
        </CardHeader>
        <CardContent>
          {riwayatData.length === 0 ? (
            <p className="text-gray-500">Belum ada riwayat cuti.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    {table.getHeaderGroups().map((headerGroup) =>
                      headerGroup.headers.map((header) => (
                        <th key={header.id} className="border px-3 py-2">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="border px-3 py-2">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
