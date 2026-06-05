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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? '' })
        const p = await getProfil()
        setProfil(p)
      } else if (requireAuth) {
        router.push('/login')
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email ?? '' })
          const p = await getProfil()
          setProfil(p)
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
