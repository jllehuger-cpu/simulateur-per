'use client'
import { useState } from 'react'
import { UnlockGate } from '@/components/unlock-gate'
import { deriverCle, setCleSession } from '@/lib/crypto'
import { listerDossiers, sauvegarderDossier } from '@/lib/dossiers'

function SettingsContent() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleChangerCle = async () => {
    setError('')
    setResult(null)

    if (newPassword.length < 6) {
      setError('La nouvelle clé doit contenir au moins 6 caractères.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les nouvelles clés ne correspondent pas.')
      return
    }

    setLoading(true)

    try {
      // 1. Dériver l'ancienne clé et l'activer en session pour lire les dossiers
      const ancienneMaitre = await deriverCle(oldPassword)
      setCleSession(ancienneMaitre)

      const dossiers = await listerDossiers()

      if (dossiers.length === 0) {
        setError('Aucun dossier trouvé. Vérifiez votre ancienne clé.')
        setLoading(false)
        return
      }

      // 2. Dériver la nouvelle clé maître et l'activer en session
      const nouvelleMaitre = await deriverCle(newPassword)
      setCleSession(nouvelleMaitre)

      // 3. Re-sauvegarder chaque dossier (sauvegarderDossier utilise getCleSession)
      let count = 0
      for (const dossier of dossiers) {
        await sauvegarderDossier(dossier)
        count++
      }

      // 4. Remettre le flag de migration à jour
      localStorage.setItem('cles_derivees_migre_v1', 'done')

      setResult(`Clé patrimoine changée. ${count} dossier(s) re-chiffré(s).`)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error('[SETTINGS] Erreur changement clé:', err)
      setError('Erreur : l\'ancienne clé est probablement incorrecte.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: '60px auto', padding: '0 20px' }}>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600,
        color: 'var(--text-primary)', marginBottom: 8,
      }}>Paramètres</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
        Gérez vos clés de chiffrement.
      </p>

      <div className="glass-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          Changer la clé patrimoine (Clé A)
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Tous vos dossiers seront déchiffrés avec l&apos;ancienne clé puis re-chiffrés avec la nouvelle.
          Cette opération est irréversible.
        </p>

        {result && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 12,
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
            color: '#6EE7B7', fontSize: 13,
          }}>{result}</div>
        )}
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 12,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#FCA5A5', fontSize: 13,
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="password" value={oldPassword}
            onChange={e => setOldPassword(e.target.value)}
            placeholder="Ancienne clé patrimoine"
            style={{
              padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-surface-md)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
          <input type="password" value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Nouvelle clé patrimoine"
            style={{
              padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-surface-md)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
          <input type="password" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirmer la nouvelle clé"
            onKeyDown={e => e.key === 'Enter' && !loading && void handleChangerCle()}
            style={{
              padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-surface-md)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
          <button
            onClick={() => void handleChangerCle()}
            disabled={loading || !oldPassword || !newPassword || !confirmPassword}
            style={{
              padding: '10px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))',
              color: '#fff', fontWeight: 600, fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading || !oldPassword || !newPassword || !confirmPassword ? 0.5 : 1,
              marginTop: 4,
            }}
          >
            {loading ? 'Re-chiffrement en cours...' : 'Changer la clé patrimoine'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return <UnlockGate><SettingsContent /></UnlockGate>
}
