import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')

  console.log('[CALLBACK] code reçu:', code?.slice(0, 20))

  const redirectTarget = type === 'recovery' ? '/reset-password' : '/dossiers'
  const response = NextResponse.redirect(new URL(redirectTarget, requestUrl.origin))

  if (code) {
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
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[CALLBACK] Exchange error:', error)

    if (error) {
      console.log('[CALLBACK] Exchange failed:', error.message)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) return response
      return NextResponse.redirect(new URL('/login?message=Retournez+dans+votre+onglet+initial', requestUrl.origin))
    }
  }

  return response
}
