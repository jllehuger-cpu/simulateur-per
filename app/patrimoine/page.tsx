'use client'

import { useState } from 'react'

// ─── Types ───────────────────────────────────────────────────
type TypeBien =
  | 'Immobilier'
  | 'Liquidités'
  | 'Assurance-Vie'
  | 'Valeurs'
  | 'Entreprise'
  | 'Or/Métaux'
  | 'Autre'

interface Bien {
  id: string
  type: TypeBien
  libelle: string
  valeur: number
}

interface FormBien {
  type: TypeBien
  libelle: string
  valeur: string
}

interface Enfant {
  id: string
  nom: string
}

// ─── Constantes ──────────────────────────────────────────────
const TYPES: TypeBien[] = [
  'Immobilier', 'Liquidités', 'Assurance-Vie',
  'Valeurs', 'Entreprise', 'Or/Métaux', 'Autre',
]
const ICONS: Record<TypeBien, string> = {
  'Immobilier':   '🏠',
  'Liquidités':   '💵',
  'Assurance-Vie':'🛡️',
  'Valeurs':      '📈',
  'Entreprise':   '🏢',
  'Or/Métaux':    '🥇',
  'Autre':        '📦',
}

// ─── Helpers ─────────────────────────────────────────────────
const EUR = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const total = (biens: Bien[]) => biens.reduce((s, b) => s + b.valeur, 0)

const byType = (biens: Bien[]) => {
  const map = new Map<TypeBien, number>()
  biens.forEach(b => map.set(b.type, (map.get(b.type) ?? 0) + b.valeur))
  return map
}

function emptyForm(): FormBien {
  return { type: 'Immobilier', libelle: '', valeur: '' }
}

