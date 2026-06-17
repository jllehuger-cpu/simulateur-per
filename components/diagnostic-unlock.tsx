'use client'

// ──────────────────────────────────────────────────────────────────────────────
//  Composant de diagnostic — UNIQUEMENT en mode développement ou avec ?debug=1
//  Ne jamais exposer en production sans contrôle d'accès
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// Clés réelles utilisées dans le codebase (à synchroniser avec lib/types.ts et lib/crypto.ts)
const STORAGE_KEY    = 'cgp_dossiers_v1'
const SESSION_FLAG   = '_cleSession_flag'
const MIGRATION_FLAG = 'cles_derivees_migre_v1'

// Anciennes clés potentielles (noms alternatifs rencontrés dans le code)
const LEGACY_KEYS = ['heritum_dossiers', 'heritum_dossiers_v1', 'cgp_dossiers', 'dossiers']

interface RawEntry {
  alias: string
  chiffre: string
  iv: string
}

interface DiagSnapshot {
  storageKey: string
  entries: RawEntry[]
  sessionFlag: string | null
  migrationFlag: string | null
  legacyFound: { key: string; count: number }[]
  allStorageKeys: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseEntries(raw: string | null): RawEntry[] {
  if (!raw) return []
  try { return JSON.parse(raw) as RawEntry[] }
  catch { return [] }
}

function snapshot(): DiagSnapshot {
  const entries = parseEntries(localStorage.getItem(STORAGE_KEY))

  const legacyFound = LEGACY_KEYS
    .map(k => ({ key: k, count: parseEntries(localStorage.getItem(k)).length }))
    .filter(r => r.count > 0)

  return {
    storageKey: STORAGE_KEY,
    entries,
    sessionFlag: sessionStorage.getItem(SESSION_FLAG),
    migrationFlag: localStorage.getItem(MIGRATION_FLAG),
    legacyFound,
    allStorageKeys: Object.keys(localStorage),
  }
}

// ── Sous-composant interne (nécessite useSearchParams → Suspense) ──────────────

function DiagnosticPanel() {
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [diag, setDiag] = useState<DiagSnapshot | null>(null)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetDone, setResetDone] = useState('')

  useEffect(() => {
    const isDev    = process.env.NODE_ENV === 'development'
    const hasParam = searchParams.get('debug') === '1'
    setVisible(isDev || hasParam)
  }, [searchParams])

  if (!visible) return null

  // ── Actions ────────────────────────────────────────────────────────────────

  const diagnose = () => {
    const s = snapshot()
    setDiag(s)
    setResetDone('')

    console.group('[DIAGNOSTIC] État du stockage')
    console.log('Clé active       :', s.storageKey)
    console.log('Dossiers trouvés :', s.entries.length)
    s.entries.forEach((e, i) => {
      console.log(`  Dossier ${i + 1}`, {
        alias        : e.alias,
        chiffreLength: e.chiffre?.length ?? 0,
        ivLength     : e.iv?.length ?? 0,
        ivValid      : typeof e.iv === 'string' && e.iv.length > 0,
      })
    })
    console.log('Flag session     :', s.sessionFlag)
    console.log('Flag migration   :', s.migrationFlag)
    if (s.legacyFound.length > 0) {
      console.warn('[DIAGNOSTIC] Clés legacy détectées (mauvais STORAGE_KEY ?) :', s.legacyFound)
    }
    console.log('Toutes les clés  :', s.allStorageKeys)
    console.groupEnd()
  }

