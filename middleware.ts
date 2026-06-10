import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const ROLE_PAGES: Record<string, string[]> = {
  admin:  ['/dossiers', '/saisie', '/audit', '/admin', '/settings', '/pending'],
  cgp:    ['/dossiers', '/saisie', '/audit', '/settings', '/pending'],
  client: ['/client'],
}

const PROTECTED_PREFIXES = ['/dossiers', '/saisie', '/audit', '/admin', '/settings', '/pending', '/client']

const HOME_BY_ROLE: Record<string, string> = {
  admin:  '/dossiers',
  cgp:    '/dossiers',
  client: '/client',
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  const isProtected = PROTECTED_PREFIXES.some(p => path.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('status, role')
    .eq('id', user.id)
    .single()

  const status = profile?.status
  const role = profile?.role ?? 'cgp'

  if (status === 'pending' && !path.startsWith('/pending')) {
    return NextResponse.redirect(new URL('/pending', req.url))
  }
  if (status === 'blocked') {
    return NextResponse.redirect(new URL(
      '/login?message=Votre+acc%C3%A8s+a+%C3%A9t%C3%A9+bloqu%C3%A9.+Contactez+l%27administrateur.',
      req.url
    ))
  }

  const allowedPages = ROLE_PAGES[role] ?? []
  const hasAccess = allowedPages.some(p => path.startsWith(p))

  if (!hasAccess) {
    const home = HOME_BY_ROLE[role] ?? '/login'
    return NextResponse.redirect(new URL(home, req.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
