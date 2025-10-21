'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import toast, { Toaster } from 'react-hot-toast'

const StatusBadge = ({ status }: { status: string }) => {
  const styles =
    status === 'Hadir'
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-800'

  return (
    <div className={`px-3 py-1 text-sm font-medium rounded-md ${styles}`}>
      {status}
    </div>
  )
}

export default function RekapAbsensiPage() {
  const router = useRouter()
  const [attendances, setAttendances] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const fetchData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('User tidak ditemukan')
        setLoading(false)
        return
      }

      let query = supabase
        .from('attendances')
        .select(`
          id,
          attendance_date,
          shift,
          check_in,
          check_in_location,
          check_in_latitude,
          check_in_longitude,
          check_in_distance_m,
          check_out,
          check_out_location,
          check_out_latitude,
          check_out_longitude,
          check_out_distance_m
        `)
        .eq('user_id', user.id)
        .order('attendance_date', { ascending: false })
        .order('shift', { ascending: true })

      if (startDate && endDate) {
        query = query.gte('attendance_date', startDate).lte('attendance_date', endDate)
      }

      const { data, error } = await query
      if (error) {
        console.error(error)
        toast.error('Gagal mengambil data absensi')
        setLoading(false)
        return
      }

      const processed = (data || []).map((att) => ({
        ...att,
        computedStatus: att.check_in ? 'Hadir' : 'Tidak Hadir',
      }))

      setAttendances(processed)
      setLoading(false)
    }

    fetchData()
  }, [startDate, endDate])

  const stats = useMemo(() => {
    const uniqueDates = new Set(attendances.map((a) => a.attendance_date))
    const counts = { Hadir: 0, 'Tidak Hadir': 0 }
    attendances.forEach((a) => {
      if (a.computedStatus === 'Hadir') counts.Hadir++
      else counts['Tidak Hadir']++
    })
    return { ...counts, totalHari: uniqueDates.size }
  }, [attendances])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-'
    const date = new Date(timeStr)
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const formatCoord = (lat: number | null, lon: number | null) => {
    return lat !== null && lon !== null ? `${lat.toFixed(6)}, ${lon.toFixed(6)}` : '-'
  }

  const formatDistance = (dist: number | null) => (dist !== null ? `${dist.toFixed(1)} m` : '-')

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <Toaster position="top-center" />

      <header className="bg-blue-800 text-white p-4 shadow-md flex items-center sticky top-0 z-10">
        {mounted && (
          <button onClick={() => router.back()} className="p-2 mr-2 rounded-full hover:bg-blue-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="text-xl font-bold">Rekap Absensi</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <section className="bg-white rounded-lg shadow p-4 mb-5">
          <h2 className="text-gray-500 font-semibold mb-3 text-sm">Filter Periode</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400">Dari Tanggal</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-transparent text-gray-700 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Sampai Tanggal</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-transparent text-gray-700 focus:outline-none" />
            </div>
          </div>
        </section>

        <section className="bg-green-50 border border-green-200 rounded-lg shadow p-4 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Statistik Kehadiran</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-gray-700">
            <div className="flex justify-between"><span>Total Hari</span><span className="font-semibold">{stats.totalHari}</span></div>
            <div className="flex justify-between"><span>Hadir</span><span className="font-semibold">{stats.Hadir}</span></div>
            <div className="flex justify-between"><span>Tidak Hadir</span><span className="font-semibold">{stats['Tidak Hadir']}</span></div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-4">Riwayat Absensi</h2>
          {loading ? (
            <p className="text-center text-gray-500 py-8">Memuat data...</p>
          ) : attendances.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg shadow">
              <p className="text-gray-500">Tidak ada data untuk ditampilkan.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendances.map((att) => (
                <div key={`${att.attendance_date}-${att.shift}`} className="bg-white rounded-lg shadow p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-gray-900">{formatDate(att.attendance_date)} ({att.shift})</p>
                    <StatusBadge status={att.computedStatus} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>
                      <p className="font-medium">Masuk</p>
                      <p>Waktu: {formatTime(att.check_in)}</p>
                      <p>Lokasi: {att.check_in_location || '-'}</p>
                      <p>Koordinat: {formatCoord(att.check_in_latitude, att.check_in_longitude)}</p>
                      <p>Jarak: {formatDistance(att.check_in_distance_m)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Pulang</p>
                      <p>Waktu: {att.check_out ? formatTime(att.check_out) : '-'}</p>
                      <p>Lokasi: {att.check_out_location || '-'}</p>
                      <p>Koordinat: {formatCoord(att.check_out_latitude, att.check_out_longitude)}</p>
                      <p>Jarak: {formatDistance(att.check_out_distance_m)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {mounted && (
          <div className="mt-8 pb-4">
            <button onClick={() => router.push('/dashboard')}
              className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
              Kembali ke Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
