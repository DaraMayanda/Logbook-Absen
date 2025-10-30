'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { RefreshCw, Printer, ArrowLeft, FileSpreadsheet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

interface Attendance {
  id: number
  attendance_date: string
  shift?: string
  status?: string
  full_name: string
  position: string
  uraian_kerja: string
}

export default function LogbookPegawaiAdminPage() {
  const router = useRouter()
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_logbook_with_tasks')
      if (error) throw error
      setAttendances(data || [])

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

  const handlePrint = (row: Attendance) => {
  const win = window.open('', '_blank')
  if (!win) return

  // Format uraian_kerja jadi bernomor dan baris baru
  const formattedTasks = row.uraian_kerja
    ? row.uraian_kerja
        .split(';')
        .map((t, i) => `${i + 1}. ${t.trim()}`)
        .join('<br>')
    : '-'

  win.document.write(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Cetak Logbook Pegawai</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
        h1 { text-align: center; margin-bottom: 25px; }
        table { width: 100%; margin-bottom: 15px; }
        td { padding: 4px 0; vertical-align: top; }
        .label { font-weight: bold; width: 100px; }
        .separator { width: 10px; }
        .uraian { margin-top: 10px; }
      </style>
    </head>
    <body>
      <h1>Laporan Harian Pegawai (Logbook)</h1>
      <table>
        <tr><td class="label">Nama</td><td class="separator">:</td><td>${row.full_name}</td></tr>
        <tr><td class="label">Jabatan</td><td class="separator">:</td><td>${row.position}</td></tr>
        <tr><td class="label">Tanggal</td><td class="separator">:</td><td>${formatDate(row.attendance_date)}</td></tr>
        <tr><td class="label">Shift</td><td class="separator">:</td><td>${row.shift || '-'}</td></tr>
        <tr><td class="label">Status</td><td class="separator">:</td><td>${row.status || '-'}</td></tr>
      </table>
      <div class="uraian">
        <strong>Uraian Pekerjaan:</strong><br>
        ${formattedTasks}
      </div>
    </body>
    </html>
  `)
  win.document.close()
  win.print()
}


 const exportToExcel = () => {
  if (!attendances || attendances.length === 0) return

  // 1️⃣ Mapping data untuk Excel
  const exportData: { [key: string]: any }[] = attendances.map((a, i) => ({
    No: i + 1,
    Nama: a.full_name ?? '',
    Jabatan: a.position ?? '',
    Tanggal: formatDate(a.attendance_date ?? ''),
    Shift: a.shift ?? '-',
    Status: a.status ?? '-',
    'Uraian Kerja': a.uraian_kerja ?? '-',
  }))

  // 2️⃣ Buat worksheet dari JSON
  const ws = XLSX.utils.json_to_sheet(exportData)

  // 3️⃣ Hitung lebar kolom otomatis
  const colWidths = Object.keys(exportData[0]).map((key) => ({
    wch: Math.max(
      key.length + 2,
      ...exportData.map((row) => String(row[key] ?? '').length + 2)
    ),
  }))
  ws['!cols'] = colWidths

  // 4️⃣ Rapiin teks: center + wrapText
  const range = XLSX.utils.decode_range(ws['!ref']!)
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
      if (!ws[cellAddress]) continue
      if (!ws[cellAddress].s) ws[cellAddress].s = {}
      ws[cellAddress].s = {
        alignment: {
          vertical: 'center',
          horizontal: 'center',
          wrapText: true,
        },
      }
    }
  }

  // 5️⃣ Buat workbook & simpan file
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Logbook Pegawai')
  XLSX.writeFile(wb, 'Logbook_Pegawai.xlsx')
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
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => router.push('/dashboardadmin')}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          <ArrowLeft size={18} /> Kembali ke Dashboard
        </button>

        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-all duration-200"
        >
          <FileSpreadsheet size={18} className="text-white" /> Export Excel
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-4 text-gray-800">Logbook Pegawai</h1>

      <input
        type="text"
        placeholder="Cari nama, jabatan, atau status..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-4 w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

     <div className="w-full overflow-x-auto rounded-xl shadow-sm bg-white pb-3">
  <table className="min-w-[900px] sm:min-w-full border-collapse text-sm">

          <thead className="bg-gray-100 text-gray-800">
            <tr>
              <th className="p-3 text-left">Nama</th>
              <th className="p-3 text-left">Jabatan</th>
              <th className="p-3 text-left">Tanggal</th>
              <th className="p-3 text-left">Shift</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Uraian Kerja</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-4 text-gray-500">
                  Tidak ada data ditemukan
                </td>
              </tr>
            ) : (
              filteredData.map(row => (
                <tr key={row.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{row.full_name}</td>
                  <td className="p-3">{row.position}</td>
                  <td className="p-3">{formatDate(row.attendance_date)}</td>
                  <td className="p-3">{row.shift || '-'}</td>
                  <td className="p-3">{row.status || '-'}</td>
                 <td
  className="p-3 whitespace-pre-line"
  dangerouslySetInnerHTML={{
    __html: row.uraian_kerja
      ? row.uraian_kerja
          .split(';')
          .map((t, i) => `${i + 1}. ${t.trim()}`)
          .join('<br>')
      : '-'
  }}
/>


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
