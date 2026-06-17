'use client'

import { useState, useEffect } from 'react'
import {
  deriverCle, deriverCleDossier, dechiffrer,
  setCleSession, getCleSession, setCleIdentiteSession,
  isCleSessionUnlocked,
} from '@/lib/crypto'
import { migrationNecessaire, migrerVersClesDerivees } from '@/lib/migration-cles'
import { STORAGE_KEY } from '@/lib/types'
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
  // Toujours false au premier rendu (SSR + hydration) — mis à jour après mount
  // pour éviter le mismatch serveur/client quand sessionStorage indique "déverrouillé".
  const [unlocked, setUnlocked] = useState(false)
  const [step, setStep] = useState<Step>('init')
  const [isFirstVisit, setIsFirstVisit] = useState(false)
  const [confirmedBackup, setConfirmedBackup] = useState(false)
  const [mdpPatrimoine, setMdpPatrimoine] = useState('')
  const [mdpIdentite, setMdpIdentite] = useState('')
  const [showIdentite, setShowIdentite] = useState(false)
  const [showMdpPatrimoine, setShowMdpPatrimoine] = useState(false)
  const [showMdpIdentite, setShowMdpIdentite] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [slowNetwork, setSlowNetwork] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Après hydration : restaurer l'état déverrouillé si la clé est en mémoire,
  // ou reverrouiller si le flag sessionStorage est là mais la clé a disparu (hard refresh).
  useEffect(() => {
    if (isCleSessionUnlocked() && getCleSession() !== null) {
      setUnlocked(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (unlocked) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let slowId:    ReturnType<typeof setTimeout> | null = null
    let isMounted = true

    const loadUser = async () => {
      setSlowNetwork(false)

      // Fallback visuel après 3 s
      slowId = setTimeout(() => {
        if (isMounted) setSlowNetwork(true)
      }, 3000)

      // Fallback fonctionnel après 5 s — on passe directement à 'unlock'
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('[UNLOCK] getUser timeout après 5s — fallback unlock')
          setStep('unlock')
        }
      }, 5000)

      try {
        const supabase = getSupabase()
        const { data: { user } } = await supabase.auth.getUser()

        if (!isMounted) return
        if (slowId)    clearTimeout(slowId)
        if (timeoutId) clearTimeout(timeoutId)

        if (!user) { setStep('unlock'); return }

        const { count, error } = await supabase
          .from('dossiers')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if (!isMounted) return

        if (error) {
          console.error('[UNLOCK] Erreur comptage dossiers:', error.message)
          setStep('unlock')
          return
        }

        const first = (count ?? 0) === 0
        setIsFirstVisit(first)
        setStep(first ? 'onboarding' : 'unlock')
      } catch (err) {
        if (isMounted) {
          console.error('[UNLOCK] Erreur:', err)
          setStep('unlock')
        }
      }
    }

    void loadUser()

    return () => {
      isMounted = false
      if (slowId)    clearTimeout(slowId)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [unlocked, retryCount])

  const handleUnlock = async () => {
    if (!mdpPatrimoine.trim()) return
    if (isFirstVisit && !confirmedBackup) return
    setLoading(true)
    setError('')
    try {
      const clePatrimoine = await deriverCle(mdpPatrimoine)

      // Vérifier la clé contre un dossier existant avant de l'accepter
      const rawEntries = localStorage.getItem(STORAGE_KEY)
      if (rawEntries) {
        const entries = JSON.parse(rawEntries) as { alias: string; chiffre: string; iv: string }[]
        if (entries.length > 0) {
          const { alias, chiffre, iv } = entries[0]
          try {
            const cleDossier = await deriverCleDossier(clePatrimoine, alias)
            await dechiffrer(chiffre, iv, cleDossier)
          } catch {
            setError('Clé A incorrecte ou dossiers corrompus. Réessayez.')
            return
          }
        }
      }

      setCleSession(clePatrimoine)
      if (mdpIdentite.trim()) {
        const cleIdentite = await deriverCle(mdpIdentite + '_identite')
        setCleIdentiteSession(cleIdentite)
      }
      if (migrationNecessaire()) {
        console.log('[UNLOCK] Migration vers clés dérivées...')
        try {
          const result = await migrerVersClesDerivees()
          console.log(`[UNLOCK] Migration : ${result.migres} migré(s), ${result.erreurs} erreur(s)`)
        } catch (err) {
          console.error('[UNLOCK] Erreur migration:', err)
        }
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
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: slowNetwork ? 12 : 0 }}>
            Chargement...
          </div>
          {slowNetwork && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                ⏳ Cela prend plus longtemps que prévu.<br />
                Vérifiez votre connexion internet.
              </div>
              <button
                onClick={() => { setStep('init'); setRetryCount(c => c + 1) }}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                🔄 Réessayer
              </button>
            </>
          )}
        </div>
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

        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <input
            className="glass-input"
            type={showMdpPatrimoine ? 'text' : 'password'}
            value={mdpPatrimoine}
            onChange={e => setMdpPatrimoine(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleUnlock() }}
            placeholder={isFirstVisit ? 'Nouveau mot de passe de chiffrement' : 'Clé patrimoine'}
            style={{ textAlign: 'center', letterSpacing: '0.05em', paddingRight: '2.5rem', width: '100%' }}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowMdpPatrimoine(v => !v)}
            aria-label={showMdpPatrimoine ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            title="Cliquer pour afficher/masquer"
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              color: showMdpPatrimoine ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '1rem', lineHeight: 1, userSelect: 'none',
              transition: 'color 0.15s',
            }}
          >
            {showMdpPatrimoine ? '👁' : '👁‍🗨'}
          </button>
        </div>

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
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <input
              className="glass-input"
              type={showMdpIdentite ? 'text' : 'password'}
              value={mdpIdentite}
              onChange={e => setMdpIdentite(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleUnlock() }}
              placeholder="Clé identité"
              style={{ textAlign: 'center', letterSpacing: '0.05em', paddingRight: '2.5rem', width: '100%' }}
            />
            <button
              type="button"
              onClick={() => setShowMdpIdentite(v => !v)}
              aria-label={showMdpIdentite ? 'Masquer la clé identité' : 'Afficher la clé identité'}
              title="Cliquer pour afficher/masquer"
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                color: showMdpIdentite ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '1rem', lineHeight: 1, userSelect: 'none',
                transition: 'color 0.15s',
              }}
            >
              {showMdpIdentite ? '👁' : '👁‍🗨'}
            </button>
          </div>
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
