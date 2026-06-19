'use client'
import { useState } from 'react'
import { UnlockGate } from '@/components/unlock-gate'
import { CleBManager } from '@/components/cle-b-modal'
import { useAuth } from '@/lib/use-auth'
import { isCleSessionUnlocked, deriverCle, setCleSession } from '@/lib/crypto'
import { listerDossiers, sauvegarderDossier, exporterTousLesDossiersJSON } from '@/lib/dossiers'

type Tab = 'profil' | 'cles' | 'compte'

const card: React.CSSProperties = { padding: 24, marginBottom: 20 }
const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--border-glass)', background: 'var(--bg-surface-md)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
}
const statusBadge = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
  background: active ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
  color: active ? '#6EE7B7' : '#FCD34D',
  border: `1px solid ${active ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
})

// ── Onglet Clé A — réutilise la logique existante de changement de clé ──────
function CleAChangeForm() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

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
      const ancienneMaitre = await deriverCle(oldPassword)
      setCleSession(ancienneMaitre)

      const dossiers = await listerDossiers()
      if (dossiers.length === 0) {
        setError('Aucun dossier trouvé. Vérifiez votre ancienne clé.')
        setLoading(false)
        return
      }

      const nouvelleMaitre = await deriverCle(newPassword)
      setCleSession(nouvelleMaitre)

      let count = 0
      for (const dossier of dossiers) {
        await sauvegarderDossier(dossier)
        count++
      }

      localStorage.setItem('cles_derivees_migre_v1', 'done')

      setResult(`Clé patrimoine changée. ${count} dossier(s) re-chiffré(s).`)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowForm(false)
    } catch (err) {
      console.error('[SETTINGS] Erreur changement clé:', err)
      setError('Erreur : l\'ancienne clé est probablement incorrecte.')
    } finally {
      setLoading(false)
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        style={{
          padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)',
          background: 'rgba(59,130,246,0.08)', color: 'var(--accent-blue)',
          fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}
      >
        🔄 Changer la Clé A
      </button>
    )
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        padding: '10px 14px', borderRadius: 8, marginBottom: 14,
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
        color: '#FCD34D', fontSize: 12, lineHeight: 1.6,
      }}>
        ⚠️ Tous vos dossiers seront déchiffrés avec l&apos;ancienne clé puis re-chiffrés avec la nouvelle.
        Opération irréversible, peut prendre du temps selon le nombre de dossiers.
      </div>

      {result && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#6EE7B7', fontSize: 13 }}>{result}</div>
      )}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: 13 }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)}
          placeholder="Ancienne clé patrimoine" style={inputStyle} />
        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
          placeholder="Nouvelle clé patrimoine" style={inputStyle} />
        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Confirmer la nouvelle clé"
          onKeyDown={e => e.key === 'Enter' && !loading && void handleChangerCle()}
          style={inputStyle} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowForm(false)} disabled={loading} className="btn-ghost" style={{ flex: 1, fontSize: 13 }}>
            Annuler
          </button>
          <button
            onClick={() => void handleChangerCle()}
            disabled={loading || !oldPassword || !newPassword || !confirmPassword}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))',
              color: '#fff', fontWeight: 600, fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading || !oldPassword || !newPassword || !confirmPassword ? 0.5 : 1,
            }}
          >
            {loading ? 'Re-chiffrement...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Onglet Clés de chiffrement ───────────────────────────────────────────────
function ClesTab() {
  const cleAActive = isCleSessionUnlocked()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const handleExport = async () => {
    setExporting(true); setExportError('')
    try {
      await exporterTousLesDossiersJSON()
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Erreur lors de l\'export')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="glass-card" style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Clé A (Patrimoine)
          </h2>
          <span style={statusBadge(cleAActive)}>
            {cleAActive ? '✅ Déverrouillée (session actuelle)' : '❌ Verrouillée'}
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 14, lineHeight: 1.6 }}>
          ℹ️ La Clé A chiffre l&apos;intégralité de votre patrimoine. Elle n&apos;est jamais stockée — ni
          par vous, ni par nous — et ne peut pas être récupérée en cas d&apos;oubli.
        </p>
        <CleAChangeForm />
      </div>

      <div className="glass-card" style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Clé B (Identité)
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 14, lineHeight: 1.6 }}>
          ℹ️ Optionnelle. Chiffre séparément les noms, prénoms et coordonnées de vos clients.
          Sans elle, vos dossiers restent identifiés par leur alias uniquement.
        </p>
        <CleBManager />
      </div>

      <div className="glass-card" style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Sauvegardes / Export
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 14, lineHeight: 1.6 }}>
          Télécharge une copie locale en clair de tous vos dossiers déchiffrés (sauvegarde hors-ligne).
        </p>
        {exportError && (
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: 13 }}>{exportError}</div>
        )}
        <button
          onClick={() => void handleExport()}
          disabled={exporting}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)',
            background: 'rgba(59,130,246,0.08)', color: 'var(--accent-blue)',
            fontWeight: 600, fontSize: 13, cursor: exporting ? 'not-allowed' : 'pointer',
            opacity: exporting ? 0.6 : 1,
          }}
        >
          {exporting ? '⏳ Export...' : '📥 Exporter mes données'}
        </button>
      </div>
    </>
  )
}

// ── Onglet Profil ─────────────────────────────────────────────────────────────
function ProfilTab() {
  const { user, profil } = useAuth()
  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }
  return (
    <div className="glass-card" style={card}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 14px' }}>Profil</h2>
      <div style={row}><span style={{ color: 'var(--text-muted)' }}>Nom</span><span style={{ color: 'var(--text-primary)' }}>{profil?.nom || '—'}</span></div>
      <div style={row}><span style={{ color: 'var(--text-muted)' }}>Email</span><span style={{ color: 'var(--text-primary)' }}>{user?.email}</span></div>
      <div style={row}><span style={{ color: 'var(--text-muted)' }}>Cabinet</span><span style={{ color: 'var(--text-primary)' }}>{profil?.cabinet || '—'}</span></div>
      <div style={{ ...row, borderBottom: 'none' }}><span style={{ color: 'var(--text-muted)' }}>Rôle</span><span style={{ color: 'var(--text-primary)' }}>{profil?.role ?? 'cgp'}</span></div>
    </div>
  )
}

// ── Onglet Compte ─────────────────────────────────────────────────────────────
function CompteTab() {
  const { user, profil } = useAuth()
  return (
    <div className="glass-card" style={card}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 14px' }}>Compte</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Connecté en tant que <strong style={{ color: 'var(--text-primary)' }}>{user?.email}</strong>
        {profil?.role && <> · <span style={{ color: 'var(--text-muted)' }}>{profil.role}</span></>}
      </p>
      <a href="/api/auth/logout" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
        color: '#F87171', textDecoration: 'none',
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
      }}>
        Se déconnecter
      </a>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string }[] = [
  { id: 'profil', label: 'Profil' },
  { id: 'cles',   label: 'Clés de chiffrement' },
  { id: 'compte', label: 'Compte' },
]

function SettingsContent() {
  const [tab, setTab] = useState<Tab>('cles')

  return (
    <div style={{ maxWidth: 560, margin: '60px auto', padding: '0 20px' }}>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600,
        color: 'var(--text-primary)', marginBottom: 8,
      }}>Paramètres</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Gérez votre profil, vos clés de chiffrement et votre compte.
      </p>

      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '0.6rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
            borderBottom: `2px solid ${tab === t.id ? 'var(--accent-blue)' : 'transparent'}`,
            marginBottom: -1, transition: 'color 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profil' && <ProfilTab />}
      {tab === 'cles'   && <ClesTab />}
      {tab === 'compte' && <CompteTab />}
    </div>
  )
}

export default function SettingsPage() {
  return <UnlockGate><SettingsContent /></UnlockGate>
}
