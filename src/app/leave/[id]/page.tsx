'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

type LeaveRequest = {
  id: number
  leave_type: string
  start_date: string
  end_date: string
  reason: string
  status: string
  approved_by: string | null
  qr_code_url?: string | null
  profiles: {
    full_name: string
    position: string
  } | null
}

export default function LeaveDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [leave, setLeave] = useState<LeaveRequest | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const fetchLeaveDetail = async () => {
    setLoading(true)
    try {
      const leaveId = Number(id) // pastikan numeric
      const { data: leaveData, error } = await supabase
        .from('leave_requests')
        .select('*, profiles(full_name, position)')
        .eq('id', leaveId)
        .single()
      if (error || !leaveData) throw error || new Error('Data tidak ditemukan')
      setLeave(leaveData)
    } catch (err) {
      console.error('❌ Gagal mengambil data cuti:', err)
      alert('❌ Gagal mengambil data cuti.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaveDetail()
  }, [id])

  if (loading) return <p className="p-6">Loading...</p>
  if (!leave) return <p className="p-6 text-red-600">Data cuti tidak ditemukan.</p>

  // generate QR sama seperti di ApprovalCutiPage
  const qrValue = leave.status === 'Disetujui' ? `${window.location.origin}/leave/${leave.id}` : null

  return (
    <div className="p-6 space-y-6">
      <Button
        onClick={() => router.back()}
        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali
      </Button>

      <h1 className="text-2xl font-semibold">Detail Cuti Pegawai</h1>

      <Card className="border shadow-sm">
        <CardHeader><CardTitle>Informasi Pegawai</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p><span className="font-semibold">Nama:</span> {leave.profiles?.full_name || '-'}</p>
          <p><span className="font-semibold">Posisi:</span> {leave.profiles?.position || '-'}</p> {/* ✅ posisi */}
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader><CardTitle>Informasi Cuti</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p><span className="font-semibold">Tipe Cuti:</span> {leave.leave_type}</p>
          <p><span className="font-semibold">Tanggal Mulai:</span> {leave.start_date}</p>
          <p><span className="font-semibold">Tanggal Selesai:</span> {leave.end_date}</p>
          <p><span className="font-semibold">Alasan:</span> {leave.reason}</p>
          <p>
            <span className="font-semibold">Status:</span>{' '}
            <span className={leave.status === 'Disetujui' ? 'text-green-600 font-semibold' :
                              leave.status === 'Ditolak' ? 'text-red-600 font-semibold' : 'text-gray-500 font-semibold'}>
              {leave.status}
            </span>
          </p>

          {qrValue && (
            <div className="mt-4">
              <QRCodeCanvas value={qrValue} size={120} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
