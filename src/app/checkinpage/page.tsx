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

  // Waktu realtime
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Ambil lokasi
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

        // hitung jarak
        const R = 6371e3
        const φ1 = (OFFICE_LOCATION.latitude * Math.PI) / 180
        const φ2 = (lat * Math.PI) / 180
        const Δφ = ((lat - OFFICE_LOCATION.latitude) * Math.PI) / 180
        const Δλ = ((lon - OFFICE_LOCATION.longitude) * Math.PI) / 180
        const a =
          Math.sin(Δφ / 2) ** 2 +
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

        // status lokasi
        if (dist <= OFFICE_LOCATION.RADIUS_M) {
          setLocationStatus('✅ Lokasi valid (dalam radius kantor)')
        } else {
          setLocationStatus('🚫 Di luar radius kantor')
        }
      },
      (error) => {
        console.error(error)
        if (error.code === error.PERMISSION_DENIED) setLocationStatus('Akses lokasi ditolak.')
        else setLocationStatus('Gagal mendapatkan lokasi.')
      }
    )
  }

  useEffect(() => {
    fetchLocation()
  }, [])

  const formattedTime = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const formattedDate = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const isOutOfRadius = distance !== null && distance > OFFICE_LOCATION.RADIUS_M

  const handleCheckIn = async () => {
    if (!location) {
      toast.error('Lokasi belum terdeteksi.')
      return
    }

    const isValidLocation =
      (distance !== null && distance <= OFFICE_LOCATION.RADIUS_M) ||
      (address && address.toLowerCase().includes('lhokseumawe'))

    if (!isValidLocation) {
      toast.error('❌ Radius Anda di luar area kantor.')
      return
    }

    setIsSubmitting(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        toast.error('Anda belum login.')
        setIsSubmitting(false)
        return
      }

      const now = new Date()
      const jamMasuk = now.toLocaleTimeString('en-US', { hour12: false })
      const batasJamMasuk = '08:00:00'
      const status = jamMasuk > batasJamMasuk ? 'Terlambat' : 'Hadir'

      const { error } = await supabase.from('logbooks').insert({
        user_id: user.id,
        log_date: now.toISOString().split('T')[0],
        start_time: jamMasuk,
        position_at_time: address,
        description: '',
        status,
      })

      if (error) throw error
      toast.success(`✅ Absen berhasil (${status})`)
      router.replace('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error('Gagal menyimpan absen.')
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
        {/* Jam */}
        <div className="bg-white p-8 rounded-xl shadow-lg mb-8 text-center">
          <Clock size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Waktu Saat Ini</p>
          <h2 className="text-5xl font-extrabold text-gray-900 mb-1">{formattedTime}</h2>
          <p className="text-md text-gray-500">{formattedDate}</p>
        </div>

        {/* Lokasi */}
        <div className="bg-white p-4 rounded-xl shadow-md border mb-5">
          <p className="font-semibold text-gray-700 mb-1">Status Lokasi:</p>
          <p className={`text-sm ${isOutOfRadius ? 'text-red-600' : 'text-green-600'}`}>
            {locationStatus}
          </p>
          {distance !== null && (
            <p className="mt-1 text-sm text-gray-600">
              Jarak dari kantor: <b>{distance.toFixed(1)} meter</b>
            </p>
          )}
          <p className="mt-2 text-sm text-gray-600">
            <b>Alamat Saat Ini:</b>
            <br />
            {address}
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

        {/* Tombol Submit */}
        <button
          onClick={handleCheckIn}
          disabled={isSubmitting || isOutOfRadius}
          className={`w-full py-4 text-white font-extrabold rounded-xl transition duration-300 shadow-xl ${
            isOutOfRadius
              ? 'bg-gray-400 cursor-not-allowed'
              : isSubmitting
              ? 'bg-gray-400 cursor-wait'
              : 'bg-blue-900 hover:bg-blue-800 shadow-blue-500/50'
          }`}
        >
          {isSubmitting
            ? 'Memproses...'
            : isOutOfRadius
            ? 'Anda di luar radius kantor'
            : 'SUBMIT ABSEN MASUK'}
        </button>

        {/* Peringatan tampil hanya di bawah tombol */}
        {isOutOfRadius && (
          <p className="mt-3 text-sm text-red-600 font-semibold text-center">
            🚫 Anda berada di luar radius kantor (lebih dari {OFFICE_LOCATION.RADIUS_M} meter).
          </p>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 text-center">
          <p className="font-semibold text-blue-900 mb-1">Catatan:</p>
          <p>
            Absen akan dianggap valid jika dalam radius{' '}
            {OFFICE_LOCATION.RADIUS_M} meter dari kantor.
          </p>
        </div>
      </main>
    </div>
  )
}
