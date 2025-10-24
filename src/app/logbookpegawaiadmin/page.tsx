'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { RefreshCw, Printer, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Task {
  task_id: number
  task_name: string
  logbook_id: number
}

interface Attendance {
  attendance_id: number
  attendance_date: string
  shift?: string
  check_in?: string
  check_out?: string
  status?: string
  profile_id: string
  full_name?: string
  position?: string
  tasks: Task[]
}

export default function LogbookPegawaiAdminPage() {
  const router = useRouter()
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('attendances')
        .select(`
          id,
          attendance_date,
          shift,
          check_in,
          check_out,
          status,
          profiles!fk_user(id, full_name, position),
          tasks:tasks(
            id,
            task_name,
            logbook_id
          )
        `)
        .order('attendance_date', { ascending: false })
      if (error) throw error

      const mapped = data.map((row: any) => ({
        attendance_id: row.id,
        attendance_date: row.attendance_date,
        shift: row.shift,
        check_in: row.check_in,
        check_out: row.check_out,
        status: row.status,
        profile_id: row.profiles?.id,
        full_name: row.profiles?.full_name || '-',
        position: row.profiles?.position || '-',
        tasks: row.tasks || []
      }))
      setAttendances(mapped)
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredData = attendances.filter(a =>
    a.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.position?.toLowerCase().includes(search.toLowerCase()) ||
    a.status?.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    const bulan = [
      'Januari','Februari','Maret','April','Mei','Juni',
      'Juli','Agustus','September','Oktober','November','Desember'
    ]
    return `${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}`
  }

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '-'
    return new Date(timeStr).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const handlePrint = (row: Attendance) => {
    const win = window.open('', '_blank')
    if (!win) return

    const tasksHtml = row.tasks.length
      ? '<ul>' + row.tasks.map(t => `<li>${t.task_name}</li>`).join('') + '</ul>'
      : '<p>-</p>'

    const jamMulai = formatTime(row.check_in)
    const jamSelesai = formatTime(row.check_out)
    const keterangan = row.shift || '-'

    win.document.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Cetak Logbook Pegawai</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; }
          table { width: 100%; margin-bottom: 15px; }
          td { padding: 4px 0; vertical-align: top; }
          .label { font-weight: bold; width: 100px; }
          .separator { width: 10px; }
          ul { padding-left: 20px; margin-top: 5px; }
        </style>
      </head>
      <body>
        <h1>Laporan Harian Pegawai (Logbook)</h1>
        <table>
          <tr><td class="label">Nama</td><td class="separator">:</td><td>${row.full_name}</td></tr>
          <tr><td class="label">Jabatan</td><td class="separator">:</td><td>${row.position}</td></tr>
          <tr><td class="label">Tanggal</td><td class="separator">:</td><td>${formatDate(row.attendance_date)}</td></tr>
          <tr><td class="label">Jam</td><td class="separator">:</td><td>${jamMulai} s.d ${jamSelesai}</td></tr>
        </table>
        <div><strong>Uraian Pekerjaan:</strong></div>
        ${tasksHtml}
        <div><strong>Keterangan:</strong> ${keterangan}</div>
      </body>
      </html>
    `)
    win.document.close()
    win.print()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen justify-center items-center text-gray-600">
        <RefreshCw className="animate-spin mr-2" /> Memuat data logbook...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <button
        onClick={() => router.push('/dashboardadmin')}
        className="mb-4 flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        <ArrowLeft size={18} /> Kembali ke Dashboard
      </button>

      <h1 className="text-2xl font-bold mb-4 text-gray-800">Logbook Pegawai</h1>

      <input
        type="text"
        placeholder="Cari nama, jabatan, atau status..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-4 w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="overflow-x-auto bg-white rounded-xl shadow-md">
        <table className="w-full border-collapse">
          <thead className="bg-blue-100 text-gray-700">
            <tr>
              <th className="p-3 text-left">Nama</th>
              <th className="p-3 text-left">Jabatan</th>
              <th className="p-3 text-left">Tanggal</th>
              <th className="p-3 text-left">Shift</th>
              <th className="p-3 text-left">Check-in</th>
              <th className="p-3 text-left">Check-out</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Uraian Kerja</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-4 text-gray-500">Tidak ada data ditemukan</td></tr>
            ) : (
              filteredData.map(row => (
                <tr key={row.attendance_id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{row.full_name}</td>
                  <td className="p-3">{row.position}</td>
                  <td className="p-3">{formatDate(row.attendance_date)}</td>
                  <td className="p-3">{row.shift || '-'}</td>
                  <td className="p-3">{formatTime(row.check_in)}</td>
                  <td className="p-3">{formatTime(row.check_out)}</td>
                  <td className="p-3">{row.status || '-'}</td>
                  <td className="p-3">
                    {row.tasks.length
                      ? <ul className="list-disc pl-5 space-y-1">
                          {row.tasks.map((t,i) => <li key={i}>{t.task_name}</li>)}
                        </ul>
                      : '-'}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handlePrint(row)}
                      className="p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition"
                    >
                      <Printer size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
