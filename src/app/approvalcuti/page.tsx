'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QRCodeCanvas } from 'qrcode.react'
import * as XLSX from 'xlsx'
import { Loader2, ArrowLeft, Search } from 'lucide-react'
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
  reason?: string
  approved_by?: string
  created_at?: string
  half_day?: boolean
  profiles?: { full_name?: string; position?: string } | null
  sisa_cuti?: number
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
          `id,user_id,leave_type,start_date,end_date,status,address,reason,approved_by,created_at,half_day,
           profiles(full_name,position)`
        )
        .order('created_at', { ascending: false })
      if (error) throw error

      const safeData = Array.isArray(data)
        ? data.map((d: any) => ({ ...d, profiles: Array.isArray(d.profiles) ? d.profiles[0] : d.profiles }))
        : []

      // Ambil sisa cuti realtime
      const leaveWithQuota = await Promise.all(
        safeData.map(async (lr: LeaveRequest) => {
          if (lr.leave_type !== 'Cuti Tahunan') return lr
          const start = lr.start_date ? new Date(lr.start_date) : null
          const year = start?.getFullYear() || new Date().getFullYear()
          const { data: quotaData } = await supabase
            .from('master_leave_quota')
            .select('annual_quota, used_leave')
            .eq('user_id', lr.user_id)
            .eq('year', year)
            .single()
          return { ...lr, sisa_cuti: quotaData ? quotaData.annual_quota - quotaData.used_leave : 0 }
        })
      )

      setLeaveRequests(leaveWithQuota as LeaveRequest[])
    } catch (err) {
      console.error(err)
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
    } catch {
      setApprovals([])
    }
  }

  const fetchApproverRole = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const email = userData.user?.email
      if (!email) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('email', email).single()
      if (profile?.role === 'kasubbag') setApproverRole('kasubbag')
      else if (profile?.role === 'kepala_kantor') setApproverRole('kepala_kantor')
    } catch {}
  }

  // ======================= EFFECT =======================
  useEffect(() => {
    const init = async () => await Promise.all([fetchLeaveRequests(), fetchApprovals(), fetchApproverRole()])
    init()

    const channel = supabase
      .channel('realtime-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_approvals' }, async () => {
        await Promise.all([fetchLeaveRequests(), fetchApprovals()])
      })
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

      if (level === 1) {
        const existingApproval = getApprovalRecord(leave_request_id, 1)
        if (existingApproval) {
          await supabase
            .from('leave_approvals')
            .update({ status, approver_id, approved_at: new Date().toISOString() })
            .eq('leave_request_id', leave_request_id)
            .eq('level', 1)
        } else {
          await supabase.from('leave_approvals').insert([
            { leave_request_id, approver_id, level: 1, status, approved_at: new Date().toISOString() },
          ])
        }
      } else if (level === 2) {
        const level1Approval = getApprovalRecord(leave_request_id, 1)
        if (status === 'Disetujui' && level1Approval?.status !== 'Disetujui') {
          return alert('❌ Kepala Kantor hanya dapat menyetujui jika Kasubbag sudah menyetujui.')
        }

        const { data, error } = await supabase.rpc('handle_level_2_approval', {
          p_leave_request_id: leave_request_id,
          p_approver_uuid: approver_id,
          p_status: status,
        })

        if (error) throw new Error(error.message)
        if (data && data.status === 'error') throw new Error(data.message)
      }

      await Promise.all([fetchApprovals(), fetchLeaveRequests()])
    } catch (err: any) {
      console.error('Full error caught in insertApproval:', err)
      alert(`❌ Gagal menyimpan persetujuan: ${err.message || 'Error tidak diketahui'}`)
    } finally {
      setLoadingId(null)
    }
  }

 // ======================= EXPORT EXCEL =======================
 const exportToExcel = () => {
    if (!leaveRequests.length) return alert('Belum ada data untuk diekspor.')

    const dataToExport = leaveRequests
      .filter((lr) => lr.status === 'Disetujui' || lr.status === 'Ditolak') // hanya yang sudah diproses
      .map((lr) => {
        // Cari persetujuan level 2 untuk tanggal dan QR
        const approval = approvals.find((a) => a.leave_request_id === lr.id && a.level === 2 && a.status === 'Disetujui')
        
        // Jika tidak ada persetujuan level 2 (misal ditolak di level 1), cari info persetujuan terakhir
        const lastApproval =
          approval ||
          [...approvals]
            .filter((a) => a.leave_request_id === lr.id)
            .sort((a, b) => new Date(b.approved_at || 0).getTime() - new Date(a.approved_at || 0).getTime())[0]

        return {
          'ID': lr.id,
          'Nama': lr.profiles?.full_name || '-',
          'Jabatan': lr.profiles?.position || '-',
          'Jenis Cuti': lr.leave_type || '-',
          'Periode': `${lr.start_date ? new Date(lr.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'} - ${lr.end_date ? new Date(lr.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}`,
          'Alamat': lr.address || '-',
          'Alasan Cuti': lr.reason || '-',
          'Sisa Cuti': lr.sisa_cuti ?? 0,
          'Status': lr.status || '-',
          'Tanggal Persetujuan': lastApproval?.approved_at
            ? new Date(lastApproval.approved_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
            : '-',
          'QR Code URL': approval?.qr_code_url || '-', // Hanya tampilkan QR jika disetujui level 2
        }
      })

    if (dataToExport.length === 0) return alert('Belum ada data persetujuan untuk diekspor.')

    // ---- STYLING LOGIC ----

    // 1. Buat Worksheet dari JSON
    const worksheet = XLSX.utils.json_to_sheet(dataToExport)

    // 2. Definisikan Styles
    const allBorders = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    }
    const headerStyle = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'DDEBF7' } }, // Warna biru muda seperti di gambar
      border: allBorders,
      alignment: { vertical: 'center', horizontal: 'left' },
    }
    const cellStyle = {
      border: allBorders,
    }

    // 3. Hitung Lebar Kolom
    const headers = Object.keys(dataToExport[0]);
    const colWidths = headers.map((header, i) => {
      // Ambil panjang header
      let maxLen = header.length;
      // Cek panjang data di setiap baris untuk kolom ini
      dataToExport.forEach((row) => {
        // @ts-ignore
        const value = row[header];
        if (value != null) {
          const len = value.toString().length;
          if (len > maxLen) {
            maxLen = len;
          }
        }
      });
      // Beri padding, min 10, max 50
      let width = Math.max(10, maxLen + 2)
      // Kolom URL QR Code kita buat lebih lebar
      if (header === 'QR Code URL') width = 50;
      if (header === 'Periode') width = 40;
      return { wch: width };
    });
    worksheet['!cols'] = colWidths;


    // 4. Terapkan Styles ke Sel
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      // Style Header (Baris pertama)
      const headerCellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: C });
      if (worksheet[headerCellAddress]) {
        worksheet[headerCellAddress].s = headerStyle;
      }

      // Style Sel Data (Baris setelah header)
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (worksheet[cellAddress]) {
          // Inisialisasi .s jika belum ada
          if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
          worksheet[cellAddress].s.border = cellStyle.border;
        } else {
           // Buat sel kosong jika tidak ada data, agar border tetap ada
           XLSX.utils.sheet_add_aoa(worksheet, [[""]], { origin: cellAddress });
           worksheet[cellAddress].s = cellStyle;
        }
      }
    }
    
    // 5. Buat Workbook dan Download
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Cuti')
    XLSX.writeFile(workbook, 'rekap_cuti.xlsx') // Ubah nama file
  }
  // ======================= FILTER DATA =======================
  const pendingRequests = useMemo(() => {
    if (!approverRole) return []
    return leaveRequests.filter((lr) => {
      const level1Approval = getApprovalRecord(lr.id, 1)
      const level2Approval = getApprovalRecord(lr.id, 2)
      if (approverRole === 'kasubbag') return !level1Approval || level1Approval.status === 'Menunggu'
      if (approverRole === 'kepala_kantor')
        return level1Approval?.status === 'Disetujui' && (!level2Approval || level2Approval.status === 'Menunggu')
      return false
    })
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
          alasan: lr.reason || '-',
          status: lr.status || 'Menunggu',
          qr: approvalLevel2?.qr_code_url || null,
          sisa_cuti: lr.sisa_cuti ?? 0,
        }
      }),
    [riwayatRequests, approvals]
  )

  const columns = useMemo<ColumnDef<typeof riwayatData[0]>[]>(() => [
    { accessorKey: 'nama', header: 'Nama' },
    { accessorKey: 'jabatan', header: 'Jabatan' },
    { accessorKey: 'jenis', header: 'Jenis Cuti' },
    { accessorKey: 'periode', header: 'Periode' },
    { accessorKey: 'alamat', header: 'Alamat' },
    { accessorKey: 'alasan', header: 'Alasan Cuti' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => (
        <span
          className={`font-semibold ${
            String(info.getValue()) === 'Disetujui'
              ? 'text-green-600'
              : String(info.getValue()) === 'Ditolak'
              ? 'text-red-600'
              : 'text-gray-500'
          }`}
        >
          {String(info.getValue())}
        </span>
      ),
    },
    {
      accessorKey: 'sisa_cuti',
      header: 'Sisa Cuti',
      cell: (info) => <span>{String(info.getValue())}</span>,
    },
    {
      accessorKey: 'qr',
      header: 'QR Code',
      cell: (info) =>
        info.getValue() ? (
          <QRCodeCanvas value={String(info.getValue())} size={70} className="border rounded-lg shadow-sm" />
        ) : (
          <span className="text-gray-400">-</span>
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

  if (loadingPage)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    )

  return (
    <div className="p-6 space-y-8 text-[17px]">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => router.push('/dashboardadmin')}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
        </Button>
        <div className="ml-auto flex gap-2">
          <Button onClick={exportToExcel} className="bg-blue-600 hover:bg-blue-700 text-white">
            Export Rekap Approvals
          </Button>
        </div>
      </div>

      <h1 className="text-3xl font-bold mt-2">
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
            <div className="w-full overflow-x-auto rounded-xl shadow-sm bg-white pb-3">
            <table className="min-w-[900px] sm:min-w-full table-auto border-collapse text-[16px]">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2">Nama</th>
                    <th className="border px-3 py-2">Jabatan</th>
                    <th className="border px-3 py-2">Jenis Cuti</th>
                    <th className="border px-3 py-2">Periode</th>
                    <th className="border px-3 py-2">Alamat</th>
                    <th className="border px-3 py-2">Sisa Cuti</th>
                    <th className="border px-3 py-2">Alasan Cuti</th>
                    <th className="border px-3 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="border px-3 py-2">{req.profiles?.full_name || '-'}</td>
                      <td className="border px-3 py-2">{req.profiles?.position || '-'}</td>
                      <td className="border px-3 py-2">{req.leave_type}</td>
                      <td className="border px-3 py-2">
                        {formatDate(req.start_date)} - {formatDate(req.end_date)}
                      </td>
                      <td className="border px-3 py-2">{req.address || '-'}</td>
                      <td className="border px-3 py-2">{req.sisa_cuti ?? 0}</td>
                      <td className="border px-3 py-2">{req.reason || '-'}</td>
                      <td className="border px-3 py-2 text-center">
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            disabled={loadingId === req.id}
                            onClick={() => insertApproval(req.id, 'Disetujui')}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {loadingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Setujui'}
                          </Button>
                          <Button
                            size="sm"
                            disabled={loadingId === req.id}
                            onClick={() => insertApproval(req.id, 'Ditolak')}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            {loadingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tolak'}
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
          <CardTitle className="mb-3 text-lg font-semibold">Riwayat Persetujuan Cuti</CardTitle>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama / jabatan / jenis / alasan"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto rounded-xl shadow-sm bg-white pb-3">
  <table className="min-w-[900px] sm:min-w-full table-auto border-collapse text-[15px]">

              <thead className="bg-gray-100">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="border px-3 py-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="border px-3 py-2 text-center ">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
