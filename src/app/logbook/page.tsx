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
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [userData, setUserData] = useState<UserData>({ fullName: '', position: '' })
  const [attendanceId, setAttendanceId] = useState<number | null>(null)
  const [logbookId, setLogbookId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<string[]>([])
  const [selectedTask, setSelectedTask] = useState('')
  const [otherTask, setOtherTask] = useState('')
  const [standardTasks, setStandardTasks] = useState<string[]>([])
  const [formData, setFormData] = useState({ date: today, shift: '', description: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [previousLogbooks, setPreviousLogbooks] = useState<{ shift: string, status: string }[]>([])

  // --- daftar tugas sesuai jabatan ---
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

  // --- Fetch user, attendance & logbook ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser()
        if (userErr || !user) throw new Error('Sesi login tidak ditemukan.')
        setUserId(user.id)

        // --- Ambil profile user ---
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, position')
          .eq('id', user.id)
          .maybeSingle()

        const position = profile?.position || ''
        setUserData({ fullName: profile?.full_name || user.email!, position })

        // --- Set standardTasks sesuai posisi ---
        if (position.toLowerCase().includes('satpam')) setStandardTasks(tugasSatpam)
        else if (position.toLowerCase().includes('supir')) setStandardTasks(tugasSupir)
        else if (position) setStandardTasks(tugasPPNPN)
        else setStandardTasks([])

        // --- Ambil semua attendance hari ini ---
        const { data: attendances } = await supabase
          .from('attendances')
          .select('id, shift')
          .eq('user_id', user.id)
          .eq('attendance_date', today)

        if (!attendances || attendances.length === 0) {
          setError('Anda belum melakukan absen masuk hari ini.')
          setIsLoading(false)
          return
        }

        const attendance = attendances[attendances.length - 1] // ambil shift terakhir
        setAttendanceId(attendance.id)
        setFormData(prev => ({ ...prev, shift: attendance.shift }))

        // --- Ambil logbook shift hari ini ---
        const { data: logbook } = await supabase
          .from('logbooks')
          .select('id, status')
          .eq('attendance_id', attendance.id)
          .eq('user_id', user.id)
          .eq('shift', attendance.shift)
          .maybeSingle()

        if (logbook) {
          setLogbookId(logbook.id)
          if (logbook.status === 'COMPLETED') setError('Logbook shift ini sudah selesai diisi.')
        } else {
          // Auto-create logbook
          const { data: newLogbook, error: insertErr } = await supabase
            .from('logbooks')
            .insert({
              user_id: user.id,
              attendance_id: attendance.id,
              shift: attendance.shift,
              status: 'IN_PROGRESS'
            })
            .select('id')
            .single()
          if (insertErr) throw insertErr
          setLogbookId(newLogbook.id)
        }

        // --- Ambil logbook shift sebelumnya ---
        const { data: prevLogs } = await supabase
          .from('logbooks')
          .select('shift, status')
          .eq('user_id', user.id)
          .neq('attendance_id', attendance.id)
          .order('id', { ascending: false })
          .limit(3)

        setPreviousLogbooks(prevLogs || [])

      } catch (err: any) {
        console.error(err)
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [today])

  // --- Tambah/Hapus tugas ---
  const addTask = () => {
    let newTask = selectedTask
    if (selectedTask === 'Lainnya' && otherTask.trim() !== '') newTask = otherTask.trim()
    if (!newTask || tasks.includes(newTask)) return
    setTasks(prev => [...prev, newTask])
    setSelectedTask('')
    setOtherTask('')
  }

  const removeTask = (index: number) => setTasks(prev => prev.filter((_, i) => i !== index))

  // --- Submit logbook ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!logbookId || tasks.length === 0) {
      setError('Isi minimal satu tugas sebelum submit.')
      return
    }
    setIsSubmitting(true)
    try {
      const { error: updateErr } = await supabase
        .from('logbooks')
        .update({
          description: formData.description,
          status: 'COMPLETED'
        })
        .eq('id', logbookId)
        .eq('user_id', userId)
      if (updateErr) throw updateErr

      const taskRows = tasks.map(t => ({ logbook_id: logbookId, task_name: t }))
      const { error: insertErr } = await supabase.from('tasks').insert(taskRows)
      if (insertErr) throw insertErr

      router.replace('/dashboard')
    } catch (err) {
      console.error('Supabase Error:', err)
      setError('Gagal menyimpan logbook.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <RefreshCw className="animate-spin text-blue-600 w-6 h-6" />
      <span className="ml-3 text-gray-600 font-medium">Memuat data...</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <header className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="flex items-center text-blue-700 font-medium">
          <ChevronLeft size={20} className="mr-1" /> Kembali
        </button>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <FileText className="mr-2 text-blue-600" /> Logbook Harian
        </h1>
      </header>

      {previousLogbooks.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="font-medium text-blue-700 mb-2">Status Logbook Shift Sebelumnya:</p>
          <ul className="text-sm text-blue-800">
            {previousLogbooks.map((l, i) => (
              <li key={i}>Shift {l.shift}: {l.status}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
          <Input label="Nama Pegawai" value={userData.fullName} icon={User} readOnly />
          <Input label="Jabatan" value={userData.position} icon={Briefcase} readOnly />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Tanggal" value={formData.date} icon={Calendar} readOnly />
          <Input label="Shift" value={formData.shift} readOnly />
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">Daftar Tugas / Pekerjaan</label>
          <div className="flex">
            <select
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              className="flex-grow border border-gray-300 rounded-lg p-3"
            >
              <option value="">-- Pilih tugas --</option>
              {standardTasks.map((t, i) => <option key={i}>{t}</option>)}
            </select>
            <button type="button" onClick={addTask} className="ml-2 bg-blue-600 text-white p-3 rounded-lg">
              <Plus size={18} />
            </button>
          </div>

          {selectedTask === 'Lainnya' && (
            <input
              value={otherTask}
              onChange={(e) => setOtherTask(e.target.value)}
              placeholder="Tulis tugas lainnya..."
              className="w-full border border-gray-300 p-3 rounded-lg"
            />
          )}

          {tasks.length > 0 && (
            <div className="pt-2 space-y-2">
              {tasks.map((task, i) => (
                <div key={i} className="flex justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <span className="text-sm text-blue-800">{task}</span>
                  <button type="button" onClick={() => removeTask(i)} className="text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Keterangan Tambahan</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            className="w-full border border-gray-300 rounded-lg p-3 resize-none"
            placeholder="Tulis keterangan tambahan bila ada..."
          />
        </div>

        {error && (
          <div className="flex items-center bg-yellow-50 text-yellow-800 border border-yellow-300 rounded-lg p-3">
            <AlertTriangle size={18} className="mr-2" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center items-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
          {isSubmitting ? 'Menyimpan...' : 'Submit Logbook'}
        </button>
      </form>
    </div>
  )
}

// --- Reusable Input ---
const Input = ({ label, value, icon: Icon, readOnly = false }: any) => (
  <div className="space-y-1">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <div className={`flex items-center border rounded-lg ${readOnly ? 'bg-gray-100 border-gray-200' : 'border-gray-300'}`}>
      {Icon && <Icon size={18} className="ml-3 text-blue-600" />}
      <input value={value} readOnly={readOnly} className="w-full p-3 bg-transparent outline-none" />
    </div>
  </div>
)
