'use client'

import { Clock, ArrowLeft } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'react-hot-toast'

const OFFICE_LOCATION = {
  latitude: 5.179003,
  longitude: 97.149272,
  RADIUS_M: 500,
}

export default function CheckInPage() {
  const router = useRouter()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [address, setAddress] = useState<string>('Mencari alamat...')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [locationStatus, setLocationStatus] = useState<string>('Mencari lokasi...')
  const [shift, setShift] = useState<'pagi' | 'malam'>('pagi')
  const [todayDate, setTodayDate] = useState(new Date().toISOString().split('T')[0])
  const [userId, setUserId] = useState<string | null>(null)
  const [canCheckIn, setCanCheckIn] = useState(true)

  // Update jam realtime
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Reset otomatis tiap tanggal baru
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]
      if (todayStr !== todayDate) {
        setTodayDate(todayStr)
        setLocation(null)
        setDistance(null)
        setAddress('Mencari alamat...')
        setLocationStatus('Mencari lokasi...')
        setIsSubmitting(false)
      }
    }, 60_000)
    return () => clearInterval(timer)
  }, [todayDate])

  // Ambil lokasi GPS
  const fetchLocation = async () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation tidak didukung browser ini.')
      return
    }

    setLocationStatus('Mengambil lokasi...')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        setLocation({ lat, lon })

        // Hitung jarak (haversine)
        const R = 6371e3
        const φ1 = OFFICE_LOCATION.latitude * Math.PI / 180
        const φ2 = lat * Math.PI / 180
        const Δφ = (lat - OFFICE_LOCATION.latitude) * Math.PI / 180
        const Δλ = (lon - OFFICE_LOCATION.longitude) * Math.PI / 180
        const a = Math.sin(Δφ / 2) ** 2 +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const dist = R * c
        setDistance(dist)

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
          )
          const data = await res.json()
          setAddress(data.display_name || 'Alamat tidak ditemukan')
        } catch {
          setAddress('Gagal mendapatkan alamat')
        }

        if (dist <= OFFICE_LOCATION.RADIUS_M)
          setLocationStatus('Lokasi valid (dalam radius kantor)')
        else setLocationStatus('Di luar radius kantor')
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED)
          setLocationStatus('Akses lokasi ditolak.')
        else setLocationStatus('Gagal mendapatkan lokasi.')
      }
    )
  }

  useEffect(() => { fetchLocation() }, [])

  const formattedTime = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const formattedDate = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Ambil user ID saat login
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) return
      setUserId(user.id)
    }
    fetchUser()
  }, [])

  // Cek apakah user sudah absen hari ini untuk shift ini
  useEffect(() => {
    const checkAttendance = async () => {
      if (!userId) return
      const { data, error } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_id', userId)
        .eq('attendance_date', todayDate)
        .eq('shift', shift)
        .maybeSingle()
      if (error) console.error('Supabase check attendance error:', error)
      setCanCheckIn(!data)
    }
    checkAttendance()
  }, [todayDate, shift, userId])

  // === HANDLE CHECK-IN ===
  const handleCheckIn = async () => {
    if (!location) return toast.error('Lokasi belum terdeteksi.')

    const isValidLocation =
      (distance && distance <= OFFICE_LOCATION.RADIUS_M) ||
      (address && address.toLowerCase().includes('lhokseumawe'))

    if (!isValidLocation) return toast.error('Lokasi di luar area kantor.')

    setIsSubmitting(true)
    try {
      if (!userId) throw new Error('Anda belum login.')

      // Pastikan profil user sudah ada
      const { data: profileCheck } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()

      if (!profileCheck) {
        await supabase.from('profiles').insert([
          { id: userId, full_name: '', position: 'PPNPN', role: 'pegawai' },
        ])
      }

      const now = new Date()

      // Tentukan shift_start & shift_end
      const shiftTimes = shift === 'pagi'
        ? { start: new Date(todayDate + 'T08:00:00'), end: new Date(todayDate + 'T17:00:00') }
        : { start: new Date(todayDate + 'T20:00:00'), end: new Date(new Date(todayDate).getTime() + 1*24*60*60*1000 + 7*60*60*1000) } // shift malam 20:00-07:00

      const statusAbsen = now > shiftTimes.start ? 'Terlambat' : 'Hadir'

      // Simpan ke attendances
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendances')
        .insert([{
          user_id: userId,
          attendance_date: todayDate,
          shift,
          shift_start: shiftTimes.start.toISOString(),
          shift_end: shiftTimes.end.toISOString(),
          check_in: now.toISOString(),
          status: statusAbsen,
          location: address,
        }])
        .select('id')
        .single()
      if (attendanceError) throw attendanceError

      // Buat logbook awal
      const { error: logbookError } = await supabase.from('logbooks').insert([{
        user_id: userId,
        attendance_id: attendanceData.id,
        shift,
        log_date: todayDate,
        description: '',
        status: 'IN_PROGRESS',
      }])
      if (logbookError) throw logbookError

      toast.success(`Absen ${shift} berhasil (${statusAbsen})`)
      setCanCheckIn(false)
      router.replace('/dashboard')
    } catch (err: any) {
      console.error('Supabase Error:', err?.message || err)
      toast.error(err?.message || 'Gagal menyimpan absen.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-blue-900 text-white p-4 shadow-lg flex items-center">
        <button onClick={() => router.back()} className="p-1 mr-4 text-white hover:text-gray-300 transition">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Absen Masuk</h1>
      </header>

      <main className="p-6">
        {/* Jam Saat Ini */}
        <div className="bg-white p-8 rounded-xl shadow-lg mb-8 text-center">
          <Clock size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Waktu Saat Ini</p>
          <h2 className="text-5xl font-extrabold text-gray-900 mb-1">{formattedTime}</h2>
          <p className="text-md text-gray-500">{formattedDate}</p>
        </div>

        {/* Pilih Shift */}
        <div className="bg-white p-4 rounded-xl shadow-md border mb-4">
          <label className="font-semibold text-gray-700">Pilih Shift:</label>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value as 'pagi' | 'malam')}
            className="mt-2 w-full border p-2 rounded-lg"
          >
            <option value="pagi">Shift Pagi</option>
            <option value="malam">Shift Malam</option>
          </select>
        </div>

        {/* Lokasi */}
        <div className="bg-white p-4 rounded-xl shadow-md border mb-5">
          <p className="font-semibold text-gray-700 mb-1">Status Lokasi:</p>
          <p className={`text-sm ${distance && distance <= OFFICE_LOCATION.RADIUS_M ? 'text-green-600' : 'text-red-600'}`}>
            {locationStatus}
          </p>
          {distance !== null && (
            <p className="mt-1 text-sm text-gray-600">
              Jarak dari kantor: <b>{distance.toFixed(1)} meter</b>
            </p>
          )}
          <p className="mt-2 text-sm text-gray-600">
            <b>Alamat Saat Ini:</b><br />{address}
          </p>
          <p className="mt-2 text-xs text-gray-400">
            Koordinat: {location ? `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}` : '...'}
          </p>

          <button
            onClick={fetchLocation}
            className="mt-3 bg-blue-900 hover:bg-blue-800 text-white text-sm font-semibold py-2 px-3 rounded-lg"
          >
            Ambil Ulang Lokasi
          </button>
        </div>

        {/* Tombol Absen */}
        <button
          onClick={handleCheckIn}
          disabled={isSubmitting || !canCheckIn}
          className={`w-full py-4 text-white font-extrabold rounded-xl transition duration-300 shadow-xl ${
            isSubmitting || !canCheckIn
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-900 hover:bg-blue-800 shadow-blue-500/50'
          }`}
        >
          {isSubmitting
            ? 'Memproses...'
            : !canCheckIn
            ? `Sudah absen shift ${shift}`
            : 'SUBMIT ABSEN MASUK'}
        </button>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 text-center">
          <p className="font-semibold text-blue-900 mb-1">Catatan:</p>
          <p>Absen akan dianggap valid jika dalam radius 500 meter dari kantor. Tombol akan aktif kembali besok untuk shift yang sama.</p>
        </div>
      </main>
    </div>
  )
}