  const exporterDossiers = () => {
    const s = snapshot()
    const payload = {
      exportedAt   : new Date().toISOString(),
      storageKey   : s.storageKey,
      entries      : s.entries,
      migrationFlag: s.migrationFlag,
      legacyFound  : s.legacyFound,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `backup-dossiers-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const resetDossiers = () => {
    if (!resetConfirm) { setResetConfirm(true); return }
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(MIGRATION_FLAG)
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k))
    setResetConfirm(false)
    setResetDone('localStorage dossiers supprimé. Rechargez la page.')
    diagnose()
  }

  const nettoyerSession = () => {
    sessionStorage.removeItem(SESSION_FLAG)
    setResetDone('Flag sessionStorage supprimé.')
    diagnose()
  }

  const resetMigrationFlag = () => {
    localStorage.removeItem(MIGRATION_FLAG)
    setResetDone('Flag migration supprimé — la migration retournera au prochain unlock.')
    diagnose()
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const s = diag

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      fontFamily: 'monospace', fontSize: 12,
    }}>
      {/* Toggle */}
      <button
        onClick={() => { setOpen(v => !v); if (!open) diagnose() }}
        style={{
          padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.4)',
          background: 'rgba(245,158,11,0.1)', color: '#F59E0B',
          cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
          display: 'block', marginLeft: 'auto',
        }}
      >
        🔧 Debug
      </button>

      {open && (
        <div style={{
          marginTop: 8, padding: 16, borderRadius: 12, width: 380,
          background: 'rgba(8,11,20,0.97)', border: '1px solid rgba(245,158,11,0.25)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          maxHeight: '80vh', overflowY: 'auto',
        }}>
          <div style={{ color: '#F59E0B', fontWeight: 700, marginBottom: 12, fontSize: 13 }}>
            🔧 Diagnostic Unlock
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <Btn onClick={diagnose} color="#60A5FA">📋 Diagnostiquer</Btn>
            <Btn onClick={exporterDossiers} color="#34D399">💾 Exporter</Btn>
            <Btn onClick={nettoyerSession} color="#A78BFA">🗑️ Reset session flag</Btn>
            <Btn onClick={resetMigrationFlag} color="#A78BFA">🔁 Reset migration flag</Btn>
            <Btn
              onClick={resetDossiers}
              color={resetConfirm ? '#F87171' : '#F59E0B'}
              style={resetConfirm ? { border: '1px solid rgba(248,113,113,0.5)' } : {}}
            >
              {resetConfirm ? '⚠️ Confirmer suppression' : '🔄 Reset localStorage'}
            </Btn>
            {resetConfirm && (
              <Btn onClick={() => setResetConfirm(false)} color="var(--text-muted)">✕ Annuler</Btn>
            )}
          </div>

          {resetDone && (
            <div style={{ marginBottom: 10, padding: '6px 10px', borderRadius: 6,
              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)',
              color: '#6EE7B7', fontSize: 11 }}>
              ✅ {resetDone}
            </div>
          )}

          {resetConfirm && (
            <div style={{ marginBottom: 10, padding: '6px 10px', borderRadius: 6,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#FCA5A5', fontSize: 11 }}>
              ⚠️ Cette action supprime TOUS les dossiers du localStorage. Les données chiffrées sur Supabase restent intactes.
            </div>
          )}

          {/* Résultats */}
          {s && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Clé active */}
              <Section title="Clé localStorage active">
                <Row label="Clé" value={s.storageKey} mono />
                <Row label="Dossiers" value={String(s.entries.length)}
                  color={s.entries.length === 0 ? '#F87171' : '#34D399'} />
              </Section>

              {/* Entrées */}
              {s.entries.length > 0 && (
                <Section title="Dossiers trouvés">
                  {s.entries.map((e, i) => (
                    <div key={i} style={{ marginBottom: 6, paddingBottom: 6,
                      borderBottom: i < s.entries.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <Row label="alias"   value={e.alias} mono />
                      <Row label="chiffre" value={`${e.chiffre?.length ?? 0} chars`} />
                      <Row label="iv"      value={`${e.iv?.length ?? 0} chars`}
                        color={e.iv?.length >= 16 ? '#34D399' : '#F87171'} />
                    </div>
                  ))}
                </Section>
              )}

              {/* Clés legacy */}
              {s.legacyFound.length > 0 && (
                <Section title="⚠️ Clés legacy détectées" titleColor="#F59E0B">
                  <div style={{ color: '#FCD34D', fontSize: 11, marginBottom: 4 }}>
                    Des dossiers existent sous des clés non utilisées par le code actuel.
                  </div>
                  {s.legacyFound.map(r => (
                    <Row key={r.key} label={r.key} value={`${r.count} dossier(s)`}
                      color="#F59E0B" mono />
                  ))}
                </Section>
              )}

              {/* Flags */}
              <Section title="Flags">
                <Row label="Session flag"   value={s.sessionFlag   ?? '— absent'} color={s.sessionFlag   ? '#34D399' : '#F87171'} />
                <Row label="Migration flag" value={s.migrationFlag ?? '— absent'} color={s.migrationFlag ? '#34D399' : '#F59E0B'} />
              </Section>

              {/* Toutes les clés */}
              <Section title={`Toutes les clés localStorage (${s.allStorageKeys.length})`}>
                <div style={{ maxHeight: 100, overflowY: 'auto' }}>
                  {s.allStorageKeys.map(k => (
                    <div key={k} style={{
                      color: k === STORAGE_KEY ? '#34D399' : LEGACY_KEYS.includes(k) ? '#F59E0B' : 'var(--text-muted)',
                      lineHeight: 1.6,
                    }}>
                      {k === STORAGE_KEY ? '✓ ' : LEGACY_KEYS.includes(k) ? '⚠ ' : '  '}{k}
                    </div>
                  ))}
                </div>
              </Section>

            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Petits composants utilitaires ─────────────────────────────────────────────

function Btn({
  onClick, children, color, style = {},
}: {
  onClick: () => void
  children: React.ReactNode
  color: string
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 8px', borderRadius: 6, border: `1px solid ${color}22`,
        background: `${color}11`, color, cursor: 'pointer',
        fontFamily: 'monospace', fontSize: 11, fontWeight: 600,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function Section({
  title, titleColor = '#94A3B8', children,
}: {
  title: string
  titleColor?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 8,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: titleColor, marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({
  label, value, mono = false, color = 'var(--text-secondary)',
}: {
  label: string
  value: string
  mono?: boolean
  color?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8,
      lineHeight: 1.8, alignItems: 'baseline' }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ color, fontFamily: mono ? 'monospace' : 'inherit',
        textAlign: 'right', wordBreak: 'break-all' }}>
        {value}
      </span>
    </div>
  )
}

// ── Export (enveloppé dans Suspense pour useSearchParams) ─────────────────────

export function DiagnosticUnlock() {
  return (
    <Suspense>
      <DiagnosticPanel />
    </Suspense>
  )
}
