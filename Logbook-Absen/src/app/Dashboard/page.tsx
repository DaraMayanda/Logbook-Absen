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
    const [hasCompletedLogbook, setHasCompletedLogbook] = useState(false); 

    // ✅ Fetch data profil, status absensi, dan logbook
    useEffect(() => {
        const fetchAndCheckStatus = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/login');
                return;
            }

            // --- Ambil profil pengguna ---
            const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single();
            
            setUserData({
                fullName: profileData?.full_name || user.email?.split('@')[0] || 'Pengguna KPPN', 
                email: user.email || 'N/A',
            });

            // --- Ambil status absensi dari localStorage ---
            if (typeof window !== 'undefined') {
                const storedStatus = localStorage.getItem('absensi_status') as 'Belum Absen' | 'Masuk' | 'Pulang';
                if (storedStatus) setAbsensiStatus(storedStatus);
            }

            // --- Cek apakah logbook hari ini sudah diisi ---
            const today = new Date().toISOString().substring(0, 10); 
            const { data: logbookData, error: logbookError } = await supabase
                .from('logbooks')
                .select('id')
                .eq('user_id', user.id)
                .eq('log_date', today);

            if (logbookError) {
                console.error("Gagal cek logbook:", logbookError.message);
                setHasCompletedLogbook(false);
            } else {
                setHasCompletedLogbook(logbookData && logbookData.length > 0);
            }

            setIsLoading(false);
        };

        fetchAndCheckStatus();

        // 🔁 Refresh otomatis saat user kembali ke tab Dashboard
        const handleFocus = () => fetchAndCheckStatus();
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [router]);

    // --- Fungsi Tombol ---
    const handleAbsenMasuk = () => {
        router.push('/CheckInPage'); 
    };

    const handleAbsenPulang = async () => {
        if (!hasCompletedLogbook) {
            console.error("Logbook belum diisi. Tidak dapat Absen Pulang.");
            return; 
        }

        setAbsensiStatus('Pulang');
        localStorage.setItem('absensi_status', 'Pulang');

        // TODO: bisa tambahkan insert ke tabel absensi di Supabase di sini
        console.log("Absen Pulang berhasil dicatat.");
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        const { error } = await supabase.auth.signOut();
        if (error) console.error("Gagal logout:", error);
        localStorage.removeItem('absensi_status');
        router.replace('/Login'); 
    };

    // --- Badge Status ---
    const StatusBadge = ({ status }: { status: string }) => {
        let bgColor: string;
        let text: string;
        let ringColor: string; 

        if (status === 'Masuk') {
            bgColor = 'bg-green-600';
            text = 'Sudah Absen Masuk';
            ringColor = 'ring-green-400';
        } else if (status === 'Pulang') {
            bgColor = 'bg-blue-600';
            text = 'Selesai Hari Ini';
            ringColor = 'ring-blue-400';
        } else {
            bgColor = 'bg-red-600';
            text = 'Belum Absen';
            ringColor = 'ring-red-400';
        }

        return (
            <div className={`px-4 py-2 text-white rounded-full font-semibold text-sm shadow-md transition duration-300 
                             ${bgColor} ring-2 ${ringColor} ring-opacity-50`}>
                {text}
            </div>
        );
    };

    // --- Kartu Menu ---
    const FeatureCard = ({ icon: Icon, title, description, href }: { icon: any, title: string, description: string, href: string }) => (
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

    // --- Loading Screen ---
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

    // --- Kondisi Tombol Absen Pulang ---
    const isPulangDisabled = absensiStatus !== 'Masuk' || !hasCompletedLogbook;

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {/* Header */}
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

            {/* Main Content */}
            <main className="px-5 -mt-10 pb-10">
                {/* Status Absensi */}
                <div className="bg-white p-5 rounded-xl shadow-2xl mb-6 border-b-4 border-blue-500">
                    <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">Status Absensi Hari Ini</h2>
                    <div className="flex items-center justify-between">
                        <StatusBadge status={absensiStatus} />
                    </div>
                </div>

                {/* Tombol Absensi */}
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

                {/* Peringatan Logbook */}
                {absensiStatus === 'Masuk' && (
                    <div className={`p-4 mb-8 rounded-xl shadow-sm border ${hasCompletedLogbook ? 'bg-green-50 border-green-300 text-green-800' : 'bg-yellow-50 border-yellow-300 text-yellow-800'}`}>
                        <p className="font-semibold flex justify-center items-center text-center">
                            <AlertTriangle size={20} className={`mr-3 flex-shrink-0 hidden sm:inline ${hasCompletedLogbook ? 'text-green-600' : 'text-yellow-600'}`} />
                            <span className={hasCompletedLogbook ? 'text-green-900' : 'text-yellow-900'}>
                                {hasCompletedLogbook 
                                    ? "Logbook Harian telah terisi. Anda siap untuk Absen Pulang." 
                                    : "Penting: Mohon isi Logbook Harian Anda sebelum melakukan absen pulang."}
                            </span>
                        </p>
                    </div>
                )}

                {/* Menu Aplikasi */}
                <h2 className="text-lg font-bold text-gray-800 mb-4">Menu Aplikasi</h2>
                <div className="space-y-4">
                    <FeatureCard
                        icon={FileText}
                        title="Logbook"
                        description="Catat detail aktivitas harian Anda."
                        href="/Logbook"
                    />
                    <FeatureCard
                        icon={Briefcase}
                        title="Pengajuan Cuti"
                        description="Ajukan permohonan cuti atau izin."
                        href="/PengajuanCutiPage"
                    />
                    <FeatureCard
                        icon={BarChart2}
                        title="Rekap Absensi"
                        description="Lihat riwayat kehadiran bulanan."
                        href="/RekapAbsensi"
                    />
                </div>
            </main>
        </div>
    );
}
