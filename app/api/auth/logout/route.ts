import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const response = NextResponse.redirect(new URL('/login', requestUrl.origin))

  // 1. Tenter le signOut Supabase côté serveur
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )
    await supabase.auth.signOut()
  } catch (err) {
    console.error('[LOGOUT] Erreur signOut serveur:', err)
  }

  // 2. Supprimer manuellement tous les cookies Supabase
  const cookieStore = await cookies()
  cookieStore.getAll().forEach(cookie => {
    if (cookie.name.startsWith('sb-') || cookie.name.includes('supabase')) {
      response.cookies.set(cookie.name, '', {
        expires: new Date(0),
        path: '/',
      })
    }
  })

  return response
}
