'use client'
import { useState } from 'react'
import { envoyerMagicLink } from '@/lib/auth-supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!email.trim()) return
    setLoading(true); setError('')
    try {
      await envoyerMagicLink(email.trim())
      setSent(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      console.error('Magic link error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: 24
    }}>
      <div className="glass-card" style={{
        padding: 40, maxWidth: 420, width: '100%',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🏛️</div>
        <h1 style={{
          fontSize: 22, fontWeight: 700, marginBottom: 8,
          letterSpacing: '-0.02em'
        }}>Audit Patrimoine</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
          Espace CGP sécurisé
        </p>

        {!sent ? (
          <>
            <div style={{ textAlign: 'left', marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Adresse email professionnelle
              </label>
            </div>
            <input
              className="glass-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleSubmit()}
              placeholder="vous@cabinet.fr"
              style={{ marginBottom: 16, textAlign: 'center' }}
              autoFocus
            />
            {error && (
              <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12 }}>
                {error}
              </p>
            )}
            <button
              onClick={() => void handleSubmit()}
              disabled={loading || !email.trim()}
              style={{
                width: '100%', padding: '12px',
                borderRadius: 10, border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))',
                color: '#fff', fontWeight: 600, fontSize: 14,
                opacity: loading || !email.trim() ? 0.6 : 1,
              }}
            >
              {loading ? '⏳ Envoi...' : '✉️ Recevoir mon lien de connexion'}
            </button>
            <p style={{
              fontSize: 11, color: 'var(--text-muted)',
              marginTop: 20, lineHeight: 1.5
            }}>
              Pas de mot de passe — un lien sécurisé vous est envoyé
              par email à chaque connexion.
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
              Vérifiez vos emails
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Un lien de connexion a été envoyé à<br/>
              <strong style={{ color: 'var(--accent-gold)' }}>{email}</strong>
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
              Le lien expire dans 1 heure.
              Vérifiez vos spams si nécessaire.
            </p>
            <button
              onClick={() => setSent(false)}
              className="btn-ghost"
              style={{ marginTop: 20, fontSize: 12 }}
            >
              ← Utiliser une autre adresse
            </button>
          </>
        )}
      </div>
    </div>
  )
}
