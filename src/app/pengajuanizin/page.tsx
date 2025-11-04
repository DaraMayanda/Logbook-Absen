'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { ArrowLeft, Loader2, Upload } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

// Tipe data (Tidak berubah)
type PermissionRequest = {
  id: number
  jenis_izin: string
  tanggal_mulai: string
  tanggal_selesai: string
  alasan: string
  lampiran_url: string | null
  status: string
  created_at: string
  durasi_hari_kerja?: number
  potong_gaji?: boolean
}

export default function PengajuanIzinPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [jenisIzin, setJenisIzin] = useState('')
  const [tanggalMulai, setTanggalMulai] = useState('')
  const [tanggalSelesai, setTanggalSelesai] = useState('')
  const [alasan, setAlasan] = useState('')
  const [lampiran, setLampiran] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [izinRequests, setIzinRequests] = useState<PermissionRequest[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => setMounted(true), [])

  // AMBIL USER (Tidak berubah)
  useEffect(() => {
    if (!mounted) return
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
    }
    fetchUser()
  }, [mounted, router])

  // FETCH RIWAYAT (Tidak berubah)
  const fetchIzinRequests = async () => {
    if (!userId) return

    const { data: requests, error } = await supabase
      .from('permission_requests')
      .select('id, jenis_izin, tanggal_mulai, tanggal_selesai, alasan, lampiran_url, status, created_at, durasi_hari_kerja, potong_gaji')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching izin:', error.message)
      return
    }

    if (!requests || requests.length === 0) {
      setIzinRequests([])
      return
    }

    const { data: approvals } = await supabase
      .from('permission_approvals')
      .select('permission_request_id, level, status')
      .in('permission_request_id', requests.map(r => r.id))

    const merged = requests.map((req: PermissionRequest) => {
      const level2 = approvals?.find(a => a.permission_request_id === req.id && a.level === 2)
      const level1 = approvals?.find(a => a.permission_request_id === req.id && a.level === 1)

      let finalStatus = req.status
      if (level2?.status === 'Disetujui') finalStatus = 'Disetujui'
      else if (level2?.status === 'Ditolak') finalStatus = 'Ditolak'
      else if (level1?.status === 'Ditolak') finalStatus = 'Ditolak'
      else if (level1?.status === 'Disetujui') finalStatus = 'Menunggu Persetujuan Kepala'

      return { ...req, status: finalStatus }
    })

    setIzinRequests(merged)
  }

  useEffect(() => { fetchIzinRequests() }, [userId])


  // =================== SUBMIT PENGAJUAN (LOGIKA DIPERBAIKI) ===================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!jenisIzin || !tanggalMulai || !tanggalSelesai || !alasan)
      return toast.error('Semua field wajib diisi')
    if (!userId) return toast.error('User belum terdeteksi')

    setLoading(true)

    try {
      // 1. Upload lampiran jika ada
      let lampiranUrl: string | null = null
      if (lampiran) {
        const loadingToast = toast.loading('Mengupload lampiran...');
        const fileExt = lampiran.name.split('.').pop()
        const fileName = `${Date.now()}_${userId}.${fileExt}`
        const filePath = `izin_lampiran/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('lampiran_izin')
          .upload(filePath, lampiran);

        if (uploadError) throw uploadError

        const { data: publicUrl } = supabase.storage
          .from('lampiran_izin')
          .getPublicUrl(filePath)

        lampiranUrl = publicUrl.publicUrl
        toast.dismiss(loadingToast);
      }

      // 2. Panggil RPC
      const { data, error: rpcError } = await supabase.rpc('submit_permission_request', {
        p_user_id: userId,
        p_jenis_izin: jenisIzin,
        p_tanggal_mulai: tanggalMulai,
        p_tanggal_selesai: tanggalSelesai,
        p_alasan: alasan,
        p_lampiran_url: lampiranUrl
      })

      if (rpcError) throw rpcError; // Menangkap error jaringan/SQL
      
      const rpcData = data?.[0];

      // --- INI PERBAIKANNYA ---
      // Cek apakah request_id GAGAL (NULL), BUKAN apakah error_message ADA
      if (!rpcData || rpcData.request_id === null) {
        // Jika request_id null, BARU lempar error
        throw new Error(rpcData?.error_message || 'Gagal mengajukan izin');
      }
      // --- AKHIR PERBAIKAN ---

      // Jika lolos, berarti SUKSES
      toast.success(rpcData.error_message || 'Pengajuan izin berhasil dikirim')
      setJenisIzin('')
      setTanggalMulai('')
      setTanggalSelesai('')
      setAlasan('')
      setLampiran(null)
      fetchIzinRequests()

    } catch (error: any) {
      // Sekarang, 'catch' ini hanya akan menangkap error yang sesungguhnya
      console.error('Error submitting izin:', error.message)
      toast.error(error.message || 'Gagal mengirim pengajuan')
    } finally {
      setLoading(false)
    }
  }

  const filteredRequests = izinRequests.filter((r) =>
    (r.jenis_izin && r.jenis_izin.toLowerCase().includes(search.toLowerCase())) ||
    (r.alasan && r.alasan.toLowerCase().includes(search.toLowerCase())) ||
    (r.status && r.status.toLowerCase().includes(search.toLowerCase()))
  )

  if (!mounted) return null

  // =================== UI (Tidak Berubah) ===================
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <Toaster position="top-center" />
      <div className="flex items-center mb-6 space-x-2 text-blue-700 hover:text-blue-900 transition cursor-pointer"
           onClick={() => router.push('/dashboard')}>
        <ArrowLeft size={22} />
        <h1 className="text-xl sm:text-2xl font-semibold">Pengajuan Izin</h1>
      </div>

      {/* FORM */}
      <Card className="mb-8 shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl font-semibold text-gray-800">
            Formulir Pengajuan Izin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Jenis Izin */}
            <div>
              <label className="font-medium">Jenis Izin</label>
              <select
                className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                value={jenisIzin}
                onChange={(e) => setJenisIzin(e.target.value)}
              >
                <option value="">Pilih Jenis Izin...</option>
                <option value="Lupa Absen Masuk">Lupa Absen Masuk</option>
                <option value="Lupa Absen Pulang">Lupa Absen Pulang</option>
                <option value="Meninggalkan Kantor">Meninggalkan Kantor (Keperluan Pribadi)</option>
                <option value="Keperluan Mendesak (Pribadi)">Keperluan Mendesak (Pribadi)</option>
                <option value="Sakit (Tanpa Kuota Cuti)">Sakit (Tanpa Kuota Cuti Tahunan)</option>
                <option value="Perjalanan Dinas">Perjalanan Dinas</option>
              </select>
            </div>

            {/* Tanggal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-medium">Tanggal Mulai</label>
                <input type="date" className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                       value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} />
              </div>
              <div>
                <label className="font-medium">Tanggal Selesai</label>
                <input type="date" className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                       value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} />
              </div>
            </div>

            {/* Alasan */}
            <div>
              <label className="font-medium">Alasan / Keterangan</label>
              <textarea className="w-full border p-2 rounded-md focus:ring-2 focus:ring-blue-500"
                        value={alasan} onChange={(e) => setAlasan(e.target.value)}
                        placeholder="Tuliskan alasan/keterangan izin..." />
            </div>

            {/* Lampiran */}
            <div>
              <label className="font-medium">Lampiran (Opsional)</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setLampiran(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload bukti (jika ada). Misal: Surat Sakit, Surat Tugas Dinas, dll.
              </p>
            </div>

            <button type="submit"
                    className="w-full bg-blue-700 text-white p-2 rounded-md hover:bg-blue-800 transition flex items-center justify-center"
                    disabled={loading}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Ajukan Izin'}
            </button>
          </form>
        </CardContent>
      </Card>

      {/* RIWAYAT */}
      <Card className="shadow-sm border border-gray-200">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <CardTitle className="text-lg font-semibold text-gray-800">Riwayat Pengajuan Izin</CardTitle>
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
            <p className="text-gray-600 text-sm text-center py-2">Belum ada pengajuan izin</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-center border-collapse">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="p-2 border">Jenis Izin</th>
                    <th className="p-2 border">Tanggal</th>
                    <th className="p-2 border">Durasi</th>
                    <th className="p-2 border">Potong Gaji</th>
                    <th className="p-2 border">Lampiran</th>
                    <th className="p-2 border">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition">
                      <td className="p-2 border">{r.jenis_izin}</td>
                      <td className="p-2 border">
                        {r.tanggal_mulai} – {r.tanggal_selesai}
                      </td>
                      <td className="p-2 border">
                        {r.durasi_hari_kerja ?? '?'} Hari
                      </td>
                      <td className="p-2 border">
                        {r.potong_gaji ? 'Ya' : 'Tidak'}
                      </td>
                      <td className="p-2 border">
                        {r.lampiran_url ? (
                          <a href={r.lampiran_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            Lihat
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-2 border">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          r.status === 'Disetujui'
                            ? 'bg-green-200 text-green-800'
                            : r.status === 'Ditolak'
                            ? 'bg-red-200 text-red-800'
                            : 'bg-yellow-200 text-yellow-800'
                        }`}>
                          {r.status}
                        </span>
                      </td>
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