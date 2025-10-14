'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import toast, { Toaster } from 'react-hot-toast'

// Komponen untuk badge status berwarna
const StatusBadge = ({ status }: { status: string }) => {
  let styles = ''
  switch (status) {
    case 'Hadir':
      styles = 'bg-green-100 text-green-800'
      break
    case 'Terlambat':
      styles = 'bg-yellow-100 text-yellow-800'
      break
    case 'Tidak Hadir':
    case 'Alfa':
      styles = 'bg-red-100 text-red-800'
      status = 'Tidak Hadir'
      break
    default:
      styles = 'bg-gray-100 text-gray-800'
      status = 'Tidak Hadir'
  }
  return (
    <div className={`px-3 py-1 text-sm font-medium rounded-md ${styles}`}>
      {status}
    </div>
  )
}

export default function RekapAbsensiPage() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Ambil data logbook
  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast.error('User tidak ditemukan')
      setLoading(false)
      return
    }

    let query = supabase
      .from('logbooks')
      .select('id, log_date, start_time, end_time, status')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false })

    if (startDate && endDate) {
      query = query.gte('log_date', startDate).lte('log_date', endDate)
    }

    const { data: logbooks, error } = await query

    if (error) {
      console.error(error)
      toast.error('Gagal mengambil data absensi')
    } else {
      setData(logbooks || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchData()
    }
  }, [startDate, endDate])

  // Hitung statistik (hanya 3 status)
  const stats = useMemo(() => {
    const counts = { Hadir: 0, Terlambat: 0, 'Tidak Hadir': 0 }
    data.forEach((log) => {
      if (log.status === 'Hadir') counts.Hadir++
      else if (log.status === 'Terlambat') counts.Terlambat++
      else counts['Tidak Hadir']++
    })
    return { ...counts, totalHari: data.length }
  }, [data])

  // Format tanggal Indonesia
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="bg-blue-800 text-white p-4 shadow-md flex items-center sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="p-2 mr-2 rounded-full hover:bg-blue-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">Rekap Absensi</h1>
      </header>

      {/* Konten */}
      <main className="p-4 max-w-lg mx-auto">
        {/* Filter Periode */}
        <section className="bg-white rounded-lg shadow p-4 mb-5">
          <h2 className="text-gray-500 font-semibold mb-3 text-sm">Filter Periode</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400">Dari Tanggal</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-transparent text-gray-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Sampai Tanggal</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-transparent text-gray-700 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Statistik */}
        <section className="bg-green-50 border border-green-200 rounded-lg shadow p-4 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Statistik Kehadiran</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-gray-700">
            <div className="flex justify-between"><span>Total Hari</span><span className="font-semibold">{stats.totalHari}</span></div>
            <div className="flex justify-between"><span>Hadir</span><span className="font-semibold">{stats.Hadir}</span></div>
            <div className="flex justify-between"><span>Terlambat</span><span className="font-semibold">{stats.Terlambat}</span></div>
            <div className="flex justify-between"><span>Tidak Hadir</span><span className="font-semibold">{stats['Tidak Hadir']}</span></div>
          </div>
        </section>

        {/* Riwayat */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-4">Riwayat Absensi</h2>
          {loading ? (
            <p className="text-center text-gray-500 py-8">Memuat data...</p>
          ) : data.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg shadow">
              <p className="text-gray-500">Tidak ada data untuk ditampilkan.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((log) => (
                <div key={log.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900">{formatDate(log.log_date)}</p>
                    <p className="text-sm text-gray-500">
                      Masuk: {log.start_time?.slice(0, 5) || '-'} Pulang: {log.end_time?.slice(0, 5) || '-'}
                    </p>
                  </div>
                  <StatusBadge status={log.status || 'Tidak Hadir'} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tombol Kembali */}
        <div className="mt-8 pb-4">
          <button
            onClick={() => router.push('/Dashboard')}
            className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </main>
    </div>
  )
}
