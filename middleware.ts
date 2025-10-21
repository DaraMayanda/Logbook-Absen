import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  // Supabase client (server-side)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    }
  )

  // Ambil session user
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Halaman yang butuh login
  const protectedRoutes = ['/dashboard', '/profile', '/admin']

  // Halaman publik yang gak perlu dikunjungi kalau sudah login
  const publicRoutes = ['/login', '/register']

  // 🔒 Kalau user belum login tapi mau buka halaman dilindungi
  if (protectedRoutes.some((path) => pathname.startsWith(path)) && !session) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // 🚫 Kalau user sudah login tapi mau buka halaman login/register
  if (publicRoutes.includes(pathname) && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Default: lanjutkan request
  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/login',
    '/register',
  ],
}
