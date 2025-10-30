'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, FileSpreadsheet } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import * as XLSX from 'xlsx'

type Attendance = {
  id: number
  user_id: string
  attendance_date: string
  shift: string
  shift_start: string | null
  shift_end: string | null
  check_in: string | null
  check_out: string | null
  check_in_location: string | null
  check_out_location: string | null
  full_name?: string
  position?: string
  status?: 'Hadir' | 'Tidak Hadir'
  terlambat?: 'Ya' | 'Tidak'
}

type Profile = {
  id: string
  full_name: string
  position: string
}

const StatusBadge = ({ status }: { status?: string }) => {
  const styles =
    status === 'Hadir'
      ? 'bg-green-50 text-green-600'
      : 'bg-red-50 text-red-600'

  return <div className={`px-3 py-1 text-sm font-medium rounded-md ${styles}`}>{status || '-'}</div>
}

const TerlambatBadge = ({ terlambat }: { terlambat?: string }) => {
  const styles =
    terlambat === 'Ya'
      ? 'bg-yellow-50 text-yellow-800'
      : 'bg-green-50 text-green-600'

  return <div className={`px-3 py-1 text-sm font-medium rounded-md ${styles}`}>{terlambat || '-'}</div>
}

export default function RekapAbsensiAdmin() {
  const router = useRouter()
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [filtered, setFiltered] = useState<Attendance[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const [searchName, setSearchName] = useState<string>('')
  const [filterDate, setFilterDate] = useState<string>('')
  const [filterMonth, setFilterMonth] = useState<string>('')
  const [filterYear, setFilterYear] = useState<string>('')

  // =====================================================
  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendances')
        .select('*')
        .order('attendance_date', { ascending: false })
      if (attendanceError) throw attendanceError
      if (!attendanceData) throw new Error('Data absensi kosong')

      const userIds = Array.from(new Set(attendanceData.map((a: any) => a.user_id)))
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)
      if (profileError) throw profileError
      if (!profileData) throw new Error('Data profile kosong')

      const merged = attendanceData.map((att: any) => {
        const profile = profileData.find((p: Profile) => p.id === att.user_id)
        const status: 'Hadir' | 'Tidak Hadir' = att.check_in ? 'Hadir' : 'Tidak Hadir'

        // Hitung Terlambat
        let terlambat: 'Ya' | 'Tidak' = 'Tidak'
        if (att.check_in) {
          const checkInDate = new Date(att.check_in)
          const checkInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes()
          if (att.shift.toLowerCase() === 'pagi' && checkInMinutes > 8 * 60) terlambat = 'Ya'
          if (att.shift.toLowerCase() === 'malam' && checkInMinutes > 18 * 60) terlambat = 'Ya'
        }

        return {
          ...att,
          full_name: profile?.full_name || '-',
          position: profile?.position || '-',
          status,
          terlambat
        }
      })

      setAttendances(merged)
      setFiltered(merged)
    } catch (err: any) {
      console.error('❌ Gagal mengambil data absensi:', err.message || err)
      toast.error('❌ Gagal mengambil data absensi. Cek console untuk detail.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // =====================================================
  useEffect(() => {
    let temp = [...attendances]
    if (searchName.trim()) temp = temp.filter(a => a.full_name?.toLowerCase().includes(searchName.toLowerCase()))
    if (filterDate) temp = temp.filter(a => a.attendance_date === filterDate)
    if (filterMonth) temp = temp.filter(a => a.attendance_date.startsWith(filterMonth))
    if (filterYear) temp = temp.filter(a => a.attendance_date.startsWith(filterYear))
    setFiltered(temp)
  }, [searchName, filterDate, filterMonth, filterYear, attendances])

  // =====================================================
  const formatDate = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleDateString('id-ID') : '-'
  const formatDateTime = (dateStr: string | null) => dateStr ? new Date(dateStr).toLocaleString('id-ID') : '-'

  const statsPerEmployee = useMemo(() => {
    const map: Record<string, { Hadir: number; TidakHadir: number }> = {}
    attendances.forEach(a => {
      const name = a.full_name || '-'
      if (!map[name]) map[name] = { Hadir: 0, TidakHadir: 0 }
      if (a.status === 'Hadir') map[name].Hadir++
      else map[name].TidakHadir++
    })
    return map
  }, [attendances])

  // =====================================================
  const exportToExcel = () => {
  if (!filtered || filtered.length === 0) {
    toast.error('Data kosong, tidak bisa di-export')
    return
  }

  const data = filtered.map((att, i) => ({
    No: i + 1,
    Nama: att.full_name || '-',
    Posisi: att.position || '-',
    Tanggal: formatDate(att.attendance_date),
    Shift: att.shift,
    'Check In': formatDateTime(att.check_in),
    'Check Out': formatDateTime(att.check_out),
    Status: att.status,
    Terlambat: att.terlambat,
    'Lokasi Masuk': att.check_in_location || '-',
    'Lokasi Keluar': att.check_out_location || '-',
  }))

  const ws = XLSX.utils.json_to_sheet(data)

  // Auto-width kolom
  const colWidths = Object.keys(data[0]).map(key => ({
    wch: Math.max(
      key.length + 2,
      ...data.map(row => String((row as any)[key] ?? '').length + 2) // <-- pakai 'as any'
    )
  }))
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi')
  XLSX.writeFile(wb, `Rekap_Absensi_${new Date().toISOString().slice(0,10)}.xlsx`)
}


  // =====================================================
  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
  <Toaster position="top-center" />

  {/* Tombol Header */}
  <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
    {/* Tombol Kembali */}
    <Button
      onClick={() => router.push('/dashboardadmin')}
      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md w-full sm:w-auto justify-center shadow-sm"
    >
      <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
    </Button>

    {/* Tombol Export */}
    <Button
      onClick={exportToExcel}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md w-full sm:w-auto justify-center shadow-sm"
    >
      <FileSpreadsheet className="w-4 h-4" /> Export Excel
    </Button>
  </div>


      {/* Filter */}
      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="text"
          placeholder="Cari nama pegawai..."
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-52 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="month"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-52 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="number"
          placeholder="Tahun"
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-32 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={fetchData}>
          Refresh
        </Button>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {Object.entries(statsPerEmployee).map(([name, stats]) => (
          <Card key={name} className="border shadow-sm">
            <CardHeader className="bg-gray-100 text-gray-800">
              <CardTitle>{name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Hadir: {stats.Hadir}</p>
              <p>Tidak Hadir: {stats.TidakHadir}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="border shadow-sm">
        <CardHeader className="bg-gray-100 text-gray-800">
          <CardTitle>Data Absensi</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="animate-spin h-6 w-6 text-blue-700" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500">Tidak ada data absensi.</p>
          ) : (
            <div className="w-full overflow-x-auto rounded-md">
              <table className="min-w-[900px] sm:min-w-full table-auto border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100 text-gray-800">
                    <th className="border px-4 py-2">Nama</th>
                    <th className="border px-4 py-2">Posisi</th>
                    <th className="border px-4 py-2">Tanggal</th>
                    <th className="border px-4 py-2">Shift</th>
                    <th className="border px-4 py-2">Check In</th>
                    <th className="border px-4 py-2">Check Out</th>
                    <th className="border px-4 py-2">Status</th>
                    <th className="border px-4 py-2">Terlambat</th>
                    <th className="border px-4 py-2">Lokasi Masuk</th>
                    <th className="border px-4 py-2">Lokasi Keluar</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(att => (
                    <tr
                      key={att.id}
                      className={`hover:bg-gray-50 ${att.status === 'Hadir' ? 'bg-green-50' : 'bg-red-50'}`}
                    >
                      <td className="border px-4 py-2 max-w-xs break-words">{att.full_name}</td>
                      <td className="border px-4 py-2 max-w-xs break-words">{att.position}</td>
                      <td className="border px-4 py-2">{formatDate(att.attendance_date)}</td>
                      <td className="border px-4 py-2">{att.shift}</td>
                      <td className="border px-4 py-2">{formatDateTime(att.check_in)}</td>
                      <td className="border px-4 py-2">{formatDateTime(att.check_out)}</td>
                      <td className="border px-4 py-2"><StatusBadge status={att.status} /></td>
                      <td className="border px-4 py-2"><TerlambatBadge terlambat={att.terlambat} /></td>
                      <td className="border px-4 py-2 max-w-xs break-words">{att.check_in_location || '-'}</td>
                      <td className="border px-4 py-2 max-w-xs break-words">{att.check_out_location || '-'}</td>
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
