'use client'

import React, { useEffect, useState, useMemo } from 'react'
import {
  FileText, User, Calendar, Plus, Trash2, Send, ChevronLeft,
  RefreshCw, AlertTriangle, Briefcase
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

interface UserData {
  fullName: string
  position: string
}

export default function LogbookPage() {
  const router = useRouter()
  // Kita hapus ketergantungan ketat pada 'today' untuk query utama
  const todayDateDisplay = useMemo(() => new Date().toLocaleDateString('id-ID', {weekday: 'long', day:'numeric', month:'long'}), [])
  
  const [userId, setUserId] = useState<string | null>(null)
  const [userData, setUserData] = useState<UserData>({ fullName: '', position: '' })
  
  const [attendanceId, setAttendanceId] = useState<number | null>(null)
  const [shiftName, setShiftName] = useState('')
  const [attendanceDate, setAttendanceDate] = useState('')

  const [logbookId, setLogbookId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<string[]>([])
  const [selectedTask, setSelectedTask] = useState('')
  const [otherTask, setOtherTask] = useState('')
  const [standardTasks, setStandardTasks] = useState<string[]>([])
  const [description, setDescription] = useState('')
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusLogbook, setStatusLogbook] = useState('') // status saat ini

  // --- Daftar Tugas ---
  const tugasPPNPN = [
    "Pengarsipan dokumen dan surat",
    "Input data ke aplikasi SAKTI / Excel",
    "Membantu administrasi kepegawaian",
    "Distribusi dokumen internal antar seksi",
    "Verifikasi kelengkapan dokumen",
    "Penyusunan laporan harian",
    "Rekapitulasi surat masuk dan keluar",
    "Pelayanan konsultasi tamu dan satker",
    "Membantu kegiatan rapat dan dokumentasi",
    "Pemindaian (scan) arsip penting",
    "Membantu staf ASN dalam kegiatan rutin",
    "Lainnya"
  ]
  const tugasSatpam = [
    "Menjaga keamanan gedung dan area kantor",
    "Mencatat tamu masuk dan keluar",
    "Patroli area kantor secara berkala",
    "Mengontrol akses kendaraan",
    "Mengawasi CCTV dan sistem keamanan",
    "Membantu kegiatan upacara atau apel",
    "Menjaga ketertiban di area parkir",
    "Lainnya"
  ]
  const tugasSupir = [
    "Mengantar dan menjemput pegawai sesuai jadwal",
    "Memastikan kendaraan siap digunakan",
    "Merawat dan membersihkan kendaraan dinas",
    "Mencatat perjalanan dinas",
    "Melaporkan kerusakan kendaraan",
    "Menunggu pegawai selama kegiatan lapangan",
    "Lainnya"
  ]
  const tugasCS = [
    "Menyapu dan mengepel ruangan",
    "Membersihkan kamar mandi",
    "Lainnya"
  ]

  // --- Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser()
        if (userErr || !user) throw new Error('Sesi login tidak ditemukan.')
        setUserId(user.id)

        // 1. Ambil Profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, position')
          .eq('id', user.id)
          .maybeSingle()

        const position = profile?.position || ''
        setUserData({ fullName: profile?.full_name || user.email!, position })

        // Set list tugas
        if (position.toLowerCase().includes('satpam')) setStandardTasks(tugasSatpam)
        else if (position.toLowerCase().includes('supir')) setStandardTasks(tugasSupir)
        else if (position.toLowerCase().includes('cs')) setStandardTasks(tugasCS)
        else if (position) setStandardTasks(tugasPPNPN)
        else setStandardTasks([])

        // 2. Cari Absen AKTIF (Yang belum di-checkout)
        // Logika ini disamakan dengan halaman Checkout agar sinkron
        const { data: activeSessions, error: attError } = await supabase
          .from('attendances')
          .select('id, shift, attendance_date')
          .eq('user_id', user.id)
          .is('check_out', null) // Cari yang belum pulang
          .order('check_in', { ascending: false }) // Ambil yang paling baru
          .limit(1)

        if (attError) throw attError

        if (!activeSessions || activeSessions.length === 0) {
          setError('Anda belum melakukan Absen Masuk (atau sudah Checkout). Silakan absen masuk dulu.')
          setIsLoading(false)
          return
        }

        const activeShift = activeSessions[0]
        setAttendanceId(activeShift.id)
        setShiftName(activeShift.shift)
        setAttendanceDate(activeShift.attendance_date) // Tanggal sesuai absen masuk (bisa kemarin)

        // 3. Ambil Logbook untuk Attendance ID tersebut
        const { data: logbook } = await supabase
          .from('logbooks')
          .select('id, status, description')
          .eq('attendance_id', activeShift.id)
          .maybeSingle()

        if (logbook) {
          setLogbookId(logbook.id)
          setStatusLogbook(logbook.status)
          setDescription(logbook.description || '')
          
          // Ambil tasks yang sudah tersimpan (jika ada)
          const { data: existingTasks } = await supabase
            .from('tasks')
            .select('task_name')
            .eq('logbook_id', logbook.id)
          
          if (existingTasks) {
            setTasks(existingTasks.map(t => t.task_name))
          }

          if (logbook.status === 'COMPLETED') {
             // Jika sudah selesai, kita load datanya tapi user tidak bisa edit (opsional, atau biarkan edit)
             // Di sini kita biarkan edit jika perlu revisi sebelum checkout
          }
        } else {
          // Auto-create logbook baru jika belum ada row-nya
          const { data: newLogbook, error: insertErr } = await supabase
            .from('logbooks')
            .insert({
              user_id: user.id,
              attendance_id: activeShift.id,
              shift: activeShift.shift,
              log_date: activeShift.attendance_date, // Pakai tanggal absen
              status: 'IN_PROGRESS'
            })
            .select('id')
            .single()
          
          if (insertErr) throw insertErr
          setLogbookId(newLogbook.id)
          setStatusLogbook('IN_PROGRESS')
        }

      } catch (err: any) {
        console.error(err)
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, []) // Run once on mount

  // --- Handlers ---
  const addTask = () => {
    let newTask = selectedTask
    if (selectedTask === 'Lainnya' && otherTask.trim() !== '') newTask = otherTask.trim()
    if (!newTask || tasks.includes(newTask)) return
    setTasks(prev => [...prev, newTask])
    setSelectedTask('')
    setOtherTask('')
  }

  const removeTask = (index: number) => setTasks(prev => prev.filter((_, i) => i !== index))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!logbookId || tasks.length === 0) {
      setError('Isi minimal satu tugas sebelum submit.')
      return
    }
    
    setIsSubmitting(true)
    setError('') // Clear error

    try {
      // 1. Update Logbook Header
      const { error: updateErr } = await supabase
        .from('logbooks')
        .update({
          description: description,
          status: 'COMPLETED' // Set status COMPLETED agar bisa checkout
        })
        .eq('id', logbookId)

      if (updateErr) throw updateErr

      // 2. Update Tasks (Hapus lama, insert baru agar sinkron)
      await supabase.from('tasks').delete().eq('logbook_id', logbookId)
      
      const taskRows = tasks.map(t => ({ logbook_id: logbookId, task_name: t }))
      const { error: insertErr } = await supabase.from('tasks').insert(taskRows)
      
      if (insertErr) throw insertErr

      // Sukses
      setStatusLogbook('COMPLETED')
      router.replace('/dashboard') // Kembali ke dashboard agar tombol checkout aktif
    } catch (err: any) {
      console.error('Supabase Error:', err)
      setError('Gagal menyimpan logbook: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <RefreshCw className="animate-spin text-blue-600 w-6 h-6" />
      <span className="ml-3 text-gray-600 font-medium">Memuat data logbook...</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 font-sans">
      <header className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="flex items-center text-blue-700 font-medium hover:underline">
          <ChevronLeft size={20} className="mr-1" /> Kembali
        </button>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <FileText className="mr-2 text-blue-600" /> Logbook Harian
        </h1>
      </header>

      {/* ERROR ALERT */}
      {error && (
        <div className="mb-6 flex items-center bg-red-50 text-red-800 border border-red-200 rounded-lg p-4">
          <AlertTriangle size={24} className="mr-3" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* FORM AREA */}
      {!error && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
          
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-gray-100">
            <Input label="Nama Pegawai" value={userData.fullName} icon={User} readOnly />
            <Input label="Jabatan" value={userData.position} icon={Briefcase} readOnly />
            <Input label="Tanggal Absen" value={attendanceDate || todayDateDisplay} icon={Calendar} readOnly />
            <Input label="Shift Aktif" value={shiftName ? shiftName.toUpperCase() : '-'} readOnly />
          </div>

          {/* Task Input Section */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700">Daftar Tugas / Pekerjaan</label>
            
            <div className="flex gap-2">
              <select
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                className="flex-grow border border-gray-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-100 outline-none transition"
              >
                <option value="">-- Pilih tugas rutin --</option>
                {standardTasks.map((t, i) => <option key={i}>{t}</option>)}
              </select>
              <button type="button" onClick={addTask} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition shadow-md">
                <Plus size={20} />
              </button>
            </div>

            {selectedTask === 'Lainnya' && (
              <input
                value={otherTask}
                onChange={(e) => setOtherTask(e.target.value)}
                placeholder="Tulis tugas lainnya secara manual..."
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
              />
            )}

            {/* Task List */}
            {tasks.length > 0 ? (
              <div className="mt-4 space-y-2">
                {tasks.map((task, i) => (
                  <div key={i} className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-1">
                    <span className="text-sm font-medium text-blue-900 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-400 rounded-full"></span> {task}
                    </span>
                    <button type="button" onClick={() => removeTask(i)} className="text-red-500 hover:text-red-700 transition p-1">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
                Belum ada tugas yang ditambahkan.
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">Keterangan Tambahan / Kendala</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:ring-2 focus:ring-blue-100 outline-none transition"
              placeholder="Tulis detail pekerjaan atau kendala yang dihadapi..."
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full flex justify-center items-center gap-2 text-white py-4 rounded-xl font-bold shadow-lg transition transform active:scale-95 ${
                isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800'
              }`}
            >
              {isSubmitting ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} />}
              {isSubmitting ? 'Menyimpan...' : statusLogbook === 'COMPLETED' ? 'Update Logbook' : 'Submit Logbook (Selesai)'}
            </button>
            <p className="text-center text-xs text-gray-500 mt-3">
              *Pastikan semua tugas sudah tercatat sebelum menekan tombol Submit.
            </p>
          </div>
        </form>
      )}
    </div>
  )
}

// --- Reusable Input Component ---
const Input = ({ label, value, icon: Icon, readOnly = false }: any) => (
  <div className="space-y-1">
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
    <div className={`flex items-center border rounded-lg overflow-hidden ${readOnly ? 'bg-gray-50 border-gray-200' : 'border-gray-300 bg-white'}`}>
      {Icon && <div className="pl-3 text-gray-400"><Icon size={18} /></div>}
      <input 
        value={value} 
        readOnly={readOnly} 
        className={`w-full p-3 text-sm outline-none ${readOnly ? 'text-gray-600 bg-gray-50' : 'text-gray-900'}`} 
      />
    </div>
  </div>
)