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
  endTime: string;
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
  const today = useMemo(() => new Date().toISOString().substring(0, 10), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData>({ fullName: '', position: 'Staf Pelaksana' });

  const [logbookIdToUpdate, setLogbookIdToUpdate] = useState<number | null>(null);
  const [isLogbookCompleted, setIsLogbookCompleted] = useState<boolean>(false);

  const [tasks, setTasks] = useState<string[]>([]);
  const [currentTaskInput, setCurrentTaskInput] = useState<string>('');
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [hasCheckedIn, setHasCheckedIn] = useState<boolean>(false); 

  const [formData, setFormData] = useState<FormData>({
    date: today,
    startTime: '08:00',
    endTime: new Date().toTimeString().substring(0, 5),
    description: '',
  });

  // Fetch user, profile, and check logbook status
  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      setError('');
      setLogbookIdToUpdate(null);
      setIsLogbookCompleted(false);

      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr || !user) throw new Error('Gagal memeriksa sesi. Silakan login ulang.');

        setUserId(user.id);
        const defaultFullNameFromEmail = user.email ? user.email.split('@')[0] : 'Pegawai';

        // Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, position')
          .eq('id', user.id)
          .maybeSingle();

        setUserData({
          fullName: profileData?.full_name || defaultFullNameFromEmail,
          position: profileData?.position || 'Staf Pelaksana',
        });

        // Check today's logbook
        const { data: checkInEntry } = await supabase
          .from('logbooks')
          .select('id, start_time, status, activity_name')
          .eq('user_id', user.id)
          .eq('log_date', today)
          .maybeSingle();

        if (!checkInEntry) {
          setHasCheckedIn(false);
          setError('Anda harus melakukan Absen Masuk terlebih dahulu sebelum mengisi Logbook.');
        } else {
          setHasCheckedIn(true);
          setLogbookIdToUpdate(checkInEntry.id);

          setFormData(prev => ({
            ...prev,
            startTime: checkInEntry.start_time.substring(0, 5),
          }));

          if (checkInEntry.status === 'COMPLETED') {
            setIsLogbookCompleted(true);
            setError('Anda sudah mengisi Logbook Harian untuk tanggal ini.');
            if (checkInEntry.activity_name) {
              setTasks(checkInEntry.activity_name.split('; '));
            }
          }
        }

      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Terjadi kesalahan saat memuat data pengguna.');
      } finally {
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
    if (!tasks.includes(trimmed)) setTasks(prev => [...prev, trimmed]);
    setCurrentTaskInput('');
    setAutocompleteSuggestions([]);
  };

  const removeTask = (index: number) => setTasks(prev => prev.filter((_, i) => i !== index));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name in formData) setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!hasCheckedIn || isLogbookCompleted) {
      setError(isLogbookCompleted ? 'Logbook sudah diisi.' : 'Anda harus Absen Masuk.');
      return;
    }

    if (!logbookIdToUpdate) {
      setError('ID Logbook untuk pembaruan tidak ditemukan. Coba refresh.');
      return;
    }

    if (tasks.length === 0) {
      setError('Mohon tambahkan minimal satu tugas/pekerjaan.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        activity_name: tasks.join('; '),
        description: formData.description || null,
        end_time: formData.endTime,
        status: 'COMPLETED',
      };

      const { error: updateError } = await supabase
        .from('logbooks')
        .update(payload)
        .eq('id', logbookIdToUpdate);

      if (updateError) {
        console.error('Gagal menyimpan Logbook:', updateError);
        setError(`Gagal menyimpan data: ${updateError.message}`);
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      console.error('unexpected update error:', err);
      setError('Terjadi kesalahan saat menyimpan logbook.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <RefreshCw className="h-8 w-8 animate-spin text-blue-700" />
      <p className="ml-4 text-gray-600 font-semibold">Memuat data...</p>
    </div>
  );

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4 mb-4">
          <InputField label="Nama Pegawai" value={userData.fullName} icon={User} readOnly />
          <InputField label="Jabatan" value={userData.position} icon={Briefcase} readOnly />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <InputField label="Tanggal" name="date" type="date" value={formData.date} onChange={handleChange} icon={Calendar} readOnly />
          <InputField label="Jam Mulai (Absen Masuk)" name="startTime" type="time" value={formData.startTime} onChange={handleChange} icon={Clock} readOnly />
          <InputField label="Jam Selesai (Pekerjaan)" name="endTime" type="time" value={formData.endTime} onChange={handleChange} icon={Clock} readOnly={isLogbookCompleted || !hasCheckedIn} />
        </div>

        <TaskInputSection
          tasks={tasks}
          currentTaskInput={currentTaskInput}
          handleTaskInputChange={handleTaskInputChange}
          autocompleteSuggestions={autocompleteSuggestions}
          addTask={addTask}
          removeTask={removeTask}
        />

        <TextareaField
          label="Keterangan Tambahan (Opsional)"
          name="description"
          value={formData.description}
          onChange={handleChange}
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

// --- Helper components ---
const InputField: React.FC<InputFieldProps> = ({ label, name, type = 'text', value, onChange, icon: Icon, readOnly = false }) => (
  <div className="space-y-1">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <div className={`flex items-center border ${readOnly ? 'border-gray-200 bg-gray-100' : 'border-gray-300 focus-within:ring-2 focus-within:ring-blue-500'} rounded-lg overflow-hidden transition`}>
      {Icon && <Icon size={20} className={`ml-3 ${readOnly ? 'text-gray-500' : 'text-blue-500'}`} />}
      <input type={type} name={name} value={value} onChange={onChange} readOnly={readOnly} required={!readOnly} className={`w-full p-3 ${readOnly ? 'text-gray-600' : 'text-gray-800'} focus:outline-none bg-transparent`} />
    </div>
  </div>
);

const TextareaField: React.FC<TextareaFieldProps> = ({ label, name, value, onChange }) => (
  <div className="space-y-1">
    <label htmlFor={name} className="text-sm font-medium text-gray-700">{label}</label>
    <textarea id={name} name={name} value={value} onChange={onChange} rows={4} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none text-gray-800" placeholder="Jelaskan detail singkat terkait pekerjaan di atas..." />
  </div>
);

const TaskInputSection: React.FC<TaskInputSectionProps> = ({ tasks, currentTaskInput, handleTaskInputChange, autocompleteSuggestions, addTask, removeTask }) => (
  <div className="space-y-4">
    <label className="text-sm font-medium text-gray-700 block">Daftar Tugas/Pekerjaan Harian</label>
    <div className="relative">
      <div className="flex space-x-2">
        <input type="text" value={currentTaskInput} onChange={handleTaskInputChange} placeholder="Masukkan nama tugas..." className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800" />
        <button type="button" onClick={() => addTask()} disabled={currentTaskInput.trim().length === 0} className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center">
          <Plus size={20} />
        </button>
      </div>

      {autocompleteSuggestions.length > 0 && currentTaskInput.length > 2 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
          {autocompleteSuggestions.map((task, index) => (
            <li key={index} onClick={() => addTask(task)} className="p-3 cursor-pointer hover:bg-blue-50 text-gray-800">{task}</li>
          ))}
        </ul>
      )}
    </div>

    {tasks.length > 0 && (
      <div className="space-y-2 pt-2">
        {tasks.map((task, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
            <span className="text-sm font-medium text-blue-800 truncate pr-2">{task}</span>
            <button type="button" onClick={() => removeTask(index)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);
