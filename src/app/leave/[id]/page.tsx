'use client'

import { useEffect, useState } from 'react'
// import { useParams } from 'next/navigation' // <-- Dinonaktifkan untuk preview
// import { createClient } from '@supabase/supabase-js' // <-- Dinonaktifkan untuk preview
import { Button } from '@/components/ui/button'
import { Loader2, Printer, CheckCircle2 } from 'lucide-react'

// --- DATA MOCK (SIMULASI DATABASE) ---
const MOCK_LEAVE_DATA = {
  id: 12345,
  leave_type: 'Cuti Tahunan',
  start_date: '2023-10-25',
  end_date: '2023-10-27',
  reason: 'Acara Keluarga di Kampung',
  status: 'Disetujui',
  approved_by: 'Kepala Kantor',
  profiles: {
    full_name: 'Budi Santoso',
    position: 'Staff Pelaksana'
  }
}

// --- MOCK SUPABASE CLIENT ---
const supabase = {
  from: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          single: async () => {
            // Simulasi delay network
            await new Promise(resolve => setTimeout(resolve, 1000))
            return { data: MOCK_LEAVE_DATA, error: null }
          }
        })
      })
    })
  })
}

// --- Types ---
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

export default function LeavePublicPage() {
  // Mock params karena next/navigation tidak tersedia di preview
  const params = { id: '12345' }
  
  const [leave, setLeave] = useState<LeaveRequest | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string>('')

  // Format Tanggal Indonesia
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        weekday: 'long',
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
      // Simulasi pengambilan data
      const { data: leaveData, error } = await supabase
        .from()
        .select()
        .eq()
        .eq()
        .single()

      if (error) throw error
      // @ts-ignore
      setLeave(leaveData)
    } catch (err: any) {
      console.error('Error:', err)
      setErrorMsg('Data cuti tidak ditemukan atau belum disetujui final.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaveDetail()
  }, [])

  const handlePrint = () => window.print()

  if (loading)
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 text-gray-500 gap-2">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
        <p className="text-sm font-medium">Memverifikasi Data...</p>
      </div>
    )

  if (!leave || errorMsg)
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md border border-red-100">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">!</span>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Akses Ditolak</h3>
            <p className="text-gray-500 mb-6 text-sm">
                {errorMsg || "Data tidak ditemukan."}
            </p>
            <Button onClick={() => window.location.reload()} variant="outline">Coba Lagi</Button>
        </div>
      </div>
    )

  // URL Simulasi
  const qrValue = `https://kppn-lhokseumawe.com/leave/public/${leave.id}`
  
  // API QR Code Publik
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrValue)}`

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 py-10 print:bg-white print:py-0 font-sans">
      
      {/* WATERMARK BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] z-0">
        <div className="text-9xl font-bold text-gray-900 rotate-45 uppercase">Valid</div>
      </div>

      <div className="w-full max-w-2xl bg-white shadow-xl rounded-2xl p-0 border border-gray-200 print:shadow-none print:border-none overflow-hidden relative z-10">
        
        {/* HEADER KOP */}
        <div className="bg-blue-900 text-white p-6 text-center print:bg-white print:text-black print:border-b-2 print:border-black">
            <h1 className="text-2xl font-bold uppercase tracking-wide mb-1">Bukti Persetujuan Cuti</h1>
            <p className="text-blue-100 text-sm print:text-black opacity-80">Dokumen Digital Sah - KPPN Lhokseumawe</p>
        </div>

        <div className="p-8 space-y-8">
            
            {/* STATUS BADGE */}
            <div className="flex justify-center">
                <div className="flex items-center gap-2 bg-green-100 text-green-800 px-6 py-2 rounded-full font-bold border border-green-200">
                    <CheckCircle2 className="w-5 h-5" />
                    STATUS: DISETUJUI (FINAL)
                </div>
            </div>

            {/* INFORMASI PEGAWAI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Nama Pegawai</p>
                    <p className="text-lg font-semibold text-gray-900">{leave.profiles?.full_name || '-'}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Jabatan</p>
                    <p className="text-lg font-semibold text-gray-900">{leave.profiles?.position || '-'}</p>
                </div>
            </div>

            <hr className="border-gray-100" />

            {/* INFORMASI CUTI */}
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Jenis Cuti</p>
                        <p className="text-gray-900 font-medium">{leave.leave_type}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Alasan</p>
                        <p className="text-gray-900 font-medium">{leave.reason || '-'}</p>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Tanggal Mulai</p>
                            <p className="font-bold text-gray-800">{formatDate(leave.start_date)}</p>
                        </div>
                        <div className="border-l border-gray-200">
                            <p className="text-xs text-gray-400 mb-1">Tanggal Selesai</p>
                            <p className="font-bold text-gray-800">{formatDate(leave.end_date)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* QR CODE & FOOTER */}
            <div className="flex flex-col items-center justify-center pt-4">
                <div className="border-4 border-white shadow-lg rounded-lg overflow-hidden bg-white p-2">
                    {/* Menggunakan Image API agar tidak perlu install package tambahan */}
                    <img src={qrImageUrl} alt="QR Code Validasi" width={120} height={120} />
                </div>
                <p className="text-[10px] text-gray-400 mt-3 text-center max-w-xs">
                    Scan QR Code ini untuk memverifikasi keaslian dokumen digital ini secara online.
                    <br/>ID Dokumen: #{leave.id}
                </p>
            </div>
        </div>

        {/* TOMBOL AKSI (Hilang saat Print) */}
        <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-center print:hidden">
          <Button onClick={handlePrint} className="bg-blue-900 hover:bg-blue-800 text-white px-8 py-6 rounded-xl shadow-lg flex items-center gap-2 font-bold transition-all active:scale-95">
            <Printer className="w-5 h-5" /> Cetak / Simpan PDF
          </Button>
        </div>

      </div>
      
      <p className="mt-8 text-gray-400 text-xs font-mono print:hidden">
          Sistem Informasi Manajemen Kinerja - KPPN Lhokseumawe
      </p>
    </div>
  )
}