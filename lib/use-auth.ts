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
    let cancelled = false

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUser({ id: user.id, email: user.email ?? '' })
        try {
          const p = await getProfil()
          if (!cancelled) setProfil(p)
        } catch (err) {
          console.error('[AUTH] Erreur getProfil:', err)
        }
      } else if (requireAuth) {
        router.push('/login')
      }
      if (!cancelled) setLoading(false)
    }).catch((err) => {
      console.error('[AUTH] Erreur getUser:', err)
      if (!cancelled) setLoading(false)
      if (requireAuth) router.push('/login')
    })

    // Le callback onAuthStateChange doit rester SYNCHRONE : GoTrueClient attend sa
    // résolution avant de relâcher son verrou interne (_acquireLock). Appeler
    // getProfil() ici (→ getUser() → nouvelle tentative d'acquisition du MÊME
    // verrou, non réentrant) provoquait un interblocage permanent dès qu'un
    // TOKEN_REFRESHED (ou autre event auth) survenait en arrière-plan — bloquant
    // ensuite TOUS les appels Supabase suivants (y compris de simples requêtes
    // PostgREST, qui passent aussi par ce verrou pour récupérer le token).
    // Même famille de bug que celui déjà rencontré sur le login par mot de passe.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email ?? '' })
          setTimeout(() => {
            if (cancelled) return
            getProfil()
              .then(p => { if (!cancelled) setProfil(p) })
              .catch(err => console.error('[AUTH] Erreur getProfil dans onAuthStateChange:', err))
          }, 0)
        } else {
          setUser(null)
          setProfil(null)
          if (requireAuth) router.push('/login')
        }
      }
    )
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [requireAuth, router])

  return { user, profil, loading }
}
