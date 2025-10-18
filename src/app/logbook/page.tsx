'use client';

import React, { useEffect, useState, useMemo, RefAttributes } from 'react';
import {
  FileText,
  User,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Send,
  ChevronLeft,
  RefreshCw,
  AlertTriangle,
  Briefcase,
  LucideProps
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// --- Types ---
interface UserData {
  fullName: string;
  position: string;
}

interface FormData {
  date: string;
  startTime: string;
  description: string;
}

interface InputFieldProps {
  label: string;
  name?: keyof FormData;
  type?: 'text' | 'date' | 'time';
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  icon?: React.ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>;
  readOnly?: boolean;
}

interface TextareaFieldProps {
  label: string;
  name: keyof FormData;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

// --- Main component ---
export default function LogbookPage() {
  const router = useRouter();
  const today = useMemo(() => new Date().toISOString().substring(0, 10), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData>({ fullName: '', position: 'Staf Pelaksana' });
  const [logbookIdToUpdate, setLogbookIdToUpdate] = useState<number | null>(null);
  const [isLogbookCompleted, setIsLogbookCompleted] = useState<boolean>(false);
  const [hasCheckedIn, setHasCheckedIn] = useState<boolean>(false);

  const [tasks, setTasks] = useState<string[]>([]);
  const [standardTasks, setStandardTasks] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState<string>(''); 
  const [otherTask, setOtherTask] = useState<string>(''); 

  const [formData, setFormData] = useState<FormData>({
    date: today,
    startTime: '',
    description: '',
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // --- Daftar tugas berdasarkan posisi ---
  const tugasPPNPN = [
    "Pengarsipan dokumen SPM dan SP2D",
    "Input data SPM ke aplikasi SAKTI",
    "Distribusi surat dan dokumen internal",
    "Membantu verifikasi dokumen SPM",
    "Penyusunan laporan harian",
    "Pendistribusian dokumen LHP dan LPJ",
    "Pemindaian (scan) arsip penting",
    "Pelayanan konsultasi tamu dan satker",
    "Rekapitulasi surat masuk/keluar",
    "Rapat atau kegiatan koordinasi internal",
    "Lainnya",
  ];

  const tugasSatpam = [
    "Menjaga keamanan gedung dan lingkungan kantor",
    "Mencatat tamu yang masuk dan keluar",
    "Mengontrol akses keluar-masuk kendaraan",
    "Patroli area kantor secara berkala",
    "Melaporkan kejadian mencurigakan",
    "Mengawasi CCTV dan peralatan keamanan",
    "Membantu saat kegiatan upacara atau rapat besar",
    "Lainnya",
  ];

  const tugasSupir = [
    "Mengantar dan menjemput pegawai sesuai jadwal",
    "Merawat dan membersihkan kendaraan dinas",
    "Memeriksa kondisi kendaraan sebelum digunakan",
    "Mengisi logbook perjalanan kendaraan",
    "Melaporkan kerusakan kendaraan ke atasan",
    "Mengatur rute perjalanan agar efisien",
    "Menjaga kebersihan dan kelengkapan dokumen kendaraan",
    "Lainnya",
  ];

  // --- Fetch user data & logbook ---
  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      setError('');
      setIsLogbookCompleted(false);
      setLogbookIdToUpdate(null);

      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr || !user) throw new Error('Gagal memeriksa sesi. Silakan login ulang.');

        setUserId(user.id);
        const defaultFullNameFromEmail = user.email ? user.email.split('@')[0] : 'Pegawai';

        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, position')
          .eq('id', user.id)
          .maybeSingle();

        const position = profileData?.position || 'Staf Pelaksana';
        setUserData({
          fullName: profileData?.full_name || defaultFullNameFromEmail,
          position: position,
        });

        // Pilih daftar tugas sesuai jabatan
        if (position.toLowerCase().includes('satpam')) {
          setStandardTasks(tugasSatpam);
        } else if (position.toLowerCase().includes('supir')) {
          setStandardTasks(tugasSupir);
        } else {
          setStandardTasks(tugasPPNPN);
        }

        // Cek logbook hari ini
        const { data: logbookData } = await supabase
          .from('logbooks')
          .select('id, start_time, status')
          .eq('user_id', user.id)
          .eq('log_date', today)
          .maybeSingle();

        if (!logbookData) {
          setHasCheckedIn(false);
          setError('Anda harus melakukan Absen Masuk terlebih dahulu sebelum mengisi Logbook.');
        } else {
          setHasCheckedIn(true);
          setLogbookIdToUpdate(logbookData.id);

          // 🔹 Ambil jam masuk dari start_time tabel logbooks
          const startTimeValue = logbookData.start_time
            ? new Date(logbookData.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '08:00';

          setFormData(prev => ({ ...prev, startTime: startTimeValue }));

          if (logbookData.status === 'COMPLETED') {
            setIsLogbookCompleted(true);
            setError('Anda sudah mengisi Logbook untuk hari ini.');
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Terjadi kesalahan saat memuat data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [today]);

  // --- Add / remove tasks ---
  const addTask = () => {
    let taskToAdd = selectedTask;
    if (selectedTask === 'Lainnya' && otherTask.trim() !== '') taskToAdd = otherTask.trim();
    if (!taskToAdd) return;

    if (!tasks.includes(taskToAdd)) setTasks(prev => [...prev, taskToAdd]);
    setSelectedTask('');
    setOtherTask('');
  };

  const removeTask = (index: number) => setTasks(prev => prev.filter((_, i) => i !== index));

  // --- Submit handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!hasCheckedIn || isLogbookCompleted) {
      setError(isLogbookCompleted ? 'Logbook sudah diisi.' : 'Anda harus Absen Masuk.');
      return;
    }

    if (!logbookIdToUpdate) {
      setError('ID Logbook tidak ditemukan. Silakan refresh halaman.');
      return;
    }

    if (tasks.length === 0) {
      setError('Mohon tambahkan minimal satu tugas/pekerjaan.');
      return;
    }

    setIsSubmitting(true);

    try {
      const activityNameString = tasks.join('; ');

      // 🔹 Update logbook utama
      const { error: updateError } = await supabase
        .from('logbooks')
        .update({
          activity_name: activityNameString,
          description: formData.description || null,
          position_at_time: userData.position,
          status: 'COMPLETED',
        })
        .eq('id', logbookIdToUpdate);

      if (updateError) throw updateError;

      // 🔹 Simpan setiap task ke tabel "tasks"
      for (const task of tasks) {
        const { error: taskError } = await supabase
          .from('tasks')
          .insert([{ logbook_id: logbookIdToUpdate, task_name: task }]);
        if (taskError) console.error('Gagal menyimpan task:', taskError);
      }

      router.replace('/dashboard');
    } catch (err: any) {
      console.error('Error saat update logbook:', err);
      setError('Terjadi kesalahan saat menyimpan logbook.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render ---
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-700" />
        <p className="ml-4 text-gray-600 font-semibold">Memuat data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6">
      <header className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-blue-700 hover:text-blue-900 transition font-medium"
        >
          <ChevronLeft size={20} className="mr-1" />
          Kembali
        </button>
        <h1 className="text-2xl font-extrabold text-gray-800 flex items-center">
          <FileText size={24} className="mr-2 text-blue-600" />
          Logbook Harian
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-xl space-y-6">
        {/* Data Pegawai */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4 mb-4">
          <InputField label="Nama Pegawai" value={userData.fullName} icon={User} readOnly />
          <InputField label="Jabatan" value={userData.position} icon={Briefcase} readOnly />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InputField label="Tanggal" name="date" type="date" value={formData.date} readOnly icon={Calendar} />
          <InputField label="Jam Absen Masuk" name="startTime" type="time" value={formData.startTime} readOnly icon={Clock} />
        </div>

        {/* Daftar Tugas */}
        <div className="space-y-4">
          <label className="text-sm font-medium text-gray-700 block">Daftar Tugas/Pekerjaan Harian</label>
          <div className="flex space-x-2">
            <select
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
            >
              <option value="">-- Pilih tugas --</option>
              {standardTasks.map((task, index) => (
                <option key={index} value={task}>{task}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={addTask}
              disabled={!selectedTask || (selectedTask === 'Lainnya' && !otherTask)}
              className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            >
              <Plus size={20} />
            </button>
          </div>

          {selectedTask === 'Lainnya' && (
            <input
              type="text"
              placeholder="Tulis tugas lainnya..."
              value={otherTask}
              onChange={(e) => setOtherTask(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-800"
            />
          )}

          {tasks.length > 0 && (
            <div className="space-y-2 pt-2">
              {tasks.map((task, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
                  <span className="text-sm font-medium text-blue-800 truncate pr-2">{task}</span>
                  <button
                    type="button"
                    onClick={() => removeTask(index)}
                    className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <TextareaField
          label="Keterangan Tambahan (Opsional)"
          name="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />

        {error && (
          <div className={`flex items-center p-3 rounded-lg ${isLogbookCompleted ? 'bg-yellow-100 border border-yellow-400 text-yellow-800' : 'bg-red-100 border border-red-400 text-red-700'}`}>
            <AlertTriangle size={20} className="mr-2" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || tasks.length === 0 || !hasCheckedIn || isLogbookCompleted}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 mt-8 rounded-xl shadow-lg hover:bg-blue-700 transition duration-300 font-bold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} />}
          <span>{isSubmitting ? 'Menyimpan...' : 'Submit Logbook'}</span>
        </button>
      </form>
    </div>
  );
}

// --- Helper Components ---
const InputField: React.FC<InputFieldProps> = ({ label, name, type = 'text', value, onChange, icon: Icon, readOnly = false }) => (
  <div className="space-y-1">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <div className={`flex items-center border ${readOnly ? 'border-gray-200 bg-gray-100' : 'border-gray-300 focus-within:ring-2 focus-within:ring-blue-500'} rounded-lg overflow-hidden transition`}>
      {Icon && <Icon size={20} className={`ml-3 ${readOnly ? 'text-gray-500' : 'text-blue-500'}`} />}
      <input type={type} name={name} value={value} onChange={onChange} readOnly={readOnly} className="w-full p-3 focus:outline-none bg-transparent text-gray-800" />
    </div>
  </div>
);

const TextareaField: React.FC<TextareaFieldProps> = ({ label, name, value, onChange }) => (
  <div className="space-y-1">
    <label htmlFor={name} className="text-sm font-medium text-gray-700">{label}</label>
    <textarea id={name} name={name} value={value} onChange={onChange} rows={4} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none text-gray-800" placeholder="Jelaskan detail singkat terkait pekerjaan di atas..." />
  </div>
);
