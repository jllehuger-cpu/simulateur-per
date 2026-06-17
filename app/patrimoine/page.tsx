'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getDossier, listerDossiers } from '@/lib/dossiers'
import { UnlockGate } from '@/components/unlock-gate'
import type { DossierPatrimonial } from '@/lib/types'

// ─── Types internes ───────────────────────────────────────────
type Proprietaire = 'Client' | 'Conjoint' | 'Commun'

interface BienUnifie {
  id: string
  categorie: string
  libelle: string
  proprietaire: Proprietaire
  valeur: number
}

// ─── Constantes ───────────────────────────────────────────────
const ICONS: Record<string, string> = {
  'Immobilier':      '🏠',
  'Assurance-Vie':   '🛡️',
  'Valeurs':         '📈',
  'Liquidités':      '💵',
  'Retraite / PER':  '🏦',
  'Épargne salariale': '💼',
  'Autre':           '📦',
}

const COL_CLIENT   = '#3B82F6'
const COL_CONJOINT = '#C9A84C'
const COL_COMMUN   = '#10B981'

// ─── Helpers ─────────────────────────────────────────────────
const EUR = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const PCT = (n: number) => Math.round(n) + '%'

function mapProprietaire(raw: string): Proprietaire {
  const d = (raw ?? '').toLowerCase().trim()
  if (d === 'conjoint') return 'Conjoint'
  if (d === 'client')   return 'Client'
  return 'Commun'
}

function categorieFinancier(type: string): string {
  switch (type) {
    case 'Assurance-Vie':
    case 'Contrat de capitalisation': return 'Assurance-Vie'
    case 'PEA':
    case 'Compte-Titres':             return 'Valeurs'
    case 'Livret A':
    case 'LDDS':
    case 'PEL':
    case 'CEL':                        return 'Liquidités'
    case 'PER':                        return 'Retraite / PER'
    case 'Épargne salariale':          return 'Épargne salariale'
    default:                           return 'Autre'
  }
}

function extraireBiens(dossier: DossierPatrimonial): BienUnifie[] {
  const biens: BienUnifie[] = []

  for (const b of dossier.biens_immo ?? []) {
    if ((b.valeur_venale ?? 0) > 0) {
      biens.push({
        id: b.id,
        categorie: 'Immobilier',
        libelle: [b.type, b.localisation].filter(Boolean).join(' — ') || b.type,
        proprietaire: mapProprietaire(b.detenu_par),
        valeur: b.valeur_venale,
      })
    }
  }

  for (const p of dossier.produits_financiers ?? []) {
    if ((p.valeur_actuelle ?? 0) > 0) {
      biens.push({
        id: p.id,
        categorie: categorieFinancier(p.type),
        libelle: [p.type, p.etablissement].filter(Boolean).join(' — ') || p.type,
        proprietaire: mapProprietaire(p.titulaire),
        valeur: p.valeur_actuelle,
      })
    }
  }

  return biens
}

function bilanParCategorie(biens: BienUnifie[]): Map<string, number> {
  const m = new Map<string, number>()
  biens.forEach(b => m.set(b.categorie, (m.get(b.categorie) ?? 0) + b.valeur))
  return m
}

