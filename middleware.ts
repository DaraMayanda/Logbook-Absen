import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Siapkan response awal
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Buat client Supabase dengan Cookie Handler yang benar
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // FIX: Tambahkan tipe eksplisit { name, value, options } untuk mengatasi error TypeScript
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          // Loop cookie satu per satu agar Next.js 16 senang
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({
              name,
              value,
              ...options,
            })
          })
          
          // Update response agar cookie ikut terkirim balik ke browser
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          })
        },
      },
    }
  )

  // 3. Cek User (Bukan cuma getSession, tapi getUser lebih aman)
  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  
  // 4. DAFTAR HALAMAN YANG DILINDUNGI
  // Masukkan semua halaman yang HARUS login dulu baru bisa buka
  const protectedPaths = [
    '/dashboard', 
    '/dashboardadmin', 
    '/logbook', 
    '/rekapabsensi',
    '/pengajuancuti'
  ]

  // Cek apakah user sedang membuka halaman dilindungi?
  const isProtected = protectedPaths.some((path) => url.pathname.startsWith(path))

  // LOGIKA PENTING:
  // Jika masuk halaman rahasia TAPI user kosong -> TENDANG KE LOGIN
  if (isProtected && !user) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Jika user SUDAH login TAPI buka halaman login lagi -> LEMPAR KE DASHBOARD
  if (url.pathname === '/login' && user) {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Middleware jalan di semua route KECUALI file statis (gambar, css, dll)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}