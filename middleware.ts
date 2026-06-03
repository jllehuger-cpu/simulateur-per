import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth/callback', '/api']

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  if (PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return NextResponse.next()
  }

  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL
    ?.split('//')[1]?.split('.')[0]

  const token = req.cookies.get('sb-access-token')?.value
    ?? req.cookies.get(`sb-${projectRef}-auth-token`)?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
