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

export default function CheckOutForm() {
  const router = useRouter()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [address, setAddress] = useState<string>('Mencari alamat...')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [locationStatus, setLocationStatus] = useState<string>('Mencari lokasi...')
  const [canCheckOut, setCanCheckOut] = useState(false)
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)
  const [isFetchingLogbook, setIsFetchingLogbook] = useState(true)

  // ⏰ Realtime clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 📍 Hitung jarak (Haversine)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(Δφ / 2) ** 2 +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // 🔍 Ambil lokasi pengguna
  const fetchLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation tidak didukung browser ini.')
      return
    }

    setIsFetchingLocation(true)
    setLocationStatus('Mengambil lokasi...')

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        setLocation({ lat, lon })

        const dist = calculateDistance(lat, lon, OFFICE_LOCATION.latitude, OFFICE_LOCATION.longitude)
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

        setLocationStatus(
          dist <= OFFICE_LOCATION.RADIUS_M
            ? '✅ Lokasi valid (dalam radius kantor)'
            : '⚠️ Di luar radius kantor'
        )
        setIsFetchingLocation(false)
      },
      (error) => {
        console.error(error)
        setLocationStatus(
          error.code === error.PERMISSION_DENIED
            ? 'Akses lokasi ditolak.'
            : 'Gagal mendapatkan lokasi.'
        )
        setIsFetchingLocation(false)
      }
    )
  }

  useEffect(() => {
    fetchLocation()
  }, [])

  // 🗓️ Cek status logbook untuk mengaktifkan tombol checkout
  const fetchLogbookStatus = async () => {
    setIsFetchingLogbook(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const today = new Date().toISOString().split('T')[0]
      const { data: logbook, error } = await supabase
        .from('logbooks')
        .select('start_time, end_time, status')
        .eq('user_id', user.id)
        .eq('log_date', today)
        .maybeSingle()

      if (error) throw error

      // ✅ Tombol aktif jika status logbook hari ini sudah COMPLETED dan belum absen pulang
      setCanCheckOut(!!logbook && logbook.status === 'COMPLETED')
    } catch (err) {
      console.error(err)
      setCanCheckOut(false)
    } finally {
      setIsFetchingLogbook(false)
    }
  }

  useEffect(() => {
    fetchLogbookStatus()
  }, [])

  const formattedTime = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const formattedDate = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // 🚪 Handle Absen Pulang
  const handleCheckOut = async () => {
    if (!location) return toast.error('Lokasi belum terdeteksi.')

    const isValidLocation =
      (distance && distance <= OFFICE_LOCATION.RADIUS_M) ||
      (address && address.toLowerCase().includes('lhokseumawe'))

    if (!isValidLocation) return toast.error('Lokasi di luar area kantor.')

    setIsSubmitting(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        toast.error('Anda belum login.')
        setIsSubmitting(false)
        return
      }

      const now = new Date()
      const jamPulang = now.toLocaleTimeString('en-GB', { hour12: false })
      const tanggalHariIni = now.toISOString().split('T')[0]

      const { error } = await supabase
        .from('logbooks')
        .update({
          end_time: jamPulang,
          position_at_time: address,
          status: 'Pulang'
        })
        .eq('user_id', user.id)
        .eq('log_date', tanggalHariIni)

      if (error) throw error

      toast.success('✅ Absen Pulang Berhasil!')
      localStorage.setItem('hasCheckedOut', 'true')
      router.replace('/dashboard')
    } catch (err: any) {
      console.error(err)
      toast.error(`Gagal menyimpan absen: ${err.message}`)
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
        <h1 className="text-xl font-bold">Absen Pulang</h1>
      </header>

      <main className="p-6">
        {/* 🕒 Waktu Saat Ini */}
        <div className="bg-white p-8 rounded-xl shadow-lg mb-8 text-center">
          <Clock size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Waktu Saat Ini</p>
          <h2 className="text-5xl font-extrabold text-gray-900 mb-1">{formattedTime}</h2>
          <p className="text-md text-gray-500">{formattedDate}</p>
        </div>

        {/* 📍 Lokasi */}
        <div className="bg-white p-4 rounded-xl shadow-md border mb-5">
          <p className="font-semibold text-gray-700 mb-1">Status Lokasi:</p>
          <p className={`text-sm ${distance && distance <= OFFICE_LOCATION.RADIUS_M ? 'text-green-600' : 'text-red-600'}`}>
            {locationStatus} {isFetchingLocation && '(Memuat...)'}
          </p>

          {distance !== null && <p className="mt-1 text-sm text-gray-600">Jarak dari kantor: <b>{distance.toFixed(1)} meter</b></p>}
          <p className="mt-2 text-sm text-gray-600"><b>Alamat Saat Ini:</b><br />{address}</p>
          <p className="mt-2 text-xs text-gray-400">
            Koordinat: {location ? `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}` : '...'}
          </p>

          <button
            onClick={fetchLocation}
            disabled={isFetchingLocation}
            className="mt-3 bg-blue-900 hover:bg-blue-800 text-white text-sm font-semibold py-2 px-3 rounded-lg"
          >
            Ambil Ulang Lokasi
          </button>
        </div>

        {/* 🚪 Tombol Absen Pulang */}
        <button
          onClick={handleCheckOut}
          disabled={!canCheckOut || isSubmitting || !location || isFetchingLogbook}
          className={`w-full py-4 text-white font-extrabold rounded-xl transition duration-300 shadow-xl ${
            isSubmitting
              ? 'bg-gray-400 cursor-not-allowed'
              : canCheckOut
              ? 'bg-blue-900 hover:bg-blue-800 shadow-blue-500/50'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? 'Memproses...' : 'SUBMIT ABSEN PULANG'}
        </button>

        {/* ℹ️ Catatan */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 text-center">
          <p className="font-semibold text-blue-900 mb-1">Catatan:</p>
          <p>Absen Pulang hanya bisa dilakukan setelah logbook hari ini berstatus <b>COMPLETED</b> dan lokasi Anda berada dalam radius 500 meter dari kantor.</p>
        </div>
      </main>
    </div>
  )
}