// ─── Composants partiels ──────────────────────────────────────
function EmptyBiens({ goSaisie }: { goSaisie: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
        Aucun bien saisi
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        Complétez les étapes Immobilier et Financier dans la saisie patrimoniale.
      </div>
      <button
        onClick={goSaisie}
        style={{
          padding: '8px 20px', borderRadius: 8, border: 'none',
          background: 'rgba(59,130,246,0.15)', color: 'var(--accent-blue)',
          cursor: 'pointer', fontWeight: 600, fontSize: 13,
        }}
      >
        ✏️ Aller à la saisie
      </button>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────
function PatrimoineInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const alias        = searchParams.get('alias')

  const [dossier,  setDossier]  = useState<DossierPatrimonial | null>(null)
  const [dossiers, setDossiers] = useState<DossierPatrimonial[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [tab,      setTab]      = useState<'biens' | 'bilan' | 'succession'>('biens')
  const [defunt,   setDefunt]   = useState<'client' | 'conjoint'>('client')
  const [fraisPct, setFraisPct] = useState('7')

  // ── Chargement ───────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    setError(null)
    if (alias) {
      getDossier(alias)
        .then(d => { if (!d) setError('Dossier introuvable'); else setDossier(d) })
        .catch(e => setError((e as Error).message))
        .finally(() => setLoading(false))
    } else {
      listerDossiers()
        .then(setDossiers)
        .catch(e => setError((e as Error).message))
        .finally(() => setLoading(false))
    }
  }, [alias])

  // ── Extraction des biens ─────────────────────────────────
  const biens = useMemo(() => (dossier ? extraireBiens(dossier) : []), [dossier])

  const biensClient   = biens.filter(b => b.proprietaire === 'Client')
  const biensConjoint = biens.filter(b => b.proprietaire === 'Conjoint')
  const biensCommun   = biens.filter(b => b.proprietaire === 'Commun')

  const totClient   = biensClient.reduce((s, b) => s + b.valeur, 0)
  const totConjoint = biensConjoint.reduce((s, b) => s + b.valeur, 0)
  const totCommun   = biensCommun.reduce((s, b) => s + b.valeur, 0)
  const grandTotal  = totClient + totConjoint + totCommun

  // ── Succession ───────────────────────────────────────────
  const identite    = dossier?.identite ?? {}
  const sf          = identite.situation_familiale ?? 'celibataire'
  const hasConjoint = ['marie', 'pacse', 'concubin'].includes(sf)
  const nbEnfants   = (identite.enfants ?? []).length

  const masseDefunt = defunt === 'client' ? totClient + totCommun / 2 : totConjoint + totCommun / 2
  const fraisEuros  = masseDefunt * (parseFloat(fraisPct) || 0) / 100
  const actifNet    = Math.max(0, masseDefunt - fraisEuros)

  interface Part { label: string; pct: number; montant: number; isConjoint: boolean }

  const parts: Part[] = useMemo(() => {
    const survivant = defunt === 'client' ? 'Madame (conjoint survivant)' : 'Monsieur (conjoint survivant)'
    if (!hasConjoint) {
      if (nbEnfants === 0) return []
      const p = 100 / nbEnfants
      return Array.from({ length: nbEnfants }, (_, i) => ({ label: `Enfant ${i + 1}`, pct: p, montant: actifNet * p / 100, isConjoint: false }))
    }
    if (nbEnfants === 0) return [{ label: survivant, pct: 100, montant: actifNet, isConjoint: true }]
    if (nbEnfants === 1) return [
      { label: survivant, pct: 50, montant: actifNet * 0.5, isConjoint: true },
      { label: 'Enfant 1', pct: 50, montant: actifNet * 0.5, isConjoint: false },
    ]
    if (nbEnfants === 2) {
      const p = 100 / 3
      return [
        { label: survivant, pct: p, montant: actifNet / 3, isConjoint: true },
        { label: 'Enfant 1', pct: p, montant: actifNet / 3, isConjoint: false },
        { label: 'Enfant 2', pct: p, montant: actifNet / 3, isConjoint: false },
      ]
    }
    const pE = 75 / nbEnfants
    return [
      { label: survivant, pct: 25, montant: actifNet * 0.25, isConjoint: true },
      ...Array.from({ length: nbEnfants }, (_, i) => ({
        label: `Enfant ${i + 1}`, pct: pE, montant: actifNet * pE / 100, isConjoint: false,
      })),
    ]
  }, [defunt, hasConjoint, nbEnfants, actifNet])

  const goSaisie = () => router.push(`/saisie?alias=${alias}`)

  // ── États de chargement ──────────────────────────────────
  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>
  }

  // ── Sélecteur de dossier (pas d'alias dans l'URL) ────────
  if (!alias) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, fontFamily: 'var(--font-display)' }}>💰 Bilan & Succession</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Sélectionnez un dossier pour afficher son bilan patrimonial</div>
        </div>

        {error && (
          <div style={{ color: '#EF4444', padding: 12, border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        {dossiers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-muted)' }}>
            Aucun dossier disponible.{' '}
            <button onClick={() => router.push('/dossiers')} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }}>
              Créer un dossier
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dossiers.map(d => (
              <button
                key={d.alias}
                onClick={() => router.push(`/patrimoine?alias=${d.alias}`)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 18px',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-glass)',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-gold)' }}>{d.alias}</div>
                  {d.resume_auto && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {d.resume_auto.slice(0, 90)}
                    </div>
                  )}
                </div>
                <span style={{ color: 'var(--accent-blue)', fontSize: 20 }}>→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ color: '#EF4444', fontSize: 14, marginBottom: 16 }}>{error}</div>
        <button onClick={() => router.push('/dossiers')} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)', cursor: 'pointer' }}>
          ← Mes dossiers
        </button>
      </div>
    )
  }

  if (!dossier) return null

  const TABS = [
    { id: 'biens'      as const, label: '📋 Biens saisis' },
    { id: 'bilan'      as const, label: '📊 Bilan patrimonial' },
    { id: 'succession' as const, label: '⚖️ Simulateur succession' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Audit patrimonial
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, fontFamily: 'var(--font-display)' }}>
            💰 Bilan & Succession
          </h1>
          <div style={{ fontSize: 13, color: 'var(--accent-gold)', marginTop: 4, fontWeight: 500 }}>
            {dossier.alias}
            {dossier.resume_auto && (
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                {' · '}{dossier.resume_auto.slice(0, 60)}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={goSaisie} className="btn-ghost" style={{ fontSize: 12 }}>✏️ Saisie</button>
          <button onClick={() => router.push('/dossiers')} className="btn-ghost" style={{ fontSize: 12 }}>← Dossiers</button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 24, width: 'fit-content' }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '9px 18px', borderRadius: 9, border: 'none',
                background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
                fontWeight: active ? 700 : 400, fontSize: 13, cursor: 'pointer',
                borderBottom: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
                transition: 'all 0.18s',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ════════════════════════════════════════════════════════
          TAB 1 : BIENS SAISIS
      ════════════════════════════════════════════════════════ */}
      {tab === 'biens' && (
        biens.length === 0 ? <EmptyBiens goSaisie={goSaisie} /> : (
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Catégorie', 'Description', 'Propriétaire', 'Valeur'].map((h, i) => (
                    <th key={h} style={{
                      padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                      textAlign: i === 3 ? 'right' : 'left', letterSpacing: '0.06em', textTransform: 'uppercase',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {biens.map(b => {
                  const col = b.proprietaire === 'Client' ? COL_CLIENT : b.proprietaire === 'Conjoint' ? COL_CONJOINT : COL_COMMUN
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 16px', fontSize: 13 }}>
                        {ICONS[b.categorie] ?? '📦'} {b.categorie}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{b.libelle}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: `${col}18`, color: col, border: `1px solid ${col}33` }}>
                          {b.proprietaire === 'Client' ? '👨 Monsieur' : b.proprietaire === 'Conjoint' ? '👩 Madame' : '🤝 Commun'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-geist-mono)', fontSize: 13 }}>
                        {EUR(b.valeur)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <td colSpan={3} style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                    TOTAL — {biens.length} bien{biens.length > 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: 16, color: 'var(--accent-emerald)', fontFamily: 'var(--font-geist-mono)' }}>
                    {EUR(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}

      {/* ════════════════════════════════════════════════════════
          TAB 2 : BILAN PATRIMONIAL
      ════════════════════════════════════════════════════════ */}
      {tab === 'bilan' && (
        grandTotal === 0 ? <EmptyBiens goSaisie={goSaisie} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 3 colonnes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { label: '👨 Monsieur (Client)',  color: COL_CLIENT,   biensList: biensClient,   tot: totClient   },
                { label: '👩 Madame (Conjoint)',  color: COL_CONJOINT, biensList: biensConjoint, tot: totConjoint },
                { label: '🤝 Patrimoine Commun',  color: COL_COMMUN,   biensList: biensCommun,   tot: totCommun   },
              ].map(col => {
                const map = bilanParCategorie(col.biensList)
                return (
                  <div key={col.label} style={{ background: 'var(--bg-surface)', border: `1px solid ${col.color}33`, borderRadius: 14, padding: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: col.color, marginBottom: 14 }}>{col.label}</div>

                    {col.biensList.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Aucun bien</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {Array.from(map.entries()).map(([cat, val]) => (
                          <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 9px', background: `${col.color}0A`, borderRadius: 6 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ICONS[cat] ?? '📦'} {cat}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: col.color, fontFamily: 'var(--font-geist-mono)' }}>{EUR(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${col.color}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>TOTAL</span>
                      <span style={{ fontSize: 17, fontWeight: 800, color: col.color, fontFamily: 'var(--font-geist-mono)' }}>{EUR(col.tot)}</span>
                    </div>
                    {grandTotal > 0 && col.tot > 0 && (
                      <div style={{ marginTop: 4, textAlign: 'right', fontSize: 11, color: 'var(--text-muted)' }}>
                        {(col.tot / grandTotal * 100).toFixed(1)}% du total
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Résumé global dark */}
            <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '24px 28px', fontFamily: 'var(--font-geist-mono)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
                ◈ Résumé patrimonial global
              </div>
              {[
                { label: 'Monsieur (Client)',  val: totClient,   color: COL_CLIENT   },
                { label: 'Madame (Conjoint)',  val: totConjoint, color: COL_CONJOINT },
                { label: 'Patrimoine Commun',  val: totCommun,   color: COL_COMMUN   },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{r.label}</span>
                  <span style={{ fontWeight: 700, color: r.color }}>{EUR(r.val)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 0', fontSize: 20, fontWeight: 800 }}>
                <span style={{ color: 'rgba(255,255,255,0.9)', letterSpacing: '0.05em' }}>TOTAL</span>
                <span style={{ color: '#F0F4FF' }}>{EUR(grandTotal)}</span>
              </div>
            </div>
          </div>
        )
      )}

      {/* ════════════════════════════════════════════════════════
          TAB 3 : SIMULATEUR SUCCESSION
      ════════════════════════════════════════════════════════ */}
      {tab === 'succession' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Paramètres */}
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: 16 }}>
              Paramètres de simulation
            </div>

            {/* Contexte dossier */}
            <div style={{ padding: '9px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, marginBottom: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
              Situation : <strong>{sf}</strong>
              {hasConjoint && ' · Avec conjoint'}
              {' · '}<strong>{nbEnfants}</strong> enfant{nbEnfants !== 1 ? 's' : ''}
              {' · '} Données issues du dossier <span style={{ color: 'var(--accent-gold)' }}>{dossier.alias}</span>
            </div>

            {/* Qui décède ? */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Qui décède en premier ?</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { v: 'client'   as const, label: '👨 Monsieur décède', col: COL_CLIENT,   disabled: false },
                  { v: 'conjoint' as const, label: '👩 Madame décède',   col: COL_CONJOINT, disabled: !hasConjoint },
                ].map(({ v, label, col, disabled }) => {
                  const active = defunt === v
                  return (
                    <button
                      key={v}
                      onClick={() => { if (!disabled) setDefunt(v) }}
                      style={{
                        flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                        background: active ? `${col}22` : 'rgba(255,255,255,0.03)',
                        color: active ? col : disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
                        fontWeight: active ? 700 : 400, fontSize: 13,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        outline: active ? `2px solid ${col}66` : '2px solid transparent',
                        opacity: disabled ? 0.4 : 1,
                        transition: 'all 0.18s',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {!hasConjoint && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  Pas de conjoint — situation familiale : {sf}
                </div>
              )}
            </div>

            {/* Frais */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Frais de succession (%)
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>estimé 5–10 %</span>
                </div>
                <input
                  className="glass-input"
                  type="number"
                  value={fraisPct}
                  onChange={e => setFraisPct(e.target.value)}
                  min={0} max={30} step={0.5}
                  style={{ textAlign: 'right' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Frais estimés</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#EF4444', fontFamily: 'var(--font-geist-mono)' }}>{EUR(fraisEuros)}</div>
              </div>
            </div>
          </div>

          {masseDefunt === 0 ? (
            <EmptyBiens goSaisie={goSaisie} />
          ) : (
            <>
              {/* Masse successorale */}
              <div className="glass-card" style={{ padding: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--accent-amber)', textTransform: 'uppercase', marginBottom: 14 }}>
                  ⚖️ Masse successorale — {defunt === 'client' ? 'Monsieur' : 'Madame'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Patrimoine propre', val: defunt === 'client' ? totClient : totConjoint, color: defunt === 'client' ? COL_CLIENT : COL_CONJOINT },
                    { label: '½ du commun',        val: totCommun / 2, color: COL_COMMUN },
                    { label: 'Actif brut',          val: masseDefunt,   color: 'var(--accent-amber)' },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: item.color, fontFamily: 'var(--font-geist-mono)' }}>{EUR(item.val)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>Frais de succession ({fraisPct}%)</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#EF4444', fontFamily: 'var(--font-geist-mono)' }}>− {EUR(fraisEuros)}</span>
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>Actif net successoral</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-geist-mono)' }}>{EUR(actifNet)}</span>
                </div>
              </div>

              {/* Répartition héritiers */}
              <div className="glass-card" style={{ padding: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: 6 }}>
                  👨‍👩‍👧 Dévolution légale (Code civil)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                  {!hasConjoint && nbEnfants === 0 && 'Aucun héritier identifié dans le dossier'}
                  {!hasConjoint && nbEnfants > 0  && `${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''} — parts égales`}
                  {hasConjoint  && nbEnfants === 0 && 'Sans enfant — conjoint hérite en totalité'}
                  {hasConjoint  && nbEnfants === 1 && '1 enfant + conjoint — partage 50/50'}
                  {hasConjoint  && nbEnfants === 2 && '2 enfants + conjoint — partage en tiers'}
                  {hasConjoint  && nbEnfants >= 3  && `${nbEnfants} enfants + conjoint — conjoint ¼, enfants ¾`}
                </div>

                {parts.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                    Aucun héritier identifiable — vérifiez les données du dossier.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {parts.map((p, i) => {
                      const col = p.isConjoint
                        ? (defunt === 'client' ? COL_CONJOINT : COL_CLIENT)
                        : '#A78BFA'
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: `${col}0D`, border: `1px solid ${col}33`, borderRadius: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {p.isConjoint ? '💍 ' : '👶 '}{p.label}
                            </div>
                          </div>
                          <div style={{ width: 80 }}>
                            <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                              <div style={{ height: '100%', width: `${Math.min(p.pct, 100)}%`, background: col, borderRadius: 3 }} />
                            </div>
                          </div>
                          <div style={{ minWidth: 44, textAlign: 'right', fontSize: 12, fontWeight: 700, color: col }}>
                            {PCT(p.pct)}
                          </div>
                          <div style={{ minWidth: 108, textAlign: 'right', fontFamily: 'var(--font-geist-mono)', fontSize: 15, fontWeight: 800, color: col }}>
                            {EUR(p.montant)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  ⚠️ Simulation indicative — dévolution légale sans testament ni donation entre époux (DDE).
                  Les droits de succession (barèmes fiscaux) ne sont pas calculés ici. Consultez un notaire.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Export avec UnlockGate + Suspense ───────────────────────
export default function PatrimoinePage() {
  return (
    <UnlockGate>
      <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>}>
        <PatrimoineInner />
      </Suspense>
    </UnlockGate>
  )
}
