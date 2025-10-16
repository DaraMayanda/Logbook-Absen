'use client';

import React, { useEffect, useState, RefAttributes } from 'react';
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
  endTime: string;
  keterangan: string;
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

interface TaskInputSectionProps {
  tasks: string[];
  currentTaskInput: string;
  handleTaskInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autocompleteSuggestions: string[];
  addTask: (taskToAdd?: string) => void;
  removeTask: (index: number) => void;
}

// --- Standard tasks ---
const standardTasks: string[] = [
  "Pelaksanaan rekonsiliasi laporan keuangan",
  "Verifikasi Surat Perintah Membayar (SPM)",
  "Penyusunan Laporan Pertanggungjawaban (LPJ)",
  "Input data transaksi ke sistem SAKTI",
  "Pelayanan konsultasi anggaran",
  "Monitoring dan evaluasi kinerja PPNPN",
  "Administrasi persuratan dan kearsipan",
  "Rapat koordinasi internal",
  "Pengarsipan dokumen dinas",
  "Penyelesaian naskah dinas",
];

// --- Main component ---
export default function LogbookPage() {
  const router = useRouter();
  const today = new Date().toISOString().substring(0, 10);

  const [userId, setUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData>({ fullName: '', position: 'Staf Pelaksana' });

  const [tasks, setTasks] = useState<string[]>([]);
  const [currentTaskInput, setCurrentTaskInput] = useState<string>('');
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [hasProfile, setHasProfile] = useState<boolean>(false); // true jika profil (absen masuk) ada

  const [formData, setFormData] = useState<FormData>({
    date: today,
    startTime: '08:00',
    endTime: new Date().toTimeString().substring(0, 5),
    keterangan: '',
  });

  // Fetch user & profile safely
  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      setError('');

      if (!supabase) {
        setError("Koneksi Supabase gagal. Pastikan '@/lib/supabaseClient' terkonfigurasi.");
        setIsLoading(false);
        return;
      }

      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr) {
          console.error('getUser error:', userErr);
          setError('Gagal memeriksa sesi. Silakan login ulang.');
          setIsLoading(false);
          return;
        }

        if (!user) {
          setError('Pengguna belum terautentikasi. Silakan login.');
          setIsLoading(false);
          return;
        }

        setUserId(user.id);

        const defaultFullNameFromEmail = user.email ? user.email.split('@')[0] : 'Pegawai';

        // IMPORTANT: use maybeSingle() so it won't throw when no profile row exists
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, position')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          // log but continue with fallback; maybeSingle avoids coercion error
          console.error('profiles fetch error:', profileError);
        }

       if (!profileData) {
  // No profile -> treat as "not absen masuk" and prevent submitting logbook
  setHasProfile(false);
  setUserData({
    fullName: defaultFullNameFromEmail,
    position: 'Belum Absen Masuk',
  });
  setError('Anda belum melakukan absen masuk. Silakan absen terlebih dahulu sebelum mengisi logbook.');
  setIsLoading(false);
  return;
}


        // Profile exists
        setHasProfile(true);
        const finalFullName = profileData.full_name && profileData.full_name.trim().length > 0
          ? profileData.full_name
          : defaultFullNameFromEmail;
        const finalPosition = profileData.position || 'Staf Pelaksana';

        setUserData({
          fullName: finalFullName,
          position: finalPosition,
        });

        // Check if logbook already exists today
        const { data: existingLog, error: logbookError } = await supabase
          .from('logbooks')
          .select('id')
          .eq('user_id', user.id)
          .eq('log_date', today);

        if (logbookError) {
          console.error('logbooks check error:', logbookError);
          // non-fatal: show message but still allow filling if profile exists
          setError(`Gagal memeriksa status Logbook: ${logbookError.message}`);
        } else if (existingLog && existingLog.length > 0) {
          setError('Anda sudah mengisi Logbook Harian untuk tanggal ini.');
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error('unexpected fetchUserData error:', err);
        setError('Terjadi kesalahan saat memuat data pengguna.');
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [today]);

  // Handlers
  const handleTaskInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setCurrentTaskInput(input);

    if (input.length > 2) {
      const filtered = standardTasks.filter(t => t.toLowerCase().includes(input.toLowerCase()));
      setAutocompleteSuggestions(filtered);
    } else {
      setAutocompleteSuggestions([]);
    }
  };

  const addTask = (taskToAdd: string = currentTaskInput) => {
    const trimmed = taskToAdd.trim();
    if (!trimmed) return;
    if (!tasks.includes(trimmed)) {
      setTasks(prev => [...prev, trimmed]);
    }
    setCurrentTaskInput('');
    setAutocompleteSuggestions([]);
  };

  const removeTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'date' || name === 'startTime' || name === 'endTime' || name === 'keterangan') {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!hasProfile) {
      setError('Anda harus absen masuk terlebih dahulu sebelum mengisi Logbook.');
      return;
    }

    if (!userId) {
      setError('User ID tidak ditemukan. Silakan login ulang.');
      return;
    }

    if (tasks.length === 0) {
      setError('Mohon tambahkan minimal satu tugas/pekerjaan.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Save single logbook row containing tasks array + keterangan
      const payload = {
        user_id: userId,
        log_date: formData.date,
        start_time: formData.startTime,
        end_time: formData.endTime,
        tasks, // array -> store as json/text[] depending on your column type
        keterangan: formData.keterangan || null,
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from('logbooks').insert([payload]);

      if (insertError) {
        console.error('Gagal menyimpan Logbook:', insertError);
        setError(`Gagal menyimpan data: ${insertError.message}`);
      } else {
        // success
        setTasks([]);
        setFormData(prev => ({ ...prev, keterangan: '' }));
        router.replace('/'); // or router.push('/Dashboard')
      }
    } catch (err: any) {
      console.error('unexpected insert error:', err);
      setError('Terjadi kesalahan saat menyimpan logbook.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading UI
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-700" />
        <p className="ml-4 text-gray-600 font-semibold">Memuat data pengguna...</p>
      </div>
    );
  }

  // Main render (design kept)
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
        {/* Profile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4 mb-4">
          <InputField
            label="Nama Pegawai"
            value={userData.fullName}
            icon={User}
            readOnly={true}
            name="date"
            onChange={() => {}}
          />
          <InputField
            label="Jabatan"
            value={userData.position}
            icon={Briefcase}
            readOnly={true}
            name="date"
            onChange={() => {}}
          />
        </div>

        {/* Waktu */}
        <div className="grid grid-cols-3 gap-4">
          <InputField
            label="Tanggal"
            name="date"
            type="date"
            value={formData.date}
            onChange={handleChange}
            icon={Calendar}
          />
          <InputField
            label="Jam Mulai"
            name="startTime"
            type="time"
            value={formData.startTime}
            onChange={handleChange}
            icon={Clock}
          />
          <InputField
            label="Jam Selesai"
            name="endTime"
            type="time"
            value={formData.endTime}
            onChange={handleChange}
            icon={Clock}
          />
        </div>

        {/* Tasks */}
        <TaskInputSection
          tasks={tasks}
          currentTaskInput={currentTaskInput}
          handleTaskInputChange={handleTaskInputChange}
          autocompleteSuggestions={autocompleteSuggestions}
          addTask={addTask}
          removeTask={removeTask}
        />

        {/* Keterangan */}
        <TextareaField
          label="Keterangan Tambahan (Opsional)"
          name="keterangan"
          value={formData.keterangan}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange(e)}
        />

        {/* Error / warnings */}
        {error && (
          <div className="flex items-center p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <AlertTriangle size={20} className="mr-2" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* If user hasn't absen, show yellow notice */}
        {!hasProfile && (
          <div className="flex items-center p-3 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg">
            <p className="text-sm">⚠️ Anda belum melakukan absen masuk — silakan absen terlebih dahulu.</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || tasks.length === 0 || !hasProfile}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 mt-8 rounded-xl shadow-lg hover:bg-blue-700 transition duration-300 font-bold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <RefreshCw size={20} className="animate-spin" />
          ) : (
            <Send size={20} />
          )}
          <span>{isSubmitting ? 'Menyimpan...' : 'Submit Logbook'}</span>
        </button>
      </form>
    </div>
  );
}

