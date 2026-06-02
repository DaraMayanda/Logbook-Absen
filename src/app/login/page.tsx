// import { Suspense } from 'react'
// import LoginClient from './loginclient' // Kita akan buat file ini

// // Ini adalah komponen fallback sederhana selagi LoginClient dimuat
// function Loading() {
//   return (
//     <div className="flex min-h-screen flex-col bg-gray-100">
//       <div className="w-full bg-[#003366] px-8 pt-12 pb-24 text-white">
//         <h1 className="text-center text-3xl font-bold">Loading...</h1>
//       </div>
//     </div>
//   )
// }

// // Ini sekarang adalah Server Component
// export default function LoginPage() {
//   return (
//     <Suspense fallback={<Loading />}>
//       <LoginClient />
//     </Suspense>
//   )
// }
'use client'

import { useEffect } from 'react'

export default function LoginPage() {
    useEffect(() => {
        // Melakukan redirect ke situs baru
        window.location.replace('https://smartppnpn.vercel.app/')
    }, [])

    // Halaman tidak perlu menampilkan apa-apa lagi karena akan segera berpindah
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#003366] text-white">
            <h1 className="text-2xl font-bold">Mengalihkan ke aplikasi versi baru...</h1>
        </div>
    )
}