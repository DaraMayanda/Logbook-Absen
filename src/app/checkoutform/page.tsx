'use client';

import { Clock, ArrowLeft } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';

const OFFICE_LOCATION = { latitude: 5.179003, longitude: 97.149272, RADIUS_M: 500 };
const VALID_LOGBOOK_STATUS = ['COMPLETED'];

export default function CheckOutForm() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [address, setAddress] = useState('Mencari alamat...');
  const [locationStatus, setLocationStatus] = useState('Mencari lokasi...');
  const [attendanceId, setAttendanceId] = useState<number | null>(null);
  const [logbookStatus, setLogbookStatus] = useState<string | null>(null);
  const [currentShift, setCurrentShift] = useState<'pagi' | 'malam' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [canCheckOut, setCanCheckOut] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Realtime clock ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Haversine distance ---
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // --- Fetch location ---
  const fetchLocation = () => {
    if (!navigator.geolocation) return setLocationStatus('Geolocation tidak didukung browser ini.');
    setLocationStatus('Mengambil lokasi...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocation({ lat, lon });
        const dist = calculateDistance(lat, lon, OFFICE_LOCATION.latitude, OFFICE_LOCATION.longitude);
        setDistance(dist);

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
          const data = await res.json();
          setAddress(data.display_name || 'Alamat tidak ditemukan');
        } catch {
          setAddress('Gagal mendapatkan alamat');
        }

        setLocationStatus(dist <= OFFICE_LOCATION.RADIUS_M ? '✅ Lokasi valid (dalam radius kantor)' : '🚫 Di luar radius kantor');
      },
      (error) => {
        console.error(error);
        setLocationStatus(error.code === error.PERMISSION_DENIED ? 'Akses lokasi ditolak.' : 'Gagal mendapatkan lokasi.');
      }
    );
  };

  useEffect(() => { fetchLocation(); }, []);

  // --- Ambil user ID ---
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
    };
    fetchUser();
  }, []);

  // --- Ambil attendance shift aktif & logbook ---
  const fetchActiveShift = async () => {
    if (!userId) return;
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const yesterday = new Date(now.getTime() - 24*60*60*1000).toISOString().split('T')[0];

      const { data: attendances } = await supabase
        .from('attendances')
        .select('id, shift, check_in, check_out, attendance_date')
        .in('attendance_date', [yesterday, todayStr])
        .eq('user_id', userId);

      if (!attendances || attendances.length === 0) {
        setAttendanceId(null); setCurrentShift(null); setLogbookStatus(null); setCanCheckOut(false); return;
      }

      const activeShift = attendances.find(a => !a.check_out);
      if (!activeShift) { setAttendanceId(null); setCurrentShift(null); setLogbookStatus(null); setCanCheckOut(false); return; }

      setAttendanceId(activeShift.id);
      setCurrentShift(activeShift.shift as 'pagi' | 'malam');

      const { data: logbook } = await supabase
        .from('logbooks')
        .select('status')
        .eq('attendance_id', activeShift.id)
        .eq('shift', activeShift.shift)
        .maybeSingle();

      setLogbookStatus(logbook?.status || 'IN_PROGRESS');
      setCanCheckOut(VALID_LOGBOOK_STATUS.includes(logbook?.status?.toUpperCase() || ''));
    } catch (err) {
      console.error('DEBUG fetchActiveShift error:', err);
      setCanCheckOut(false);
    }
  };

  useEffect(() => { fetchActiveShift(); }, [userId, currentTime]);

  // --- Handle CheckOut ---
  const handleCheckOut = async () => {
    if (!attendanceId) return toast.error('Attendance shift ini belum tersedia.');
    if (!location) return toast.error('Lokasi belum terdeteksi.');
    if (!currentShift) return toast.error('Shift belum terdeteksi.');
    if (!logbookStatus || !VALID_LOGBOOK_STATUS.includes(logbookStatus.toUpperCase()))
      return toast.error('Logbook belum COMPLETED.');
    if (distance !== null && distance > OFFICE_LOCATION.RADIUS_M)
      return toast.error('Anda berada di luar radius kantor.');

    setIsSubmitting(true);
    try {
      const now = new Date();
      const { error } = await supabase
        .from('attendances')
        .update({
          check_out: now.toISOString(),
          check_out_location: address,
          check_out_latitude: location.lat,
          check_out_longitude: location.lon,
          check_out_distance_m: distance,
          status: 'COMPLETED'
        })
        .eq('id', attendanceId);
      if (error) throw error;

      toast.success(`✅ Absen Pulang Shift ${currentShift.toUpperCase()} berhasil!`);
      router.replace('/dashboard');
    } catch (err: any) {
      console.error('DEBUG handleCheckOut error full:', err);
      toast.error(err?.message || 'Gagal absen pulang');
    } finally { setIsSubmitting(false); }
  };

  const formattedTime = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isOutOfRadius = distance !== null && distance > OFFICE_LOCATION.RADIUS_M;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-blue-900 text-white p-4 shadow-lg flex items-center">
        <button onClick={() => router.back()} className="p-1 mr-4 text-white hover:text-gray-300 transition">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Absen Pulang Shift {currentShift?.toUpperCase() || '...'} </h1>
      </header>

      <main className="p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg mb-8 text-center">
          <Clock size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Waktu Saat Ini</p>
          <h2 className="text-5xl font-extrabold text-gray-900 mb-1">{formattedTime}</h2>
          <p className="text-md text-gray-500">{formattedDate}</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-md border mb-5">
          <p className="font-semibold text-gray-700 mb-1">Status Lokasi:</p>
          <p className={`text-sm ${isOutOfRadius ? 'text-red-600' : 'text-green-600'}`}>{locationStatus}</p>
          {distance !== null && <p className="mt-1 text-sm text-gray-600">Jarak dari kantor: <b>{distance.toFixed(1)} meter</b></p>}
          <p className="mt-2 text-sm text-gray-600"><b>Alamat Saat Ini:</b><br />{address}</p>
          <p className="mt-2 text-xs text-gray-400">Koordinat: {location ? `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}` : '...'}</p>

          <button onClick={fetchLocation} className="mt-3 bg-blue-900 hover:bg-blue-800 text-white text-sm font-semibold py-2 px-3 rounded-lg">
            Ambil Ulang Lokasi
          </button>
        </div>

        <button
          onClick={handleCheckOut}
          disabled={isSubmitting || !canCheckOut || isOutOfRadius || !currentShift}
          className={`w-full py-4 text-white font-extrabold rounded-xl transition duration-300 shadow-xl ${
            isSubmitting ? 'bg-gray-400 cursor-wait' : canCheckOut ? 'bg-blue-900 hover:bg-blue-800 shadow-blue-500/50' : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? 'Memproses...' : isOutOfRadius ? 'Anda di luar radius kantor' : !currentShift ? 'Shift belum terdeteksi' : `SUBMIT ABSEN PULANG`}
        </button>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 text-center">
          <p>Absen Pulang hanya bisa dilakukan setelah logbook <b>COMPLETED</b> dan lokasi berada dalam radius 500 meter dari kantor.</p>
        </div>
      </main>
    </div>
  );
}
