'use client'

import { useState } from 'react'
import { deriverCle, setCleSession, getCleSession, setCleIdentiteSession } from '@/lib/crypto'

export function UnlockGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => getCleSession() !== null)
  const [mdpPatrimoine, setMdpPatrimoine] = useState('')
  const [mdpIdentite,   setMdpIdentite]   = useState('')
  const [showIdentite,  setShowIdentite]  = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleUnlock = async () => {
    if (!mdpPatrimoine.trim()) return
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

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', position: 'relative', zIndex: 1,
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: '2.5rem',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600,
          color: 'var(--text-primary)', marginBottom: '0.5rem',
        }}>
          Espace CGP sécurisé
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.75rem', lineHeight: 1.6 }}>
          Saisissez votre mot de passe pour déverrouiller et déchiffrer vos dossiers.
          <br />La clé ne quitte jamais votre navigateur.
        </p>

        {/* Clé patrimoine */}
        <input
          className="glass-input"
          type="password"
          value={mdpPatrimoine}
          onChange={e => setMdpPatrimoine(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleUnlock() }}
          placeholder="Clé patrimoine"
          style={{ marginBottom: '0.75rem', textAlign: 'center', letterSpacing: '0.05em' }}
          autoFocus
        />

        {/* Toggle clé identité */}
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

        {/* Clé identité */}
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

        {error && (
          <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem', color: '#F87171' }}>
            {error}
          </div>
        )}

        <button
          onClick={() => void handleUnlock()}
          disabled={loading || !mdpPatrimoine.trim()}
          style={{
            width: '100%',
            padding: '0.7rem 1.5rem',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))',
            color: '#fff',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: loading || !mdpPatrimoine.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !mdpPatrimoine.trim() ? 0.6 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {loading ? '⏳ Dérivation de la clé...' : '🔓 Déverrouiller'}
        </button>

        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1rem', lineHeight: 1.5 }}>
          Sans clé identité, les dossiers s&apos;affichent avec leurs alias uniquement.
        </p>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
          Première utilisation : choisissez un mot de passe fort.<br />
          Il ne peut pas être récupéré — conservez-le hors ligne.
        </p>
      </div>
    </div>
  )
}
