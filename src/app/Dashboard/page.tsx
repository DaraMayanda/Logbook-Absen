'use client';
import { 
    ArrowLeft, ArrowRight, FileText, User, 
    BarChart2, Briefcase, LogOut, AlertTriangle, RefreshCw 
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient'; 

export default function DashboardPage() {
    const router = useRouter(); 
    const [absensiStatus, setAbsensiStatus] = useState<'Belum Absen' | 'Masuk' | 'Pulang'>('Belum Absen');
    const [userData, setUserData] = useState({ fullName: "Loading...", email: "loading@kppn.go.id" });
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [hasCompletedlogbook, setHasCompletedlogbook] = useState(false);

    // ✅ Fetch profil & status absensi
    useEffect(() => {
        const fetchAndCheckStatus = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.replace('/login');
                    return;
                }

                // --- Ambil profil ---
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single();

                setUserData({
                    fullName: profileData?.full_name || user.email?.split('@')[0] || 'Pengguna KPPN',
                    email: user.email || 'N/A',
                });

                // --- Ambil logbook hari ini ---
                const today = new Date().toISOString().substring(0, 10);
                const { data: logbookData } = await supabase
                    .from('logbooks')
                    .select('start_time, end_time, activity_name, description')
                    .eq('user_id', user.id)
                    .eq('log_date', today)
                    .maybeSingle();

                if (logbookData) {
                    // Tentukan status absen
                    if (logbookData.end_time) setAbsensiStatus('Pulang');
                    else if (logbookData.start_time) setAbsensiStatus('Masuk');
                    else setAbsensiStatus('Belum Absen');

                    // Cek apakah logbook diisi
                    const islogbookFilled = 
                        (logbookData.activity_name && logbookData.activity_name.trim() !== '') ||
                        (logbookData.description && logbookData.description.trim() !== '');
                    setHasCompletedlogbook(islogbookFilled);
                } else {
                    setAbsensiStatus('Belum Absen');
                    setHasCompletedlogbook(false);
                }

            } catch (error) {
                console.error("Error fetch status:", error);
                setAbsensiStatus('Belum Absen');
                setHasCompletedlogbook(false);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndCheckStatus();
        const handleFocus = () => fetchAndCheckStatus();
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [router]);

    // --- Absen Masuk ---
    const handleAbsenMasuk = () => router.push('/checkinpage');

    // --- Absen Pulang ---
    const handleAbsenPulang = () => {
        if (!hasCompletedlogbook) return;
        router.push('/checkoutform');
    };

    // --- Logout ---
    const handleLogout = async () => {
        setIsLoggingOut(true);
        const { error } = await supabase.auth.signOut();
        if (error) console.error("Gagal logout:", error);
        router.replace('/login'); 
    };

    // --- Badge Status ---
    const StatusBadge = ({ status }: { status: string }) => {
        let bgColor = 'bg-red-600';
        let text = 'Belum Absen';
        let ringColor = 'ring-red-400';

        if (status === 'Masuk') {
            bgColor = 'bg-green-600';
            text = 'Sudah Absen Masuk';
            ringColor = 'ring-green-400';
        } else if (status === 'Pulang') {
            bgColor = 'bg-blue-600';
            text = 'Selesai Hari Ini';
            ringColor = 'ring-blue-400';
        }

        return (
            <div className={`px-4 py-2 text-white rounded-full font-semibold text-sm shadow-md transition duration-300 
                             ${bgColor} ring-2 ${ringColor} ring-opacity-50`}>
                {text}
            </div>
        );
    };

    const isPulangDisabled = absensiStatus !== 'Masuk' || !hasCompletedlogbook;

    // --- FeatureCard ---
    type FeatureCardProps = {
        icon: React.ComponentType<{ size?: number }>;
        title: string;
        description: string;
        href: string;
    };

    const FeatureCard = ({ icon: Icon, title, description, href }: FeatureCardProps) => (
        <a href={href} className="flex items-center p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition duration-300 border border-gray-100 transform hover:scale-[1.01]">
            <div className="p-3 bg-blue-100 text-blue-800 rounded-lg mr-4 shadow-inner">
                <Icon size={24} />
            </div>
            <div>
                <h3 className="font-bold text-lg text-gray-800">{title}</h3>
                <p className="text-sm text-gray-500">{description}</p>
            </div>
        </a>
    );

    if (isLoading || isLoggingOut) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-700" />
                    <p className="mt-4 text-gray-600 font-semibold">
                        {isLoggingOut ? "Sampai Jumpa..." : "Memuat Dashboard..."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <header className="bg-blue-900 text-white p-6 pb-20 shadow-xl rounded-b-2xl">
                <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-full bg-white">
                            <User size={24} className="text-blue-900" />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold">{userData.fullName}</h1>
                            <p className="text-sm opacity-80">{userData.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-white hover:text-red-300 transition duration-200 p-2 rounded-full"
                        aria-label="Logout"
                    >
                        <LogOut size={24} />
                    </button>
                </div>
            </header>

            <main className="px-5 -mt-10 pb-10">
                <div className="bg-white p-5 rounded-xl shadow-2xl mb-6 border-b-4 border-blue-500">
                    <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">Status Absensi Hari Ini</h2>
                    <div className="flex items-center justify-between">
                        <StatusBadge status={absensiStatus} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <button
                        onClick={handleAbsenMasuk}
                        className="flex items-center justify-center space-x-2 bg-blue-800 text-white py-3 rounded-xl shadow-lg hover:bg-blue-700 transition duration-300 disabled:bg-gray-400 disabled:shadow-none"
                        disabled={absensiStatus !== 'Belum Absen'}
                    >
                        <ArrowRight size={20} />
                        <span className="font-bold">Absen Masuk</span>
                    </button>

                    <button
                        onClick={handleAbsenPulang}
                        className={`flex items-center justify-center space-x-2 py-3 rounded-xl shadow-lg transition duration-300 
                                     ${isPulangDisabled ? 'bg-gray-400 text-gray-200 disabled:shadow-none' : 'bg-green-600 text-white hover:bg-green-700'}`}
                        disabled={isPulangDisabled}
                    >
                        <ArrowLeft size={20} />
                        <span className="font-bold">Absen Pulang</span>
                    </button>
                </div>

                {/* Alert Logbook */}
                {absensiStatus === 'Masuk' && (
                    <div className={`p-4 mb-8 rounded-xl shadow-sm border ${hasCompletedlogbook ? 'bg-green-50 border-green-300 text-green-800' : 'bg-yellow-50 border-yellow-300 text-yellow-800'}`}>
                        <p className="font-semibold text-center flex items-center justify-center">
                            <AlertTriangle size={20} className={`mr-2 ${hasCompletedlogbook ? 'text-green-600' : ''}`} />
                            {hasCompletedlogbook 
                                ? 'Logbook Harian telah terisi. Anda siap untuk Absen Pulang.' 
                                : '⚠️ Segera isi Logbook Harian Anda sebelum melakukan Absen Pulang.'}
                        </p>
                    </div>
                )}

                <h2 className="text-lg font-bold text-gray-800 mb-4">Menu Aplikasi</h2>
                <div className="space-y-4">
                    <FeatureCard
                        icon={FileText}
                        title="logbook"
                        description="Catat detail aktivitas harian Anda."
                        href="/logbook"
                    />
                    <FeatureCard
                        icon={Briefcase}
                        title="Pengajuan Cuti"
                        description="Ajukan permohonan cuti atau izin."
                        href="/pengajuancutipage"
                    />
                    <FeatureCard
                        icon={BarChart2}
                        title="Rekap Absensi"
                        description="Lihat riwayat kehadiran bulanan."
                        href="/rekapabsensi"
                    />
                </div>
            </main>
        </div>
    );
}
