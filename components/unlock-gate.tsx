'use client'

import { useState, useEffect } from 'react'
import { deriverCle, setCleSession, getCleSession, setCleIdentiteSession } from '@/lib/crypto'
import { getSupabase } from '@/lib/supabase'

type Step = 'init' | 'onboarding' | 'unlock'

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 20,
  padding: '2.5rem',
  maxWidth: 460,
  width: '100%',
  boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
}

const WRAP_STYLE: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center',
  justifyContent: 'center', padding: '1rem', position: 'relative', zIndex: 1,
}

export function UnlockGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => getCleSession() !== null)
  const [step, setStep] = useState<Step>('init')
  const [isFirstVisit, setIsFirstVisit] = useState(false)
  const [confirmedBackup, setConfirmedBackup] = useState(false)
  const [mdpPatrimoine, setMdpPatrimoine] = useState('')
  const [mdpIdentite, setMdpIdentite] = useState('')
  const [showIdentite, setShowIdentite] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (unlocked) return
    const supabase = getSupabase()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setStep('unlock'); return }
      const { count } = await supabase
        .from('dossiers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      const first = (count ?? 0) === 0
      setIsFirstVisit(first)
      setStep(first ? 'onboarding' : 'unlock')
    })
  }, [unlocked])

  const handleUnlock = async () => {
    if (!mdpPatrimoine.trim()) return
    if (isFirstVisit && !confirmedBackup) return
    setLoading(true)
    setError('')
    try {
      const clePatrimoine = await deriverCle(mdpPatrimoine)
      setCleSession(clePatrimoine)
      if (mdpIdentite.trim()) {
        const cleIdentite = await deriverCle(mdpIdentite + '_identite')
        setCleIdentiteSession(cleIdentite)
      }
      setUnlocked(true)
    } catch {
      setError('Erreur de déverrouillage')
    } finally {
      setLoading(false)
    }
  }

  if (unlocked) return <>{children}</>

  // ── Chargement ───────────────────────────────────────────────────────────────
  if (step === 'init') {
    return (
      <div style={WRAP_STYLE}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Chargement...</div>
      </div>
    )
  }

  // ── Onboarding première visite ────────────────────────────────────────────────
  if (step === 'onboarding') {
    return (
      <div style={WRAP_STYLE}>
        <div style={CARD_STYLE}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', textAlign: 'center' }}>🔐</div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700,
            color: 'var(--text-primary)', marginBottom: '0.75rem', textAlign: 'center',
          }}>
            Bienvenue sur votre espace sécurisé
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.65 }}>
            Avant de commencer, vous allez choisir un{' '}
            <strong style={{ color: 'var(--text-primary)' }}>mot de passe de chiffrement</strong>.
          </p>

          {/* Avertissement */}
          <div style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '1.25rem',
          }}>
            <div style={{ fontSize: '0.85rem', color: '#F59E0B', fontWeight: 600, marginBottom: '0.3rem' }}>
              ⚠️ Ce mot de passe est DIFFÉRENT de votre email de connexion.
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Il sert à chiffrer tous les dossiers de vos clients.
            </div>
          </div>

          {/* Points clés */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '1.25rem',
          }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
              Ce que vous devez savoir
            </div>
            {[
              'Ce mot de passe ne sera JAMAIS stocké — ni par nous, ni par personne',
              'Il est IMPOSSIBLE de le récupérer en cas d\'oubli',
              'Sans ce mot de passe, vos dossiers sont définitivement inaccessibles',
              'Vous le saisirez à chaque connexion pour déverrouiller vos dossiers',
            ].map((point, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem', alignItems: 'flex-start' }}>
                <span style={{ color: '#F59E0B', flexShrink: 0, marginTop: '0.05rem' }}>▸</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{point}</span>
              </div>
            ))}
          </div>

          {/* Rappel notation */}
          <div style={{
            background: 'rgba(99,102,241,0.07)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '1.75rem',
            fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.65,
          }}>
            <strong style={{ color: '#A78BFA' }}>👉 Notez-le immédiatement dans un endroit sûr :</strong>
            <br />gestionnaire de mots de passe, coffre-fort, carnet papier
          </div>

          <button
            onClick={() => setStep('unlock')}
            style={{
              width: '100%', padding: '0.75rem 1.5rem', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))',
              color: '#fff', fontFamily: 'var(--font-sans)', fontSize: '0.95rem',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            J&apos;ai compris, choisir mon mot de passe →
          </button>
        </div>
      </div>
    )
  }

  // ── Formulaire de déverrouillage ──────────────────────────────────────────────
  return (
    <div style={WRAP_STYLE}>
      <div style={{ ...CARD_STYLE, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600,
          color: 'var(--text-primary)', marginBottom: '0.5rem',
        }}>
          {isFirstVisit ? 'Choisissez votre mot de passe' : 'Espace CGP sécurisé'}
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.75rem', lineHeight: 1.6 }}>
          {isFirstVisit
            ? 'Ce mot de passe chiffre vos dossiers. Choisissez-le fort et notez-le.'
            : 'Saisissez votre mot de passe pour déverrouiller et déchiffrer vos dossiers.\nLa clé ne quitte jamais votre navigateur.'}
        </p>

        <input
          className="glass-input"
          type="password"
          value={mdpPatrimoine}
          onChange={e => setMdpPatrimoine(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleUnlock() }}
          placeholder={isFirstVisit ? 'Nouveau mot de passe de chiffrement' : 'Clé patrimoine'}
          style={{ marginBottom: '0.75rem', textAlign: 'center', letterSpacing: '0.05em' }}
          autoFocus
        />

        <button
          type="button"
          onClick={() => setShowIdentite(v => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--accent-blue)', fontSize: '0.82rem', marginBottom: '0.75rem',
            textDecoration: 'underline', padding: 0,
          }}
        >
          {showIdentite ? '− Masquer' : '+ Accès avec noms prospects (optionnel)'}
        </button>

        {showIdentite && (
          <input
            className="glass-input"
            type="password"
            value={mdpIdentite}
            onChange={e => setMdpIdentite(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleUnlock() }}
            placeholder="Clé identité"
            style={{ marginBottom: '0.75rem', textAlign: 'center', letterSpacing: '0.05em' }}
          />
        )}

        {/* Checkbox première visite uniquement */}
        {isFirstVisit && (
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
            marginBottom: '1rem', cursor: 'pointer', textAlign: 'left',
            padding: '0.75rem', borderRadius: 10,
            background: confirmedBackup ? 'rgba(52,211,153,0.06)' : 'rgba(245,158,11,0.06)',
            border: `1px solid ${confirmedBackup ? 'rgba(52,211,153,0.2)' : 'rgba(245,158,11,0.2)'}`,
            transition: 'all 0.2s',
          }}>
            <input
              type="checkbox"
              checked={confirmedBackup}
              onChange={e => setConfirmedBackup(e.target.checked)}
              style={{ marginTop: '0.15rem', accentColor: '#34D399', flexShrink: 0, width: 15, height: 15 }}
            />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Je confirme avoir noté mon mot de passe dans un endroit sûr
            </span>
          </label>
        )}

        {error && (
          <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem', color: '#F87171' }}>
            {error}
          </div>
        )}

        <button
          onClick={() => void handleUnlock()}
          disabled={loading || !mdpPatrimoine.trim() || (isFirstVisit && !confirmedBackup)}
          style={{
            width: '100%', padding: '0.7rem 1.5rem', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))',
            color: '#fff', fontFamily: 'var(--font-sans)', fontSize: '0.95rem', fontWeight: 600,
            cursor: loading || !mdpPatrimoine.trim() || (isFirstVisit && !confirmedBackup) ? 'not-allowed' : 'pointer',
            opacity: loading || !mdpPatrimoine.trim() || (isFirstVisit && !confirmedBackup) ? 0.6 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {loading ? '⏳ Dérivation de la clé...' : isFirstVisit ? '🔐 Créer et déverrouiller' : '🔓 Déverrouiller'}
        </button>

        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1rem', lineHeight: 1.5 }}>
          Sans clé identité, les dossiers s&apos;affichent avec leurs alias uniquement.
        </p>
      </div>
    </div>
  )
}