// ─── Composant Tableau de biens ──────────────────────────────
function TableauBiens({
  title, color, biens, form, onForm, onAdd, onDelete,
}: {
  title: string; color: string
  biens: Bien[]
  form: FormBien; onForm: (f: FormBien) => void
  onAdd: () => void; onDelete: (id: string) => void
}) {
  const tot = total(biens)
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: `1px solid ${color}33`,
      borderRadius: 14, padding: 20,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color, marginBottom: 14 }}>{title}</div>

      {/* Table */}
      {biens.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
          Aucun bien renseigné
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
          <thead>
            <tr style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>
              <th style={{ padding: '4px 8px', fontWeight: 500 }}>Type</th>
              <th style={{ padding: '4px 8px', fontWeight: 500 }}>Libellé</th>
              <th style={{ padding: '4px 8px', fontWeight: 500, textAlign: 'right' }}>Valeur</th>
              <th style={{ padding: '4px 8px', width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {biens.map(b => (
              <tr key={b.id} style={{
                borderTop: '1px solid rgba(255,255,255,0.05)',
                fontSize: 13,
              }}>
                <td style={{ padding: '6px 8px' }}>
                  <span>{ICONS[b.type]} {b.type}</span>
                </td>
                <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{b.libelle}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-geist-mono)' }}>
                  {EUR(b.valeur)}
                </td>
                <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                  <button
                    onClick={() => onDelete(b.id)}
                    style={{
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 5, color: '#EF4444', cursor: 'pointer',
                      fontSize: 11, padding: '2px 6px',
                    }}
                  >✕</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `1px solid ${color}44` }}>
              <td colSpan={2} style={{ padding: '8px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Total</td>
              <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, fontSize: 14, color }}>
                {EUR(tot)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}

      {/* Formulaire d'ajout */}
      <div style={{
        marginTop: 12, padding: '14px', background: 'rgba(255,255,255,0.02)',
        border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 10,
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Ajouter un bien
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Type</div>
            <select
              className="glass-input"
              value={form.type}
              onChange={e => onForm({ ...form, type: e.target.value as TypeBien })}
              style={{ fontSize: 12 }}
            >
              {TYPES.map(t => <option key={t} value={t}>{ICONS[t]} {t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Libellé</div>
            <input
              className="glass-input"
              value={form.libelle}
              onChange={e => onForm({ ...form, libelle: e.target.value })}
              placeholder="ex: Maison Boulogne"
              style={{ fontSize: 12 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Valeur (€)</div>
            <input
              className="glass-input"
              type="number"
              value={form.valeur}
              onChange={e => onForm({ ...form, valeur: e.target.value })}
              placeholder="0"
              min={0}
              style={{ fontSize: 12, textAlign: 'right' }}
            />
          </div>
        </div>
        <button
          onClick={onAdd}
          disabled={!form.libelle.trim() || !form.valeur || parseFloat(form.valeur) <= 0}
          style={{
            marginTop: 10, width: '100%', padding: '8px',
            background: form.libelle.trim() && form.valeur && parseFloat(form.valeur) > 0
              ? `linear-gradient(135deg, ${color}22, ${color}11)`
              : 'rgba(255,255,255,0.03)',
            border: `1px solid ${color}44`,
            borderRadius: 8, color,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.18s',
          }}
        >
          + Ajouter ce bien
        </button>
      </div>
    </div>
  )
}

// ─── Page principale ─────────────────────────────────────────
export default function PatrimoinePage() {
  const [tab, setTab] = useState<'saisie' | 'bilan' | 'succession'>('saisie')

  // Biens par pôle
  const [biensMr,     setBiensMr]     = useState<Bien[]>([])
  const [biensMme,    setBiensMme]    = useState<Bien[]>([])
  const [biensCommun, setBiensCommun] = useState<Bien[]>([])

  // Formulaires
  const [formMr,     setFormMr]     = useState<FormBien>(emptyForm())
  const [formMme,    setFormMme]    = useState<FormBien>(emptyForm())
  const [formCommun, setFormCommun] = useState<FormBien>(emptyForm())

  // Succession
  const [defunt,   setDefunt]   = useState<'mr' | 'mme'>('mr')
  const [fraisPct, setFraisPct] = useState<string>('7')
  const [enfants,  setEnfants]  = useState<Enfant[]>([
    { id: '1', nom: 'Alice' },
    { id: '2', nom: 'Bob' },
  ])
  const [newEnfantNom, setNewEnfantNom] = useState('')

  // ── Helpers d'ajout/suppression ────────────────────────────
  const addBien = (
    biens: Bien[], set: (b: Bien[]) => void,
    form: FormBien, reset: (f: FormBien) => void,
  ) => {
    const v = parseFloat(form.valeur)
    if (!form.libelle.trim() || isNaN(v) || v <= 0) return
    set([...biens, { id: crypto.randomUUID(), type: form.type, libelle: form.libelle.trim(), valeur: v }])
    reset(emptyForm())
  }

  const delBien = (set: (b: Bien[]) => void, biens: Bien[], id: string) =>
    set(biens.filter(b => b.id !== id))

  // ── Totaux ─────────────────────────────────────────────────
  const totMr     = total(biensMr)
  const totMme    = total(biensMme)
  const totCommun = total(biensCommun)
  const grandTotal = totMr + totMme + totCommun

  // ── Calcul succession ──────────────────────────────────────
  const masseDefunt = defunt === 'mr'
    ? totMr + totCommun / 2
    : totMme + totCommun / 2

  const fraisEuros  = masseDefunt * (parseFloat(fraisPct) || 0) / 100
  const actifNet    = Math.max(0, masseDefunt - fraisEuros)
  const nbEnfants   = enfants.length
  const hasConjoint = true // toujours présent dans cette démo

  interface Part { label: string; pct: number; montant: number; tag?: string }

  const parts: Part[] = (() => {
    if (!hasConjoint && nbEnfants === 0) return []
    if (!hasConjoint) {
      const pE = 100 / nbEnfants
      return enfants.map(e => ({ label: e.nom, pct: pE, montant: actifNet * pE / 100 }))
    }
    const conjointLabel = defunt === 'mr' ? 'Madame (conjoint survivant)' : 'Monsieur (conjoint survivant)'
    if (nbEnfants === 0) {
      return [{ label: conjointLabel, pct: 100, montant: actifNet, tag: 'Héritier unique' }]
    }
    if (nbEnfants === 1) {
      return [
        { label: conjointLabel, pct: 50, montant: actifNet * 0.5, tag: '1/2 en PP' },
        { label: enfants[0].nom, pct: 50, montant: actifNet * 0.5, tag: '1/2 en PP' },
      ]
    }
    if (nbEnfants === 2) {
      const pE = 100 / 3
      return [
        { label: conjointLabel, pct: pE, montant: actifNet / 3, tag: '1/3 en PP' },
        ...enfants.map(e => ({ label: e.nom, pct: pE, montant: actifNet / 3, tag: '1/3 en PP' })),
      ]
    }
    // 3+ enfants
    const pE = 75 / nbEnfants
    return [
      { label: conjointLabel, pct: 25, montant: actifNet * 0.25, tag: '1/4 en PP' },
      ...enfants.map(e => ({ label: e.nom, pct: pE, montant: actifNet * pE / 100, tag: `${(75 / nbEnfants).toFixed(1)}%` })),
    ]
  })()

  // ── Couleurs des onglets de saisie ─────────────────────────
  const COL_MR     = '#3B82F6'
  const COL_MME    = '#C9A84C'
  const COL_COMMUN = '#10B981'

  const TABS = [
    { id: 'saisie' as const,     label: '📝 Saisie des biens' },
    { id: 'bilan' as const,      label: '📊 Bilan patrimonial' },
    { id: 'succession' as const, label: '⚖️ Simulateur succession' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          Outil patrimonial
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-display)' }}>
          💰 Bilan & Succession
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
          Saisie des biens · Bilan par pôle · Simulation de la dévolution légale
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: 4,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, marginBottom: 24, width: 'fit-content',
      }}>
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
                fontWeight: active ? 700 : 400,
                fontSize: 13, cursor: 'pointer',
                borderBottom: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
                transition: 'all 0.18s',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════
          TAB 1 : SAISIE
      ══════════════════════════════════════════════════════════ */}
      {tab === 'saisie' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <TableauBiens
            title="👨 Patrimoine de Monsieur"
            color={COL_MR}
            biens={biensMr}
            form={formMr}
            onForm={setFormMr}
            onAdd={() => addBien(biensMr, setBiensMr, formMr, setFormMr)}
            onDelete={id => delBien(setBiensMr, biensMr, id)}
          />
          <TableauBiens
            title="👩 Patrimoine de Madame"
            color={COL_MME}
            biens={biensMme}
            form={formMme}
            onForm={setFormMme}
            onAdd={() => addBien(biensMme, setBiensMme, formMme, setFormMme)}
            onDelete={id => delBien(setBiensMme, biensMme, id)}
          />
          <TableauBiens
            title="🤝 Patrimoine Commun"
            color={COL_COMMUN}
            biens={biensCommun}
            form={formCommun}
            onForm={setFormCommun}
            onAdd={() => addBien(biensCommun, setBiensCommun, formCommun, setFormCommun)}
            onDelete={id => delBien(setBiensCommun, biensCommun, id)}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 2 : BILAN
      ══════════════════════════════════════════════════════════ */}
      {tab === 'bilan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {grandTotal === 0 && (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              color: 'var(--text-muted)', fontSize: 13,
              border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12,
            }}>
              Aucun bien saisi — rendez-vous dans l&apos;onglet &quot;Saisie des biens&quot;
            </div>
          )}

          {grandTotal > 0 && (
            <>
              {/* 3 colonnes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { label: '👨 Monsieur',   color: COL_MR,     biens: biensMr,     tot: totMr     },
                  { label: '👩 Madame',     color: COL_MME,    biens: biensMme,    tot: totMme    },
                  { label: '🤝 Commun',     color: COL_COMMUN, biens: biensCommun, tot: totCommun },
                ].map(col => {
                  const map = byType(col.biens)
                  return (
                    <div key={col.label} style={{
                      background: 'var(--bg-surface)',
                      border: `1px solid ${col.color}33`,
                      borderRadius: 14, padding: 18,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: col.color, marginBottom: 14 }}>
                        {col.label}
                      </div>

                      {col.biens.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                          Aucun bien
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {Array.from(map.entries()).map(([type, val]) => (
                            <div key={type} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '6px 10px',
                              background: `${col.color}0A`,
                              borderRadius: 7,
                            }}>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {ICONS[type]} {type}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-geist-mono)', color: col.color }}>
                                {EUR(val)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{
                        marginTop: 14, paddingTop: 10,
                        borderTop: `1px solid ${col.color}33`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>TOTAL</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: col.color, fontFamily: 'var(--font-geist-mono)' }}>
                          {EUR(col.tot)}
                        </span>
                      </div>

                      {grandTotal > 0 && (
                        <div style={{ marginTop: 6, textAlign: 'right' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {(col.tot / grandTotal * 100).toFixed(1)}% du total
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Résumé global */}
              <div style={{
                background: '#0F172A',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: '24px 28px',
                fontFamily: 'var(--font-geist-mono)',
              }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
                  ◈ Résumé patrimonial global
                </div>
                {[
                  { label: 'Monsieur',  val: totMr,     color: COL_MR     },
                  { label: 'Madame',    val: totMme,    color: COL_MME    },
                  { label: 'Commun',    val: totCommun, color: COL_COMMUN },
                ].map(row => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    fontSize: 13,
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>{row.label}</span>
                    <span style={{ color: row.color, fontWeight: 700 }}>{EUR(row.val)}</span>
                  </div>
                ))}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '14px 0 0',
                  fontSize: 18, fontWeight: 800,
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.9)', letterSpacing: '0.05em' }}>TOTAL</span>
                  <span style={{ color: '#F0F4FF' }}>{EUR(grandTotal)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB 3 : SUCCESSION
      ══════════════════════════════════════════════════════════ */}
      {tab === 'succession' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Paramètres */}
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
              color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: 16,
            }}>
              Paramètres de simulation
            </div>

            {/* Qui décède ? */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Qui décède en premier ?
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['mr', 'mme'] as const).map(v => {
                  const active = defunt === v
                  const col = v === 'mr' ? COL_MR : COL_MME
                  return (
                    <button
                      key={v}
                      onClick={() => setDefunt(v)}
                      style={{
                        flex: 1, padding: '12px 0', borderRadius: 10, border: 'none',
                        background: active ? `${col}22` : 'rgba(255,255,255,0.03)',
                        color: active ? col : 'var(--text-muted)',
                        fontWeight: active ? 700 : 400,
                        fontSize: 14, cursor: 'pointer',
                        outline: active ? `2px solid ${col}66` : '2px solid transparent',
                        transition: 'all 0.18s',
                      }}
                    >
                      {v === 'mr' ? '👨 Monsieur décède' : '👩 Madame décède'}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Frais */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
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
              <div style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Frais estimés</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#EF4444', fontFamily: 'var(--font-geist-mono)' }}>
                  {EUR(fraisEuros)}
                </div>
              </div>
            </div>

            {/* Enfants */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Enfants ({enfants.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {enfants.map(e => (
                  <div key={e.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px 4px 12px',
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: 20, fontSize: 13,
                  }}>
                    <span>👶 {e.nom}</span>
                    <button
                      onClick={() => setEnfants(enfants.filter(x => x.id !== e.id))}
                      style={{
                        background: 'none', border: 'none', color: '#EF4444',
                        cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1,
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="glass-input"
                  value={newEnfantNom}
                  onChange={e => setNewEnfantNom(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newEnfantNom.trim()) {
                      setEnfants([...enfants, { id: crypto.randomUUID(), nom: newEnfantNom.trim() }])
                      setNewEnfantNom('')
                    }
                  }}
                  placeholder="Prénom de l'enfant (Entrée pour ajouter)"
                  style={{ fontSize: 12 }}
                />
                <button
                  onClick={() => {
                    if (!newEnfantNom.trim()) return
                    setEnfants([...enfants, { id: crypto.randomUUID(), nom: newEnfantNom.trim() }])
                    setNewEnfantNom('')
                  }}
                  style={{
                    padding: '0 16px', borderRadius: 8, border: 'none',
                    background: 'rgba(16,185,129,0.15)',
                    color: 'var(--accent-emerald)',
                    fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  + Ajouter
                </button>
              </div>
            </div>
          </div>

          {/* Résultats */}
          {masseDefunt === 0 ? (
            <div style={{
              textAlign: 'center', padding: '32px 20px',
              color: 'var(--text-muted)', fontSize: 13,
              border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12,
            }}>
              Saisissez des biens dans l&apos;onglet &quot;Saisie&quot; pour simuler la succession
            </div>
          ) : (
            <>
              {/* Masse successorale */}
              <div className="glass-card" style={{ padding: 22 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                  color: 'var(--accent-amber)', textTransform: 'uppercase', marginBottom: 14,
                }}>
                  ⚖️ Masse successorale — {defunt === 'mr' ? 'Monsieur' : 'Madame'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Patrimoine propre', val: defunt === 'mr' ? totMr : totMme, color: defunt === 'mr' ? COL_MR : COL_MME },
                    { label: '½ du commun',       val: totCommun / 2,  color: COL_COMMUN },
                    { label: 'Actif brut',        val: masseDefunt,    color: 'var(--accent-amber)' },
                  ].map(item => (
                    <div key={item.label} style={{
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: item.color, fontFamily: 'var(--font-geist-mono)' }}>
                        {EUR(item.val)}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px',
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>
                    Frais de succession ({fraisPct}%)
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#EF4444', fontFamily: 'var(--font-geist-mono)' }}>
                    − {EUR(fraisEuros)}
                  </span>
                </div>
                <div style={{
                  marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 14px',
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
                    Actif net successoral
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-geist-mono)' }}>
                    {EUR(actifNet)}
                  </span>
                </div>
              </div>

              {/* Répartition héritiers */}
              <div className="glass-card" style={{ padding: 22 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                  color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: 6,
                }}>
                  👨‍👩‍👧 Dévolution légale (Code civil)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                  {nbEnfants === 0 && 'Sans enfant — conjoint hérite en totalité'}
                  {nbEnfants === 1 && '1 enfant — partage 50/50 avec le conjoint'}
                  {nbEnfants === 2 && '2 enfants — partage en tiers (conjoint + 2 enfants)'}
                  {nbEnfants >= 3 && `${nbEnfants} enfants — conjoint ¼, enfants ¾ à parts égales`}
                </div>

                {parts.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun héritier défini.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {parts.map((p, i) => {
                      const isConjoint = i === 0 && nbEnfants >= 0
                      const col = isConjoint
                        ? (defunt === 'mr' ? COL_MME : COL_MR)
                        : COL_COMMUN
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 16px',
                          background: `${col}0D`,
                          border: `1px solid ${col}33`,
                          borderRadius: 10,
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {isConjoint ? '💍 ' : '👶 '}{p.label}
                            </div>
                            {p.tag && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.tag}</div>
                            )}
                          </div>
                          {/* Barre de progression */}
                          <div style={{ width: 100 }}>
                            <div style={{
                              height: 6, background: 'rgba(255,255,255,0.08)',
                              borderRadius: 3, overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%', width: `${p.pct}%`,
                                background: col, borderRadius: 3,
                                transition: 'width 0.3s',
                              }} />
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', minWidth: 48 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: col }}>
                              {p.pct.toFixed(1)}%
                            </div>
                          </div>
                          <div style={{
                            textAlign: 'right', minWidth: 110,
                            fontFamily: 'var(--font-geist-mono)',
                            fontSize: 15, fontWeight: 800, color: col,
                          }}>
                            {EUR(p.montant)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div style={{
                  marginTop: 16, padding: '10px 14px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6,
                }}>
                  ⚠️ Simulation indicative — dévolution légale sans testament ni donation entre époux (DDE).
                  Les droits de succession ne sont pas calculés ici. Consultez un notaire pour une analyse précise.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
