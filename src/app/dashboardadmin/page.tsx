'use client';

import { 
  User, LogOut, FileText, Briefcase, BarChart2, AlertTriangle, RefreshCw
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardAdmin() {
  const router = useRouter();
  const [userData, setUserData] = useState({ fullName: 'Loading...', email: 'loading@kppn.go.id' });
  const [totalPegawai, setTotalPegawai] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // --- Fetch admin profile ---
  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/login'); return; }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name,email,role')
          .eq('id', user.id)
          .single();

        setUserData({
          fullName: profile?.full_name || user.email?.split('@')[0] || 'Admin',
          email: profile?.email || user.email || 'N/A',
        });

      } catch (err) { console.error(err); }
      finally { setIsLoading(false); }
    };
    fetchProfile();
  }, [router]);

  // --- Fetch total pegawai & realtime ---
  useEffect(() => {
    const fetchTotalPegawai = async () => {
      try {
        const { count, error } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'pegawai');

        if (!error && count !== null) {
          setTotalPegawai(count);
        }
      } catch (err) {
        console.error('Error fetching total pegawai:', err);
      }
    };

    fetchTotalPegawai();

    // Realtime listener Supabase v2+
    const channel = supabase
      .channel('realtime-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        fetchTotalPegawai();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.replace('/login');
  };

  // --- Loading state ---
  if (isLoading || isLoggingOut) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-700" />
        <p className="mt-4 text-gray-600 font-semibold">{isLoggingOut ? "Sampai Jumpa..." : "Memuat Dashboard Admin..."}</p>
      </div>
    </div>
  );

  // --- Admin feature card ---
  type FeatureCardProps = { icon: React.ComponentType<{ size?: number }>, title: string, description: string, href: string };
  const FeatureCard = ({ icon: Icon, title, description, href }: FeatureCardProps) => (
    <a href={href} className="flex items-center p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition duration-300 border border-gray-100 transform hover:scale-[1.01]">
      <div className="p-3 bg-blue-100 text-blue-800 rounded-lg mr-4 shadow-inner"><Icon size={24} /></div>
      <div>
        <h3 className="font-bold text-lg text-gray-800">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </a>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-blue-900 text-white p-6 pb-20 shadow-xl rounded-b-2xl">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-white"><User size={24} className="text-blue-900" /></div>
            <div>
              <h1 className="text-xl font-extrabold">{userData.fullName}</h1>
              <p className="text-sm opacity-80">{userData.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-white hover:text-red-300 transition duration-200 p-2 rounded-full" aria-label="Logout">
            <LogOut size={24} />
          </button>
        </div>
      </header>

      <main className="px-5 -mt-10 pb-10">
        {/* Card jumlah pegawai */}
        <div className="mb-6 p-4 rounded-xl bg-white shadow-md flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Jumlah Pegawai</h3>
            <p className="text-2xl font-bold text-gray-900">{totalPegawai} orang</p>
          </div>
          <User size={36} className="text-blue-600" />
        </div>

        {/* Menu Admin */}
        <h2 className="text-lg font-bold mb-4">Menu Admin</h2>
        <div className="flex flex-col gap-4">
          <FeatureCard icon={FileText} title="Data Pegawai" description="Lihat semua data pegawai." href="/datapegawai" />
          <FeatureCard icon={Briefcase} title="Approval Cuti" description="Lihat dan approve pengajuan cuti pegawai." href="/approvalcuti" />
          <FeatureCard icon={BarChart2} title="Rekap Absensi" description="Lihat laporan absensi bulanan pegawai." href="/rekapabsensiadmin" />
        </div>

        {/* Info atau alert */}
        <div className="mt-8 p-4 rounded-xl shadow-sm border bg-yellow-50 border-yellow-300 text-yellow-800">
          <p className="font-semibold text-center flex items-center justify-center">
            <AlertTriangle size={20} className="mr-2 text-yellow-600" />
            Pastikan selalu cek pengajuan cuti dan absensi untuk kelancaran operasional!
          </p>
        </div>
      </main>
    </div>
  );
}
