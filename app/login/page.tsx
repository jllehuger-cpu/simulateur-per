'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import {
  envoyerMagicLink,
  signInWithPassword,
  signUpWithPassword,
  resetPassword,
} from '@/lib/auth-supabase'

type Tab = 'magic' | 'password' | 'signup'

function translateError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (message.includes('Email not confirmed')) return 'Veuillez confirmer votre email avant de vous connecter.'
  if (message.includes('User already registered')) return 'Un compte existe déjà avec cet email.'
  if (message.includes('Password should be at least')) return 'Le mot de passe doit contenir au moins 8 caractères.'
  return message
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 1rem',
  borderRadius: 8,
  border: '1px solid var(--border-glass)',
  background: 'var(--bg-surface-md)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  outline: 'none',
}

const btnPrimaryStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem',
  borderRadius: 8,
  background: '#3B82F6',
  color: '#fff',
  fontSize: '0.875rem',
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s',
}

function Alert({ type, message }: { type: 'error' | 'success'; message: string }) {
  const isError = type === 'error'
  return (
    <div style={{
      padding: '0.75rem 1rem',
      borderRadius: 8,
      background: isError ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
      border: `1px solid ${isError ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
      color: isError ? '#FCA5A5' : '#6EE7B7',
      fontSize: '0.8rem',
    }}>
      {message}
    </div>
  )
}

function MagicLinkTab({ infoMessage }: { infoMessage: string | null }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = async () => {
    if (!email.trim()) return
    setLoading(true); setError('')
    try {
      await envoyerMagicLink(email.trim())
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📬</div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Vérifiez vos emails
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Un lien de connexion a été envoyé à<br />
          <strong style={{ color: 'var(--accent-gold)' }}>{email}</strong>
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          Le lien expire dans 1 heure. Vérifiez vos spams si nécessaire.
        </p>
        <button
          onClick={() => setSent(false)}
          style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ← Utiliser une autre adresse
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {infoMessage && <Alert type="error" message={infoMessage} />}
      {error && <Alert type="error" message={error} />}
      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Adresse email professionnelle
      </label>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && void handle()}
        placeholder="vous@cabinet.fr"
        autoFocus
        style={inputStyle}
      />
      <button
        onClick={() => void handle()}
        disabled={loading || !email.trim()}
        style={{ ...btnPrimaryStyle, opacity: loading || !email.trim() ? 0.5 : 1 }}
      >
        {loading ? '⏳ Envoi...' : '✉️ Recevoir un lien de connexion'}
      </button>
      <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
        Pas de mot de passe — un lien sécurisé vous est envoyé à chaque connexion.
      </p>
    </div>
  )
}

function PasswordTab() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleLogin = async () => {
    if (!email.trim() || !password) return
    setLoading(true); setError('')

    // Filet de sécurité : la redirection est normalement déclenchée par l'événement
    // SIGNED_IN (géré au niveau de LoginForm). Si rien ne se passe après 15s
    // (session non établie, requête réseau perdue, etc.), on débloque le bouton.
    const timeout = setTimeout(() => {
      setLoading(false)
      setError('La connexion prend plus de temps que prévu. Réessayez.')
    }, 15000)

    try {
      await signInWithPassword(email.trim(), password)
      clearTimeout(timeout)
      // Pas de redirection ici : elle est gérée par onAuthStateChange (SIGNED_IN)
      // dans LoginForm, une fois la session réellement établie côté client.
    } catch (err: unknown) {
      clearTimeout(timeout)
      setError(translateError(err instanceof Error ? err.message : String(err)))
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!email.trim()) return
    setLoading(true); setError('')
    try {
      await resetPassword(email.trim())
      setResetSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (resetMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Réinitialiser le mot de passe
        </h3>
        {error && <Alert type="error" message={error} />}
        {resetSent && <Alert type="success" message="Un email de réinitialisation a été envoyé. Vérifiez vos spams." />}
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="vous@cabinet.fr"
          style={inputStyle}
        />
        <button
          onClick={() => void handleReset()}
          disabled={loading || !email.trim() || resetSent}
          style={{ ...btnPrimaryStyle, opacity: loading || !email.trim() || resetSent ? 0.5 : 1 }}
        >
          {loading ? '⏳ Envoi...' : 'Envoyer le lien de réinitialisation'}
        </button>
        <button
          onClick={() => { setResetMode(false); setResetSent(false); setError('') }}
          style={{ fontSize: '0.8rem', color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}
        >
          ← Retour à la connexion
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {error && <Alert type="error" message={error} />}
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
        autoFocus
        style={inputStyle}
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && void handleLogin()}
        placeholder="Mot de passe"
        style={inputStyle}
      />
      <button
        onClick={() => void handleLogin()}
        disabled={loading || !email.trim() || !password}
        style={{ ...btnPrimaryStyle, opacity: loading || !email.trim() || !password ? 0.5 : 1 }}
      >
        {loading ? '⏳ Connexion...' : 'Se connecter'}
      </button>
      <button
        onClick={() => { setResetMode(true); setError('') }}
        style={{ fontSize: '0.75rem', color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}
      >
        Mot de passe oublié ?
      </button>
    </div>
  )
}

function SignupTab() {
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const validate = (): string | null => {
    if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.'
    if (password !== confirm) return 'Les mots de passe ne correspondent pas.'
    return null
  }

  const handle = async () => {
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setLoading(true); setError('')
    try {
      await signUpWithPassword(email.trim(), password, nom.trim() || undefined)
      setSuccess(true)
    } catch (err: unknown) {
      setError(translateError(err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Un email de confirmation vous a été envoyé.<br />
          Votre accès sera validé par un administrateur.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {error && <Alert type="error" message={error} />}
      <input
        type="text"
        value={nom}
        onChange={e => setNom(e.target.value)}
        placeholder="Nom (optionnel)"
        style={inputStyle}
      />
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
        autoFocus
        style={inputStyle}
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Mot de passe (min 8 caractères)"
        style={inputStyle}
      />
      <input
        type="password"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && void handle()}
        placeholder="Confirmer le mot de passe"
        style={inputStyle}
      />
      <button
        onClick={() => void handle()}
        disabled={loading || !email.trim() || !password || !confirm}
        style={{
          ...btnPrimaryStyle,
          background: '#059669',
          opacity: loading || !email.trim() || !password || !confirm ? 0.5 : 1,
        }}
      >
        {loading ? '⏳ Création...' : '✨ Créer mon compte'}
      </button>
    </div>
  )
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'magic', label: 'Magic Link', icon: '🔗' },
  { id: 'password', label: 'Mot de passe', icon: '🔑' },
  { id: 'signup', label: 'Inscription', icon: '✨' },
]

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const infoMessage = searchParams.get('message')
  const [tab, setTab] = useState<Tab>('magic')

  useEffect(() => {
    const supabase = getSupabase()
    let cancelled = false

    const redirectForUser = (userId: string) => {
      supabase
        .from('user_profiles').select('role').eq('id', userId).single()
        .then(({ data: profile }) => {
          if (!cancelled) router.push(profile?.role === 'client' ? '/client' : '/dossiers')
        })
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectForUser(session.user.id)
    })

    // Le callback onAuthStateChange doit rester SYNCHRONE : GoTrueClient attend sa
    // résolution (verrou interne) avant de résoudre signInWithPassword() lui-même.
    // Un callback async ici bloquait indéfiniment le flow "mot de passe" (le fetch
    // /token renvoyait bien 200, mais la Promise ne se résolvait jamais côté client) —
    // même famille de bug que celui déjà rencontré sur reset-password.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setTimeout(() => redirectForUser(session.user.id), 0)
      }
    })
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [router])

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
        style={{ width: '100%', maxWidth: 440, padding: '2.5rem 2rem' }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.4rem' }}>🏛️</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.4rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>
            Audit Patrimoine
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Espace CGP sécurisé
          </p>
        </div>

        {/* Onglets pill */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 999,
          padding: '0.2rem',
          gap: '0.2rem',
          marginBottom: '1.5rem',
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: '0.5rem 0',
                borderRadius: 999,
                fontSize: '0.7rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: tab === t.id ? '#3B82F6' : 'transparent',
                color: tab === t.id ? '#fff' : 'var(--text-muted)',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'magic' && <MagicLinkTab infoMessage={infoMessage} />}
        {tab === 'password' && <PasswordTab />}
        {tab === 'signup' && <SignupTab />}
      </div>

      <p style={{ marginTop: '1.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        © 2026 Mon Audit Patrimoine — Données chiffrées AES-256
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
