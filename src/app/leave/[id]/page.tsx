'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { 
  Loader2, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  CalendarDays, 
  User, 
  Briefcase, 
  FileText,
  Clock
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

// ================= SUPABASE CLIENT =================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ================= TYPES =================
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

// ================= COMPONENT =================
export default function LeavePublicPage() {
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
        .select('*, profiles(id, full_name, position)')
        .eq('id', leaveId)
        .eq('status', 'Disetujui')
        .single()

      if (error || !leaveData) throw error || new Error('Data tidak ditemukan')
      setLeave(leaveData)
    } catch (err) {
      console.error('❌ Gagal mengambil data cuti:', err)
      // alert('❌ Gagal mengambil data cuti.') // Optional: hilangkan alert agar UI lebih bersih
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaveDetail()
  }, [id])

  const handlePrint = () => window.print()

  if (loading)
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="animate-spin w-10 h-10 text-blue-600" />
        <p className="text-slate-500 font-medium animate-pulse">Memverifikasi Dokumen...</p>
      </div>
    )

  if (!leave)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full border-t-4 border-red-500">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-800">Data Tidak Ditemukan</h1>
            <p className="text-gray-500 mt-2">Dokumen cuti mungkin tidak valid, belum disetujui, atau ID yang Anda masukkan salah.</p>
        </div>
      </div>
    )

  // QR value publik
  const domain = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin
  const qrValue = `${domain}/leave/${leave.id}`

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 print:bg-white print:p-0 flex justify-center items-start">
      
      {/* Container Kertas */}
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden print:shadow-none print:rounded-none border border-slate-200 print:border-none">
        
        {/* === HEADER === */}
        <div className="bg-slate-900 text-white p-8 text-center print:bg-white print:text-black print:border-b-2 print:border-black">
            <div className="flex justify-center mb-4 print:hidden">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <FileText className="w-8 h-8 text-white" />
                </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide uppercase font-serif">Surat Izin Cuti</h1>
            <p className="text-slate-300 text-sm mt-1 print:text-gray-600">Dokumen Digital Resmi Pegawai</p>
        </div>

        {/* === BODY === */}
        <div className="p-8 md:p-12 space-y-8">

            {/* Status Badge */}
            <div className="flex justify-center">
                <div className={`px-6 py-2 rounded-full border flex items-center gap-2 font-bold uppercase tracking-wider text-sm
                    ${leave.status === 'Disetujui' 
                        ? 'bg-green-50 border-green-200 text-green-700' 
                        : leave.status === 'Ditolak' 
                        ? 'bg-red-50 border-red-200 text-red-700' 
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}>
                    {leave.status === 'Disetujui' && <CheckCircle2 className="w-4 h-4" />}
                    {leave.status === 'Ditolak' && <XCircle className="w-4 h-4" />}
                    STATUS: {leave.status}
                </div>
            </div>

            {/* Grid Layout Data */}
            <div className="grid md:grid-cols-2 gap-8">
                
                {/* Kolom Kiri: Pegawai */}
                <div className="space-y-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b pb-2 mb-4">Data Pegawai</h3>
                    
                    <div className="flex items-start gap-3 group">
                        <div className="mt-1 p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                            <User className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Nama Lengkap</p>
                            <p className="text-lg font-semibold text-slate-800">{leave.profiles?.full_name || '-'}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 group">
                        <div className="mt-1 p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                            <Briefcase className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Jabatan / Posisi</p>
                            <p className="text-lg font-semibold text-slate-800">{leave.profiles?.position || '-'}</p>
                        </div>
                    </div>
                </div>

                {/* Kolom Kanan: Detail Cuti */}
                <div className="space-y-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b pb-2 mb-4">Detail Permohonan</h3>
                    
                    <div className="flex items-start gap-3 group">
                        <div className="mt-1 p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                            <Clock className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Jenis Cuti</p>
                            <p className="text-lg font-semibold text-slate-800">{leave.leave_type}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 group">
                        <div className="mt-1 p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                            <CalendarDays className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Durasi Tanggal</p>
                            <p className="text-base font-medium text-slate-800">
                                {formatDate(leave.start_date)} <span className="text-slate-400 mx-1">s/d</span> {formatDate(leave.end_date)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 group">
                        <div className="mt-1 p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                            <FileText className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Alasan / Keterangan</p>
                            <p className="text-base font-medium text-slate-800 italic">"{leave.reason || '-'}"</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Divider */}
            <hr className="border-dashed border-slate-300 my-8" />

            {/* Footer / QR Section */}
            <div className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="bg-white p-2 rounded-xl border-2 border-slate-100 shadow-sm">
                     <QRCodeCanvas value={qrValue} size={130} />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-700">Verifikasi Keaslian Dokumen</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                        Scan QR Code di atas untuk mengakses halaman validasi online dokumen ini secara langsung.
                    </p>
                </div>
                <div className="pt-4 print:hidden">
                    <Button onClick={handlePrint} variant="outline" className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900">
                        <Printer className="w-4 h-4" />
                        Cetak / Simpan PDF
                    </Button>
                </div>
            </div>

        </div>
        
        {/* Decorative Bottom Bar */}
        <div className="h-2 bg-slate-900 w-full print:hidden"></div>
      </div>
      
      {/* Copyright Footer */}
      <div className="fixed bottom-4 text-center w-full text-xs text-slate-400 print:hidden pointer-events-none">
        &copy; {new Date().getFullYear()} Sistem Informasi Kepegawaian
      </div>

    </div>
  )
}