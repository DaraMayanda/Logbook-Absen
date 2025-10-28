'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

type LeaveRequest = {
  id: number
  leave_type: string
  start_date: string
  end_date: string
  reason: string
  status: string
  approved_by: string | null
  profiles: {
    full_name: string
    position: string
  } | null
}

export default function LeaveDetailPage() {
  const { id } = useParams()
  const [leave, setLeave] = useState<LeaveRequest | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const fetchLeaveDetail = async () => {
    setLoading(true)
    try {
      const leaveId = Number(id)
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

  const handlePrint = () => {
    window.print()
  }

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin w-6 h-6 text-gray-500" />
      </div>
    )

  if (!leave)
    return (
      <p className="p-6 text-red-600 text-center">Data cuti tidak ditemukan.</p>
    )

  const domain = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin
  const qrValue =
    leave.status === 'Disetujui' ? `${domain}/leave/${leave.id}` : null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 py-10 print:bg-white">
      <div className="w-full max-w-2xl bg-white shadow-lg rounded-2xl p-8 border border-gray-200 print:shadow-none print:border-none">
        <h1 className="text-2xl font-bold text-center mb-6">
          Detail Cuti Pegawai
        </h1>

        {/* Informasi Pegawai */}
        <Card className="border shadow-sm mb-6">
          <CardHeader className="pb-2">
            <CardTitle>Informasi Pegawai</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <span className="font-semibold">Nama:</span>{' '}
              {leave.profiles?.full_name || '-'}
            </p>
            <p>
              <span className="font-semibold">Posisi:</span>{' '}
              {leave.profiles?.position || '-'}
            </p>
          </CardContent>
        </Card>

        {/* Informasi Cuti */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle>Informasi Cuti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <span className="font-semibold">Tipe Cuti:</span>{' '}
              {leave.leave_type}
            </p>
            <p>
              <span className="font-semibold">Tanggal Mulai:</span>{' '}
              {formatDate(leave.start_date)}
            </p>
            <p>
              <span className="font-semibold">Tanggal Selesai:</span>{' '}
              {formatDate(leave.end_date)}
            </p>
            <p>
              <span className="font-semibold">Alasan:</span>{' '}
              {leave.reason || '-'}
            </p>
            <p>
              <span className="font-semibold">Status:</span>{' '}
              <span
                className={
                  leave.status === 'Disetujui'
                    ? 'text-green-600 font-semibold'
                    : leave.status === 'Ditolak'
                    ? 'text-red-600 font-semibold'
                    : 'text-gray-500 font-semibold'
                }
              >
                {leave.status}
              </span>
            </p>

            {qrValue && (
              <div className="mt-6 flex flex-col items-center">
                <QRCodeCanvas value={qrValue} size={140} />
                <p className="text-sm text-gray-600 mt-2 text-center">
                  Scan QR untuk membuka halaman ini
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tombol Cetak */}
        <div className="mt-8 flex justify-center print:hidden">
          <Button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            Cetak Halaman
          </Button>
        </div>
      </div>
    </div>
  )
}
