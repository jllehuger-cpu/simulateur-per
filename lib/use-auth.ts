'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from './supabase'

const supabase = getSupabase()
import { getProfil, UserProfile } from './auth-supabase'

export function useAuth(requireAuth = true) {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [profil, setProfil] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUser({ id: user.id, email: user.email ?? '' })
        try {
          const p = await getProfil()
          setProfil(p)
        } catch (err) {
          console.error('[AUTH] Erreur getProfil:', err)
        }
      } else if (requireAuth) {
        router.push('/login')
      }
      setLoading(false)
    }).catch((err) => {
      console.error('[AUTH] Erreur getUser:', err)
      setLoading(false)
      if (requireAuth) router.push('/login')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email ?? '' })
          try {
            const p = await getProfil()
            setProfil(p)
          } catch (err) {
            console.error('[AUTH] Erreur getProfil dans onAuthStateChange:', err)
          }
        } else {
          setUser(null)
          setProfil(null)
          if (requireAuth) router.push('/login')
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [requireAuth, router])

  return { user, profil, loading }
}
