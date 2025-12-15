'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { RefreshCw, Printer, ArrowLeft, FileSpreadsheet, ChevronLeft, ChevronRight, Search, Calendar, ListFilter } from 'lucide-react'
import { useRouter } from 'next/navigation'
import XLSX from 'xlsx-js-style'

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
  const [loading, setLoading] = useState(true)

  // State Filter & Pagination
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<'daily' | 'monthly'>('daily') // Default mode harian
  const [selectedDate, setSelectedDate] = useState('') // Untuk filter harian (YYYY-MM-DD)
  const [selectedMonth, setSelectedMonth] = useState('') // Untuk filter bulanan (YYYY-MM)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5 // UBAH: Batasi 5 data per halaman

  // Set default tanggal hari ini saat pertama kali load
  useEffect(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    
    setSelectedDate(`${yyyy}-${mm}-${dd}`)
    setSelectedMonth(`${yyyy}-${mm}`)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_logbook_with_tasks')
      if (error) throw error
      // Urutkan data dari yang terbaru
      const sortedData = (data || []).sort((a: Attendance, b: Attendance) => 
        new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime()
      )
      setAttendances(sortedData)
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // --- LOGIKA FILTERING UTAMA ---
  const filteredData = attendances.filter(a => {
    // 1. Filter Nama / Jabatan / Status
    const matchSearch = 
      a.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.position?.toLowerCase().includes(search.toLowerCase()) ||
      a.status?.toLowerCase().includes(search.toLowerCase())

    // 2. Filter Waktu (Harian atau Bulanan)
    let matchTime = true
    const itemDate = new Date(a.attendance_date).toISOString().split('T')[0] // Ambil YYYY-MM-DD

    if (filterMode === 'daily' && selectedDate) {
      // Cocokkan tanggal persis
      matchTime = itemDate === selectedDate
    } else if (filterMode === 'monthly' && selectedMonth) {
      // Cocokkan Bulan & Tahun (YYYY-MM)
      matchTime = itemDate.startsWith(selectedMonth)
    }

    return matchSearch && matchTime
  })

  // --- LOGIKA PAGINATION ---
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem)

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

  // Reset page ke 1 jika filter berubah
  useEffect(() => {
    setCurrentPage(1)
  }, [search, filterMode, selectedDate, selectedMonth])

  // Helper Format Tanggal Indonesia
  const formatDateIndo = (dateStr?: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  // Helper Format Bulan Indonesia (YYYY-MM -> "Januari 2025")
  const formatMonthIndo = (monthStr: string) => {
    if (!monthStr) return '-'
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }

  // --- EXPORT EXCEL RAPI BERWARNA ---
  const exportToExcel = () => {
    if (filteredData.length === 0) return alert('Tidak ada data untuk diekspor pada filter ini.')

    // 1. Siapkan Judul Periode
    let periodeLabel = ''
    if (filterMode === 'daily') {
      periodeLabel = `Tanggal: ${formatDateIndo(selectedDate)}`
    } else {
      periodeLabel = `Bulan: ${formatMonthIndo(selectedMonth)}`
    }

    // 2. Siapkan Data
    const exportData = filteredData.map((a, i) => ({
      No: i + 1,
      Nama: a.full_name ?? '',
      Jabatan: a.position ?? '',
      Tanggal: formatDateIndo(a.attendance_date ?? ''),
      Shift: a.shift ? a.shift.toUpperCase() : '-',
      Status: a.status ?? '-',
      'Uraian Kerja': a.uraian_kerja ? a.uraian_kerja.replace(/;/g, '\n') : '-',
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet([])

    // 3. Header Custom
    XLSX.utils.sheet_add_aoa(ws, [
      ['REKAPITULASI LOGBOOK HARIAN PEGAWAI'],
      [periodeLabel],
      ['']
    ], { origin: 'A1' })

    // Merge Judul
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Baris 1
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }  // Baris 2
    ]

    // 4. Masukkan Data
    XLSX.utils.sheet_add_json(ws, exportData, { origin: 'A4', skipHeader: false })

    // 5. Styling Lebar Kolom
    const colWidths = [
      { wch: 5 },  // No
      { wch: 25 }, // Nama
      { wch: 20 }, // Jabatan
      { wch: 18 }, // Tanggal
      { wch: 10 }, // Shift
      { wch: 10 }, // Status
      { wch: 50 }  // Uraian
    ]
    ws['!cols'] = colWidths

    // 6. Styling Cell
    const range = XLSX.utils.decode_range(ws['!ref']!)
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
        if (!ws[cellAddress]) continue
        
        // Default Style
        ws[cellAddress].s = {
          font: { name: 'Arial', sz: 10 },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          },
          alignment: { vertical: 'top', wrapText: true }
        }

        // Header Utama
        if (R === 0) {
          ws[cellAddress].s = {
            font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1E40AF" } },
            alignment: { horizontal: 'center', vertical: 'center' }
          }
        }
        // Sub Header Periode
        else if (R === 1) {
          ws[cellAddress].s = {
            font: { italic: true, sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center' }
          }
        }
        // Header Tabel
        else if (R === 3) {
          ws[cellAddress].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4A90E2" } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: { top: { style: "medium" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } }
          }
        }
        // Data Tengah
        else if (R > 3) {
           if ([0, 3, 4, 5].includes(C)) { // Kolom No, Tanggal, Shift, Status Center
             ws[cellAddress].s.alignment.horizontal = 'center'
           }
        }
      }
    }

    const fileName = filterMode === 'daily' 
      ? `Logbook_${selectedDate}.xlsx` 
      : `Logbook_Bulan_${selectedMonth}.xlsx`

    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Logbook')
    XLSX.writeFile(wb, fileName)
  }

  const handlePrint = (row: Attendance) => {
    const win = window.open('', '_blank')
    if (!win) return
    const formattedTasks = row.uraian_kerja
      ? row.uraian_kerja.split(';').map((t, i) => `${i + 1}. ${t.trim()}`).join('<br>')
      : '-'

    win.document.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <title>Cetak Logbook - ${row.full_name}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          td { padding: 5px; vertical-align: top; }
          .title { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 20px; text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="title">LAPORAN HARIAN PEGAWAI</div>
        <table>
          <tr><td width="120">Nama</td><td>: ${row.full_name}</td></tr>
          <tr><td>Jabatan</td><td>: ${row.position}</td></tr>
          <tr><td>Hari/Tanggal</td><td>: ${formatDateIndo(row.attendance_date)}</td></tr>
          <tr><td>Shift</td><td>: ${row.shift}</td></tr>
        </table>
        <hr style="margin: 20px 0;">
        <h3>Uraian Kegiatan:</h3>
        <div>${formattedTasks}</div>
        <br><br><br>
        <div style="text-align: right; margin-top: 50px;">
           <p>Mengetahui,<br>Pejabat Berwenang</p>
           <br><br><br><br>
           <p>( ................................. )</p>
        </div>
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
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        {/* KIRI: Tombol Kembali & Judul */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button
            onClick={() => router.push('/dashboardadmin')}
            className="flex-none flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg shadow-sm transition"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <div>
            <h1 className="text-3xl font-bold text-[#003366]">Rekapitulasi Logbook</h1>
            <p className="text-gray-500 text-sm">Monitoring kinerja harian pegawai</p>
          </div>
        </div>

        {/* KANAN: Tombol Export */}
        <div className="w-full md:w-auto">
          <button
            onClick={exportToExcel}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* FILTER CONTROL PANEL */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row gap-6 items-end">
          
          {/* 1. Pencarian Nama */}
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Search className="w-4 h-4" /> Cari Pegawai
            </label>
            <input
              type="text"
              placeholder="Ketik nama atau jabatan..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* 2. Pilihan Mode Filter */}
          <div className="w-full md:w-auto flex flex-col">
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <ListFilter className="w-4 h-4" /> Mode Filter
            </label>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setFilterMode('daily')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition flex-1 ${
                  filterMode === 'daily' 
                    ? 'bg-white text-blue-700 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Harian
              </button>
              <button
                onClick={() => setFilterMode('monthly')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition flex-1 ${
                  filterMode === 'monthly' 
                    ? 'bg-white text-blue-700 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Bulanan
              </button>
            </div>
          </div>

          {/* 3. Input Tanggal (Muncul sesuai Mode) */}
          <div className="w-full md:w-auto">
            {filterMode === 'daily' ? (
              <div className="flex flex-col">
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Pilih Tanggal
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full md:w-48 rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
                />
              </div>
            ) : (
              <div className="flex flex-col">
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Pilih Bulan
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full md:w-48 rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
                />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* TABLE DATA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#003366] text-white">
              <tr>
                <th className="p-4 text-sm font-semibold uppercase tracking-wider w-12 text-center">No</th>
                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Nama Pegawai</th>
                <th className="p-4 text-sm font-semibold uppercase tracking-wider">Tanggal</th>
                <th className="p-4 text-sm font-semibold uppercase tracking-wider text-center">Shift</th>
                <th className="p-4 text-sm font-semibold uppercase tracking-wider text-center">Status</th>
                <th className="p-4 text-sm font-semibold uppercase tracking-wider w-1/3">Uraian Kerja</th>
                <th className="p-4 text-sm font-semibold uppercase tracking-wider text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500 bg-gray-50">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="w-8 h-8 text-gray-300 mb-2" />
                      <p className="text-lg font-medium">Tidak ada data ditemukan</p>
                      <p className="text-sm">Untuk periode: {filterMode === 'daily' ? formatDateIndo(selectedDate) : formatMonthIndo(selectedMonth)}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((row, index) => (
                  <tr key={row.id} className="hover:bg-blue-50 transition duration-150">
                    <td className="p-4 text-gray-500 align-top text-center">
                      {indexOfFirstItem + index + 1}
                    </td>
                    <td className="p-4 align-top">
                      <div className="font-bold text-gray-900">{row.full_name}</div>
                      <div className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-1">{row.position}</div>
                    </td>
                    <td className="p-4 text-gray-700 whitespace-nowrap align-top">
                      {formatDateIndo(row.attendance_date)}
                    </td>
                    <td className="p-4 align-top text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        row.shift === 'pagi' ? 'bg-yellow-100 text-yellow-700' : 
                        row.shift === 'malam' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {row.shift ? row.shift.toUpperCase() : '-'}
                      </span>
                    </td>
                    <td className="p-4 align-top text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        row.status === 'Masuk' ? 'bg-green-100 text-green-700' : 
                        row.status === 'Terlambat' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700 text-sm align-top">
                      <ul className="list-disc pl-4 space-y-1 marker:text-blue-500">
                        {row.uraian_kerja ? (
                          row.uraian_kerja.split(';').map((task, i) => (
                            <li key={i}>{task.trim()}</li>
                          ))
                        ) : (
                          <li className="text-gray-400 italic">Belum mengisi logbook</li>
                        )}
                      </ul>
                    </td>
                    <td className="p-4 text-center align-top">
                      <button
                        onClick={() => handlePrint(row)}
                        className="p-2 rounded-full bg-white border border-gray-200 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition shadow-sm"
                        title="Cetak Logbook Individu"
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

        {/* PAGINATION CONTROLS */}
        {filteredData.length > itemsPerPage && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Menampilkan <span className="font-medium">{indexOfFirstItem + 1}</span> sampai <span className="font-medium">{Math.min(indexOfLastItem, filteredData.length)}</span> dari <span className="font-medium">{filteredData.length}</span> data
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => paginate(i + 1)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === i + 1
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}

                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}