// --- Helper components ---

const InputField: React.FC<InputFieldProps> = ({ label, name, type = 'text', value, onChange, icon: Icon, readOnly = false }) => (
  <div className="space-y-1">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <div className={`flex items-center border ${readOnly ? 'border-gray-200 bg-gray-100' : 'border-gray-300 focus-within:ring-2 focus-within:ring-blue-500'} rounded-lg overflow-hidden transition`}>
      {Icon && <Icon size={20} className={`ml-3 ${readOnly ? 'text-gray-500' : 'text-blue-500'}`} />}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        required={!readOnly}
        className={`w-full p-3 ${readOnly ? 'text-gray-600' : 'text-gray-800'} focus:outline-none bg-transparent`}
      />
    </div>
  </div>
);

const TextareaField: React.FC<TextareaFieldProps> = ({ label, name, value, onChange }) => (
  <div className="space-y-1">
    <label htmlFor={name} className="text-sm font-medium text-gray-700">{label}</label>
    <textarea
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      rows={4}
      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none text-gray-800"
      placeholder="Jelaskan detail singkat terkait pekerjaan di atas..."
    />
  </div>
);

const TaskInputSection: React.FC<TaskInputSectionProps> = ({ tasks, currentTaskInput, handleTaskInputChange, autocompleteSuggestions, addTask, removeTask }) => (
  <div className="space-y-4">
    <label className="text-sm font-medium text-gray-700 block">Daftar Tugas/Pekerjaan Harian</label>
    <div className="relative">
      <div className="flex space-x-2">
        <input
          type="text"
          value={currentTaskInput}
          onChange={handleTaskInputChange}
          placeholder="Masukkan nama tugas..."
          className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
        />
        <button
          type="button"
          onClick={() => addTask()}
          disabled={currentTaskInput.trim().length === 0}
          className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
        >
          <Plus size={20} />
        </button>
      </div>

      {autocompleteSuggestions.length > 0 && currentTaskInput.length > 2 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
          {autocompleteSuggestions.map((task, index) => (
            <li
              key={index}
              onClick={() => addTask(task)}
              className="p-3 cursor-pointer hover:bg-blue-50 text-gray-800"
            >
              {task}
            </li>
          ))}
        </ul>
      )}
    </div>

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
);
