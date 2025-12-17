'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, FileSpreadsheet, Search, Filter, Info, Briefcase } from 'lucide-react' 
import toast, { Toaster } from 'react-hot-toast'
import XLSX from 'xlsx-js-style' 
import { 
  format, 
  getDaysInMonth, 
  isSunday, 
  isSaturday, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  parseISO,
  isAfter,
  startOfDay
} from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

// --- Tipe Data ---
type Profile = {
  id: string
  full_name: string
  position: string
}

type LeaveInfo = {
  type: string
  half_day: boolean
}

type AttendanceInfo = {
  shift: string
  checkIn: string
}

type LeaveQuota = {
  user_id: string
  annual_quota: number
  used_leave: number
}

type MatrixRow = {
  no: number
  profile: Profile
  remainingLeave: number | null
  days: {
    date: string
    code: 'H' | '2x' | 'T' | '2T¹' | '2T²' | 'I' | 'C' | 'S' | 'A' | '½' | 'L' | '-' 
    color: string
    isHoliday: boolean
    tooltip: string
  }[]
  stats: {
    H: number       
    Sft: number     
    T: number       
    I: number
    C: number
    S: number
    A: number
    Half: number
  }
}

export default function RekapAbsensiMatrix() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  // State Filter
  const [month, setMonth] = useState<number>(new Date().getMonth()) 
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [searchName, setSearchName] = useState<string>('')

  // Data Mentah
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceInfo[]>>(new Map())
  const [leaveMap, setLeaveMap] = useState<Map<string, LeaveInfo>>(new Map())
  const [permissionSet, setPermissionSet] = useState<Set<string>>(new Set())
  const [quotaMap, setQuotaMap] = useState<Map<string, number>>(new Map())
  
  // STATE HARI LIBUR (Diambil dari Database)
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({})

  // =========================================================================
  // 1. FETCH DATA
  // =========================================================================
  const fetchData = async () => {
    setLoading(true)
    try {
      const startDateStr = format(startOfMonth(new Date(year, month)), 'yyyy-MM-dd')
      const endDateStr = format(endOfMonth(new Date(year, month)), 'yyyy-MM-dd')

      // 1. Fetch Profiles
      const { data: dataProfiles, error: errProf } = await supabase
        .from('profiles')
        .select('id, full_name, position')
        .neq('role', 'admin')      
        .neq('is_admin', true)     
        .order('full_name')
      
      if (errProf) throw errProf

      // 2. Fetch Attendance
      const { data: dataAtt } = await supabase
        .from('attendances')
        .select('user_id, attendance_date, shift, check_in') 
        .gte('attendance_date', startDateStr)
        .lte('attendance_date', endDateStr)

      // 3. Fetch Leave Requests
      const { data: dataLeaves } = await supabase
        .from('leave_requests')
        .select('user_id, start_date, end_date, leave_type, status, half_day')
        .eq('status', 'Disetujui')
        .or(`start_date.lte.${endDateStr},end_date.gte.${startDateStr}`)

      // 4. Fetch Permissions
      const { data: dataPermits } = await supabase
        .from('permission_requests')
        .select('user_id, tanggal_mulai, tanggal_selesai, status')
        .in('status', ['Disetujui', 'Disetujui Level 1', 'Disetujui Level 2'])
        .or(`tanggal_mulai.lte.${endDateStr},tanggal_selesai.gte.${startDateStr}`)

      // 5. Fetch Quota
      const { data: dataQuota } = await supabase
        .from('master_leave_quota')
        .select('user_id, annual_quota, used_leave')
        .eq('year', year)

      // 6. FETCH HOLIDAYS DARI DATABASE (DYNAMIC)
      // Mengambil data libur sesuai range bulan yang dipilih
      const { data: dbHolidays, error: errHoliday } = await supabase
        .from('public_holidays')
        .select('date, description')
        .gte('date', startDateStr)
        .lte('date', endDateStr)

      if (errHoliday) {
        console.warn("Gagal mengambil data libur (Mungkin tabel belum dibuat):", errHoliday.message)
      }

      // Format data libur menjadi Map: { '2025-01-01': 'Tahun Baru', ... }
      const newHolidayMap: Record<string, string> = {}
      if (dbHolidays) {
        dbHolidays.forEach((h: any) => {
          newHolidayMap[h.date] = h.description
        })
      }
      setHolidayMap(newHolidayMap)


      // --- PROCESS DATA LAINNYA ---
      const tempAttMap = new Map<string, AttendanceInfo[]>()
      dataAtt?.forEach(a => {
        const key = `${a.user_id}_${a.attendance_date}`
        const currentList = tempAttMap.get(key) || []
        const exists = currentList.find(item => item.shift === a.shift)
        if (!exists && a.check_in) {
            currentList.push({ shift: a.shift, checkIn: a.check_in })
        }
        tempAttMap.set(key, currentList)
      })
      setAttendanceMap(tempAttMap)

      const tempLeaveMap = new Map<string, LeaveInfo>()
      dataLeaves?.forEach(l => {
        try {
          const range = eachDayOfInterval({ start: parseISO(l.start_date), end: parseISO(l.end_date) })
          range.forEach(date => {
            const key = `${l.user_id}_${format(date, 'yyyy-MM-dd')}`
            tempLeaveMap.set(key, { type: l.leave_type, half_day: l.half_day || false })
          })
        } catch (e) {}
      })
      setLeaveMap(tempLeaveMap)

      const tempPermitSet = new Set<string>()
      dataPermits?.forEach(p => {
        try {
          const range = eachDayOfInterval({ start: parseISO(p.tanggal_mulai), end: parseISO(p.tanggal_selesai) })
          range.forEach(date => {
             tempPermitSet.add(`${p.user_id}_${format(date, 'yyyy-MM-dd')}`)
          })
        } catch (e) {}
      })
      setPermissionSet(tempPermitSet)

      const tempQuotaMap = new Map<string, number>()
      dataQuota?.forEach((q: LeaveQuota) => {
          const sisa = Number(q.annual_quota) - Number(q.used_leave)
          tempQuotaMap.set(q.user_id, sisa)
      })
      setQuotaMap(tempQuotaMap)

      if (dataProfiles) setProfiles(dataProfiles)

    } catch (error: any) {
      console.error("Error:", error)
      toast.error("Gagal mengambil data: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [month, year])

  // =========================================================================
  // 2. CORE LOGIC
  // =========================================================================
  const matrixData = useMemo(() => {
    let filteredProfiles = profiles
    if (searchName.trim()) {
      filteredProfiles = profiles.filter(p => 
        p.full_name?.toLowerCase().includes(searchName.toLowerCase())
      )
    }
    if (!filteredProfiles.length) return []

    const daysCount = getDaysInMonth(new Date(year, month))
    const daysArray = Array.from({ length: daysCount }, (_, i) => i + 1)
    const today = startOfDay(new Date()) 

    return filteredProfiles.map((profile, index) => {
      const rowData: MatrixRow['days'] = []
      let stats = { H: 0, Sft: 0, T: 0, I: 0, C: 0, S: 0, A: 0, Half: 0 }
      const remainingLeave = quotaMap.has(profile.id) ? quotaMap.get(profile.id)! : null

      daysArray.forEach(day => {
        const dateObj = new Date(year, month, day)
        const dateStr = format(dateObj, 'yyyy-MM-dd')
        const key = `${profile.id}_${dateStr}`
        
        // --- CEK APAKAH HARI LIBUR / WEEKEND (Menggunakan Data Database) ---
        const holidayName = holidayMap[dateStr] 
        const isWeekend = isSunday(dateObj) || isSaturday(dateObj)
        const isOffDay = isWeekend || !!holidayName 
        
        let code: MatrixRow['days'][0]['code'] = '-'
        let color = 'bg-white'
        let tooltip = ''

        // 1. ABSEN MASUK (Prioritas Tertinggi)
        if (attendanceMap.has(key)) {
            const shifts = attendanceMap.get(key) || []
            let lateCount = 0 
            shifts.forEach(s => {
                const checkInDate = new Date(s.checkIn)
                const totalMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes()
                if (s.shift.toLowerCase() === 'pagi' && totalMinutes > 8 * 60) lateCount++
                if (s.shift.toLowerCase() === 'malam' && totalMinutes > 19 * 60) lateCount++
            })

            if (shifts.length > 1) {
                if (lateCount === 1) { code = '2T¹'; color = 'bg-yellow-600 text-white font-bold'; tooltip = 'Hadir 2 Shift (1 Telat)'; }
                else if (lateCount >= 2) { code = '2T²'; color = 'bg-yellow-700 text-white font-bold'; tooltip = 'Hadir 2 Shift (2 Telat)'; }
                else { code = '2x'; color = 'bg-green-600 text-white font-bold'; tooltip = 'Hadir 2 Shift'; }
            } else {
                if (lateCount > 0) { code = 'T'; color = 'bg-yellow-500 text-white font-bold'; tooltip = 'Hadir (Terlambat)'; }
                else { code = 'H'; color = 'bg-green-200 text-green-800 border-green-300'; tooltip = 'Hadir Tepat Waktu'; }
            }
            stats.H += 1; stats.Sft += shifts.length; stats.T += lateCount;
        }
        
        // 2. CUTI (Hanya dihitung jika HARI KERJA)
        else if (leaveMap.has(key) && !isOffDay) {
            const info = leaveMap.get(key)!
            if (info.half_day) { code = '½'; color = 'bg-purple-200 text-purple-800'; tooltip = 'Cuti Setengah Hari'; stats.Half++ }
            else if (info.type.toLowerCase().includes('sakit')) { code = 'S'; color = 'bg-orange-200 text-orange-800'; tooltip = `Sakit: ${info.type}`; stats.S++ }
            else { code = 'C'; color = 'bg-blue-200 text-blue-800'; tooltip = `Cuti: ${info.type}`; stats.C++ }
        }

        // 3. TANGGAL MERAH (Data Database)
        else if (holidayName) {
            code = 'L';
            color = 'bg-red-600 text-white font-bold'; 
            tooltip = `LIBUR: ${holidayName}`;
        }
        // 4. WEEKEND
        else if (isWeekend) { 
            code = '-'; 
            color = 'bg-red-500 text-white'; 
            tooltip = 'Akhir Pekan (Sabtu/Minggu)';
        }
        // 5. IZIN
        else if (permissionSet.has(key)) { 
            code = 'I'; color = 'bg-yellow-200 text-yellow-800'; tooltip = 'Izin (Disetujui)'; stats.I++ 
        }
        // 6. ALPHA
        else if (isAfter(today, dateObj)) { 
            code = 'A'; color = 'bg-red-50 text-red-600 font-bold'; tooltip = 'Alpha / Tanpa Keterangan'; stats.A++ 
        }
        else { 
            code = '-'; color = 'bg-white'; tooltip = 'Belum ada data';
        }

        rowData.push({ date: dateStr, code, color, isHoliday: isOffDay, tooltip })
      })

      return { no: index + 1, profile, days: rowData, stats, remainingLeave }
    })
  }, [profiles, attendanceMap, leaveMap, permissionSet, quotaMap, month, year, searchName, holidayMap])

  // =========================================================================
  // 3. EXPORT TO EXCEL
  // =========================================================================
  const exportToExcel = () => {
    if (matrixData.length === 0) {
      toast.error("Data kosong.")
      return
    }

    const daysCount = getDaysInMonth(new Date(year, month))
    const daysHeader = Array.from({ length: daysCount }, (_, i) => (i + 1).toString())
    const monthName = format(new Date(year, month), 'MMMM yyyy', { locale: idLocale })

    // --- STYLES ---
    const borderStyle = {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }

    const headerStyle = {
      fill: { fgColor: { rgb: "4B5563" } },
      font: { color: { rgb: "FFFFFF" }, bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: borderStyle
    }

    const styles: Record<string, any> = {
      'H': { fill: { fgColor: { rgb: "C6EFCE" } }, font: { color: { rgb: "006100" }, bold: true } },
      '2x': { fill: { fgColor: { rgb: "16A34A" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },
      'T': { fill: { fgColor: { rgb: "EAB308" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },
      '2T¹': { fill: { fgColor: { rgb: "CA8A04" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },
      '2T²': { fill: { fgColor: { rgb: "A16207" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },
      'C': { fill: { fgColor: { rgb: "BFDBFE" } }, font: { color: { rgb: "1E3A8A" }, bold: true } },
      'S': { fill: { fgColor: { rgb: "FED7AA" } }, font: { color: { rgb: "9A3412" }, bold: true } },
      'I': { fill: { fgColor: { rgb: "FEF08A" } }, font: { color: { rgb: "854D0E" }, bold: true } },
      '½': { fill: { fgColor: { rgb: "E9D5FF" } }, font: { color: { rgb: "6B21A8" }, bold: true } },
      'A': { fill: { fgColor: { rgb: "EF4444" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },
      'L': { fill: { fgColor: { rgb: "B91C1C" } }, font: { color: { rgb: "FFFFFF" }, bold: true } }, // Merah Gelap buat Libur
      'WEEKEND': { fill: { fgColor: { rgb: "EF4444" } } },
    }

    const tableHeaderLabel = [
      "No", "Nama Pegawai", "Jabatan", ...daysHeader, 
      "Hadir", "Shift", "Telat", "Izin", "Cuti", "Sakit", "½", "Alpha", "Sisa"
    ]
    const tableHeaderRow = tableHeaderLabel.map(h => ({ v: h, s: headerStyle }))

    const tableBodyRows: any[][] = []
    matrixData.forEach(row => {
      const rowCells: any[] = []
      const baseStyle = { border: borderStyle, alignment: { vertical: "center" } }
      
      rowCells.push({ v: row.no, s: { ...baseStyle, alignment: { horizontal: "center" } } })
      rowCells.push({ v: row.profile.full_name, s: baseStyle })
      rowCells.push({ v: row.profile.position, s: baseStyle })

      row.days.forEach(day => {
        let cellStyle = { ...baseStyle, alignment: { horizontal: "center" } }
        let val = day.code === '-' ? '' : day.code

        // Logic Warna di Excel
        if (styles[val]) {
             cellStyle = { ...cellStyle, ...styles[val] }
        } else if (day.isHoliday) { 
             cellStyle = { ...cellStyle, ...styles['WEEKEND'] }
             if (val === '') val = ''
        } 
        
        rowCells.push({ v: val, s: cellStyle })
      })

      // Stats Columns
      const statStyle = { border: borderStyle, alignment: { horizontal: "center" }, font: { bold: true } }
      rowCells.push({ v: row.stats.H, s: statStyle })
      rowCells.push({ v: row.stats.Sft, s: statStyle })
      rowCells.push({ v: row.stats.T, s: statStyle })
      rowCells.push({ v: row.stats.I, s: statStyle })
      rowCells.push({ v: row.stats.C, s: statStyle })
      rowCells.push({ v: row.stats.S, s: statStyle })
      rowCells.push({ v: row.stats.Half, s: statStyle })
      rowCells.push({ v: row.stats.A, s: { ...statStyle, font: { color: { rgb: "DC2626" }, bold: true } } })
      rowCells.push({ v: row.remainingLeave ?? "-", s: { ...statStyle, fill: { fgColor: { rgb: "DBEAFE" } } } })

      tableBodyRows.push(rowCells)
    })

    const titleRow = [{ v: "REKAP ABSENSI PEGAWAI", s: { font: { sz: 14, bold: true }, alignment: { horizontal: "center" } } }]
    const periodRow = [{ v: `PERIODE: ${monthName.toUpperCase()}`, s: { font: { sz: 11, bold: true }, alignment: { horizontal: "center" } } }]

    const ws_data = [
        titleRow, periodRow, [{ v: "", s: {} }], tableHeaderRow, ...tableBodyRows
    ]

    const ws = XLSX.utils.aoa_to_sheet([])
    XLSX.utils.sheet_add_aoa(ws, ws_data, { origin: "A1" })

    // Merge Judul
    if(!ws['!merges']) ws['!merges'] = []
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: tableHeaderLabel.length - 1 } })
    ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: tableHeaderLabel.length - 1 } })

    // Col Width
    const wscols = [{ wch: 5 }, { wch: 30 }, { wch: 20 }]
    for(let i=0; i<daysCount; i++) wscols.push({ wch: 4 })
    for(let i=0; i<9; i++) wscols.push({ wch: 6 })
    ws['!cols'] = wscols

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi")
    XLSX.writeFile(wb, `Rekap_Absensi_${format(new Date(year, month), 'MMMM_yyyy', {locale: idLocale})}.xlsx`)
    toast.success("Excel berhasil didownload!")
  }

  // =========================================================================
  // 4. RENDER UI
  // =========================================================================
  const daysInCurrentMonth = getDaysInMonth(new Date(year, month))
  const dateHeaders = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1)
  const monthNameStr = format(new Date(year, month), 'MMMM yyyy', { locale: idLocale })

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-xs sm:text-sm">
      <Toaster position="top-center" />
      
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button variant="outline" onClick={() => router.push('/dashboardadmin')} className="gap-2">
              <ArrowLeft className="w-4 h-4"/> Kembali
            </Button>
            <div>
              <h1 className="text-lg font-bold uppercase text-gray-800">Rekap Absensi Matrix</h1>
              <p className="text-gray-500 text-xs">Periode: {monthNameStr}</p>
            </div>
          </div>
          <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700 text-white w-full md:w-auto gap-2 shadow-sm">
            <FileSpreadsheet className="w-4 h-4"/> Download Excel
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 items-center bg-gray-50 p-3 rounded-md border border-gray-100">
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input type="text" placeholder="Cari Pegawai..." value={searchName} onChange={(e) => setSearchName(e.target.value)}
                    className="pl-9 pr-3 py-2 border rounded-md text-sm w-full md:w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
            </div>
            <div className="flex gap-2">
                <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="border p-2 rounded-md text-sm bg-white cursor-pointer">
                    {Array.from({length: 12}, (_, i) => <option key={i} value={i}>{format(new Date(year, i), 'MMMM', { locale: idLocale })}</option>)}
                </select>
                <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="border p-2 rounded-md text-sm bg-white cursor-pointer">
                    {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            <Button size="sm" onClick={fetchData} variant="secondary" className="border gap-2">
                <Filter className="w-3 h-3"/> Refresh
            </Button>
            
            <div className="ml-auto text-xs text-gray-500 italic hidden md:flex items-center gap-1">
                <Info className="w-3 h-3" />
                <span>Geser ke kanan untuk lihat sisa cuti</span>
            </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg shadow-sm h-64">
            <Loader2 className="animate-spin text-blue-600 w-8 h-8 mb-2"/>
            <p className="text-gray-500">Memuat data absensi...</p>
        </div>
      ) : matrixData.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg shadow-sm text-gray-500">Tidak ada data pegawai.</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto pb-2">
            <table className="w-full border-collapse text-center text-[11px] md:text-xs min-w-[1200px]">
                <thead>
                    <tr className="bg-gray-800 text-white font-semibold">
                        <th rowSpan={2} className="border border-gray-600 p-2 min-w-[40px]">No</th>
                        <th rowSpan={2} className="border border-gray-600 p-2 min-w-[200px] sticky left-0 bg-gray-800 z-20 text-left">Nama</th>
                        <th rowSpan={2} className="border border-gray-600 p-2 min-w-[100px]">Jabatan</th>
                        <th colSpan={daysInCurrentMonth} className="border border-gray-600 p-1 bg-gray-700">Tanggal</th>
                        <th colSpan={8} className="border border-gray-600 p-1 bg-blue-900">Total</th>
                        {/* Header Sisa Cuti */}
                        <th rowSpan={2} className="border border-gray-600 p-2 min-w-[80px] bg-blue-800">
                            <div className="flex flex-col items-center gap-1">
                                <Briefcase className="w-4 h-4"/>
                                <span>Sisa Cuti</span>
                            </div>
                        </th>
                    </tr>
                    <tr className="bg-gray-100 text-gray-800 font-bold">
                        {dateHeaders.map(d => {
                             const dateCheck = new Date(year, month, d)
                             const dateStr = format(dateCheck, 'yyyy-MM-dd')
                             // Mengambil nama libur dari holidayMap (Gabungan Statis & DB)
                             const holidayName = holidayMap[dateStr]
                             const isWeekend = isSunday(dateCheck) || isSaturday(dateCheck)
                             const isLibur = !!holidayName
                             
                             // Header merah jika Libur Nasional atau Weekend
                             const bgClass = (isLibur || isWeekend) ? 'bg-red-500 text-white' : ''
                             return <th key={d} className={`border border-gray-300 w-8 h-8 ${bgClass}`} title={holidayName}>{d}</th>
                        })}
                        <th className="border border-gray-300 w-10 bg-green-100 text-green-700" title="Total Hari Hadir (Max 30)">H</th>
                        <th className="border border-gray-300 w-10 bg-green-200 text-green-800" title="Total Shift Hadir (Bisa >30)">Sft</th>
                        <th className="border border-gray-300 w-9 bg-yellow-500 text-white">T</th>
                        <th className="border border-gray-300 w-9 bg-yellow-100 text-yellow-700">I</th>
                        <th className="border border-gray-300 w-9 bg-blue-100 text-blue-700">C</th>
                        <th className="border border-gray-300 w-9 bg-orange-100 text-orange-700">S</th>
                        <th className="border border-gray-300 w-9 bg-purple-100 text-purple-700">½</th>
                        <th className="border border-gray-300 w-9 bg-red-100 text-red-700">A</th>
                    </tr>
                </thead>
                <tbody>
                    {matrixData.map((row) => (
                        <tr key={row.profile.id} className="hover:bg-gray-50 group transition-colors">
                            <td className="border border-gray-300 p-1">{row.no}</td>
                            <td className="border border-gray-300 px-3 py-2 text-left font-medium sticky left-0 bg-white group-hover:bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{row.profile.full_name}</td>
                            <td className="border border-gray-300 p-1 text-gray-500">{row.profile.position}</td>
                            
                            {row.days.map((day, dIdx) => (
                                <td key={dIdx} 
                                    className={`border border-gray-300 h-8 font-bold text-[10px] cursor-help ${day.color}`}
                                    title={day.tooltip} 
                                >
                                    {day.code !== '-' ? day.code : ''}
                                </td>
                            ))}

                            <td className="border border-gray-300 font-bold bg-green-50">{row.stats.H}</td>
                            <td className="border border-gray-300 font-bold bg-green-100">{row.stats.Sft}</td>
                            <td className="border border-gray-300 font-bold bg-yellow-100 text-yellow-700">{row.stats.T}</td>
                            <td className="border border-gray-300 font-bold bg-yellow-50">{row.stats.I}</td>
                            <td className="border border-gray-300 font-bold bg-blue-50">{row.stats.C}</td>
                            <td className="border border-gray-300 font-bold bg-orange-50">{row.stats.S}</td>
                            <td className="border border-gray-300 font-bold bg-purple-50">{row.stats.Half}</td>
                            <td className="border border-gray-300 font-bold bg-red-50 text-red-600">{row.stats.A}</td>

                            {/* Cell Sisa Cuti */}
                            <td className="border border-gray-300 font-bold bg-blue-50 text-blue-800 text-sm">
                                {row.remainingLeave !== null ? row.remainingLeave : "-"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs bg-white p-3 rounded border border-gray-200 shadow-sm">
        <span className="font-bold text-gray-700">Keterangan:</span>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-green-200 border border-green-300 inline-block"></span> 1 Shift (H)</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-green-600 border border-green-700 inline-block"></span> 2 Shift (2x)</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-yellow-600 border border-yellow-700 inline-block"></span> 2 Shift (1 Telat) (2T¹)</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-yellow-700 border border-yellow-800 inline-block"></span> 2 Shift (2 Telat) (2T²)</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-yellow-500 border border-yellow-600 inline-block"></span> 1 Shift Telat (T)</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-blue-200 border border-blue-300 inline-block"></span> Cuti (C)</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-purple-200 border border-purple-300 inline-block"></span> ½ Hari</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-orange-200 border border-orange-300 inline-block"></span> Sakit (S)</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-600 border border-red-700 inline-block text-white text-center leading-4 font-bold">L</span> Libur Nasional</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-500 border border-red-600 inline-block"></span> Akhir Pekan</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-600 border border-red-700 inline-block text-white text-center leading-4 font-bold">A</span> Alpha</div>
      </div>
    </div>
  )
}