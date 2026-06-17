'use client'

import { useState, useMemo } from 'react'
import type { DossierPatrimonial, RegimeMatrimonial } from '@/lib/types'
import { analyserSuccession, REGIME_LABELS, REGIME_IMPACT } from '@/lib/calcul-succession'

interface Props {
  dossier: DossierPatrimonial
}

const FMT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const fmt = (n: number) => FMT.format(n)

const LIEN_ICON: Record<string, string> = {
  enfant: '🧒', conjoint: '💑', parent: '👴', frere_soeur: '🤝',
}

const REGIMES: RegimeMatrimonial[] = [
  'communaute_reduite_acquets', 'communaute_universelle', 'communaute_meubles_acquets',
  'separation_biens', 'participation_acquets',
  'pacs_separation_biens', 'pacs_indivision', 'sans_regime',
]

export function AnalyseSuccessionInteractive({ dossier }: Props) {
  const id = dossier.identite

  // Patrimoine brut calculé depuis le dossier
  const patrimoineDossier = useMemo(() => {
    const immo = dossier.biens_immo.reduce((s, b) => s + (b.valeur_venale ?? 0), 0)
    const fin  = dossier.produits_financiers.reduce((s, p) => s + (p.valeur_actuelle ?? 0), 0)
    return immo + fin
  }, [dossier])

  const [cible, setCible]       = useState<'client' | 'conjoint'>('client')
  const [regime, setRegime]     = useState<RegimeMatrimonial>(id.regime_matrimonial ?? 'communaute_reduite_acquets')
  const [masse, setMasse]       = useState(patrimoineDossier || 500000)
  const [optUsufruit, setOptUsufruit] = useState(false)
  const [showRegimeInfo, setShowRegimeInfo] = useState(false)

  const aConjoint = ['marie', 'pacse', 'concubin'].includes(id.situation_familiale ?? '')

  // Dossier synthétique avec le régime sélectionné dans l'UI (peut différer du dossier)
  const dossierSim = useMemo(() => ({
    ...dossier,
    identite: { ...id, regime_matrimonial: regime },
  }), [dossier, id, regime])

  const analyse = useMemo(
    () => analyserSuccession(dossierSim, cible, masse),
    [dossierSim, cible, masse],
  )

  const partUsedKey = optUsufruit && analyse.optionUsufruit ? 'partUsufruit' : 'partPP'
  const partKey     = partUsedKey as 'partPP' | 'partUsufruit'

  const totalPct = analyse.heritiers.reduce((s, h) => s + h[partKey], 0)

  const card = (style?: React.CSSProperties) => ({
    padding: '1rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    ...style,
  } as React.CSSProperties)

  return (
    <div style={{ marginTop: '2rem' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '1.25rem' }}>⚖️</span>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Analyse de succession</h2>
        <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 6, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
          Droit français
        </span>
      </div>

      {/* Contrôles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {/* Cible */}
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Personne décédée
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['client', ...(aConjoint ? ['conjoint'] : [])] as ('client' | 'conjoint')[]).map(v => (
              <button key={v} onClick={() => { setCible(v); setOptUsufruit(false) }}
                style={{
                  flex: 1, padding: '0.5rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  border: '1px solid',
                  borderColor: cible === v ? '#6366f1' : 'rgba(255,255,255,0.12)',
                  background: cible === v ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                  color: cible === v ? '#c4b5fd' : 'var(--text-secondary)',
                }}>
                {v === 'client' ? `Client (${id.age_client ?? '?'}a)` : `Conjoint (${id.age_conjoint ?? '?'}a)`}
              </button>
            ))}
          </div>
        </div>

        {/* Régime */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Régime matrimonial</span>
            <button onClick={() => setShowRegimeInfo(v => !v)}
              style={{ fontSize: '0.7rem', background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: 0 }}>
              {showRegimeInfo ? 'Masquer' : 'Détails'}
            </button>
          </div>
          <select value={regime} onChange={e => setRegime(e.target.value as RegimeMatrimonial)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
            {REGIMES.map(r => (
              <option key={r} value={r}>{REGIME_LABELS[r]}</option>
            ))}
          </select>
        </div>

        {/* Patrimoine */}
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Patrimoine brut estimé
          </div>
          <input type="number" value={masse} onChange={e => setMasse(Math.max(0, Number(e.target.value)))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.8rem', boxSizing: 'border-box' }} />
          {patrimoineDossier > 0 && masse !== patrimoineDossier && (
            <button onClick={() => setMasse(patrimoineDossier)}
              style={{ marginTop: 4, fontSize: '0.7rem', background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: 0 }}>
              Revenir au dossier ({fmt(patrimoineDossier)})
            </button>
          )}
        </div>
      </div>

      {/* Détail régime */}
      {showRegimeInfo && (
        <div style={{ ...card({ marginBottom: '1.25rem', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }) }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#a5b4fc', marginBottom: '0.35rem' }}>{REGIME_LABELS[regime]}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{REGIME_IMPACT[regime]}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Masse successorale après liquidation : <strong style={{ color: '#c4b5fd' }}>{fmt(analyse.masseSuccessorale)}</strong>
            {analyse.masseSuccessorale < masse && ` (${fmt(masse - analyse.masseSuccessorale)} revient au conjoint hors succession)`}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={card({ textAlign: 'center', borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.06)' })}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Réserve héréditaire</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f87171' }}>{analyse.reserve.toFixed(1)} %</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmt(analyse.masseSuccessorale * analyse.reserve / 100)}</div>
        </div>
        <div style={card({ textAlign: 'center', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.06)' })}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quotité disponible</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#34d399' }}>{analyse.quotiteDisponible.toFixed(1)} %</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmt(analyse.masseSuccessorale * analyse.quotiteDisponible / 100)}</div>
        </div>
        <div style={card({ textAlign: 'center' })}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Héritiers légaux</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{analyse.heritiers.length}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>selon la loi</div>
        </div>
      </div>

      {/* Option usufruit */}
      {analyse.optionUsufruit && (
        <div style={{ ...card({ marginBottom: '1.25rem', borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }) }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24', marginBottom: '0.2rem' }}>Option usufruit disponible</div>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
              Le conjoint peut choisir entre ¼ PP ou 100% usufruit (enfants communs uniquement).
            </div>
          </div>
          <button onClick={() => setOptUsufruit(v => !v)}
            style={{
              flexShrink: 0, marginLeft: '1rem', padding: '0.4rem 0.8rem', borderRadius: 8,
              border: `1px solid ${optUsufruit ? '#fbbf24' : 'rgba(255,255,255,0.15)'}`,
              background: optUsufruit ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
              color: optUsufruit ? '#fbbf24' : 'var(--text-muted)',
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            }}>
            {optUsufruit ? 'Usufruit ✓' : 'Pleine propriété'}
          </button>
        </div>
      )}

      {/* Tableau héritiers */}
      {analyse.heritiers.length > 0 ? (
        <div style={{ ...card({ padding: 0, overflow: 'hidden', marginBottom: '1.25rem' }) }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Héritier</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Part</th>
                <th style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Montant</th>
                <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'table-cell' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {analyse.heritiers.map((h, i) => {
                const part = h[partKey]
                const barW = Math.round((part / Math.max(totalPct, 100)) * 100)
                return (
                  <tr key={h.id} style={{ borderBottom: i < analyse.heritiers.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ marginRight: '0.4rem' }}>{LIEN_ICON[h.lien]}</span>
                      <span style={{ fontWeight: 600 }}>{h.label}</span>
                    </td>
                    <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <div style={{ width: 48, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ width: `${barW}%`, height: '100%', borderRadius: 3, background: h.lien === 'conjoint' ? '#fbbf24' : h.lien === 'enfant' ? '#34d399' : '#93c5fd' }} />
                        </div>
                        <span style={{ fontWeight: 700, minWidth: '3.5rem', textAlign: 'right' }}>{part.toFixed(2)} %</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                      {fmt(Math.round(analyse.masseSuccessorale * part / 100))}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                      {h.notes.join(' · ')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ ...card({ marginBottom: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }) }}>
          Aucun héritier identifié avec les données actuelles.
        </div>
      )}

      {/* Alertes */}
      {analyse.alertes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {analyse.alertes.map((a, i) => (
            <div key={i} style={{ padding: '0.65rem 1rem', borderRadius: 8, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)', fontSize: '0.8rem', color: '#fbbf24', display: 'flex', gap: '0.5rem' }}>
              <span style={{ flexShrink: 0 }}>⚠️</span>
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* Note légale */}
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
        Analyse indicative basée sur la dévolution légale (Code civil). Ne tient pas compte des donations antérieures, testaments, abattements fiscaux, ni de la réduction des libéralités. Consultez un notaire pour tout acte.
      </div>
    </div>
  )
}
