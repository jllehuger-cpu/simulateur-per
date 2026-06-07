'use client'
import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { updatePassword } from '@/lib/auth-supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = getSupabase()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setReady(true)
      } else {
        window.location.href = '/login?message=Session+expir%C3%A9e.+Redemandez+un+lien+de+r%C3%A9initialisation.'
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handle = async () => {
    setError('')
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    const timeout = setTimeout(() => {
      setLoading(false)
      setError('La requête a expiré. Veuillez réessayer.')
    }, 10000)

    try {
      await updatePassword(password)
      clearTimeout(timeout)
      setSuccess(true)
      setTimeout(() => {
        window.location.href = '/dossiers'
      }, 2000)
    } catch (err: unknown) {
      clearTimeout(timeout)
      console.error('[RESET] Erreur updatePassword:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour du mot de passe.')
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Vérification en cours…
        </p>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '2.5rem 2rem',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔐</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.4rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>
            Nouveau mot de passe
          </h1>
          <p style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginTop: '0.25rem',
          }}>
            Choisissez un mot de passe sécurisé
          </p>
        </div>

        {success ? (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: 8,
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            color: '#6EE7B7',
            fontSize: '0.875rem',
            textAlign: 'center',
          }}>
            ✅ Mot de passe mis à jour. Redirection…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {error && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#FCA5A5',
                fontSize: '0.8rem',
              }}>
                {error}
              </div>
            )}
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Nouveau mot de passe (min 8 caractères)"
              autoFocus
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: 8,
                border: '1px solid var(--border-glass)',
                background: 'var(--bg-surface-md)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handle()}
              placeholder="Confirmer le mot de passe"
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: 8,
                border: '1px solid var(--border-glass)',
                background: 'var(--bg-surface-md)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
            <button
              onClick={() => void handle()}
              disabled={loading || !password || !confirm}
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: 8,
                background: loading ? '#2563EB' : '#3B82F6',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading || !password || !confirm ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              {loading ? '⏳ Mise à jour...' : '🔐 Enregistrer le mot de passe'}
            </button>
          </div>
        )}
      </div>

      <p style={{
        marginTop: '1.5rem',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
      }}>
        © 2026 Mon Audit Patrimoine — Données chiffrées AES-256
      </p>
    </div>
  )
}
