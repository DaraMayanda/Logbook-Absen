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
    startTime: '08:00',
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

  const tugasCS = [
    "Membersihkan ruangan kerja, lantai, dan area umum kantor",
    "Mengosongkan tempat sampah dan mengganti kantong plastik",
    "Membersihkan toilet dan memastikan ketersediaan sabun serta tisu",
    "Membersihkan kaca, meja, kursi, dan peralatan kantor lainnya",
    "Mengepel dan menyapu lantai setiap pagi dan sore",
    "Menyemprot disinfektan secara berkala",
    "Menjaga kebersihan pantry dan area makan pegawai",
    "Membantu menyiapkan ruangan rapat atau kegiatan kantor",
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

        // 🔹 Tentukan daftar tugas berdasarkan posisi
        const posisi = position.toLowerCase();
        if (posisi.includes('satpam')) {
          setStandardTasks(tugasSatpam);
        } else if (posisi.includes('supir')) {
          setStandardTasks(tugasSupir);
        } else if (posisi.includes('cleaning')) {
          setStandardTasks(tugasCS);
        } else {
          setStandardTasks(tugasPPNPN);
        }

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
          setFormData(prev => ({ ...prev, startTime: logbookData.start_time?.substring(0, 5) || '08:00' }));

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
      {/* ...seluruh bagian render tetap sama persis... */}
    </div>
  );
}
