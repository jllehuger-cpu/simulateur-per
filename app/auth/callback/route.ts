import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')

  console.log('[CALLBACK] code reçu:', code?.slice(0, 20))

  if (!code) {
    return NextResponse.redirect(new URL('/login?message=Lien+invalide', requestUrl.origin))
  }

  // Recovery → toujours reset-password
  if (type === 'recovery') {
    const response = NextResponse.redirect(new URL('/reset-password', requestUrl.origin))
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
    await supabase.auth.exchangeCodeForSession(code)
    return response
  }

  // Login normal — déterminer la page d'accueil selon le rôle
  const cookieStore = await cookies()
  const cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cs) { cookiesToSet.push(...cs as typeof cookiesToSet) },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  console.log('[CALLBACK] Exchange error:', error)

  if (error) {
    // Vérifier si la session existe quand même (double-clic sur magic link)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.redirect(new URL('/login?message=Retournez+dans+votre+onglet+initial', requestUrl.origin))
    }
  }

  const { data: { user } } = await supabase.auth.getUser()
  let redirectPath = '/dossiers'

  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    redirectPath = profile?.role === 'client' ? '/client' : '/dossiers'
  }

  const response = NextResponse.redirect(new URL(redirectPath, requestUrl.origin))
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]))
  return response
}
