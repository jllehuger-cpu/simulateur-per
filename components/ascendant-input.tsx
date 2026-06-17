'use client'

import { useState } from 'react'
import type { Ascendant } from '@/lib/types'

// Maps parent lien → the two GP lien values it generates
const GP_CONFIG: Partial<Record<Ascendant['lien'], {
  gpLien: Ascendant['lien']
  gmLien: Ascendant['lien']
  sectionLabel: string
  gpLabel: string
  gmLabel: string
}>> = {
  'pere_client':   {
    gpLien: 'gp_paternel_client',   gmLien: 'gm_paternelle_client',
    sectionLabel: 'Grand-parents paternels du client',
    gpLabel: 'Grand-père paternel du client', gmLabel: 'Grand-mère paternelle du client',
  },
  'mere_client':   {
    gpLien: 'gp_maternel_client',   gmLien: 'gm_maternelle_client',
    sectionLabel: 'Grand-parents maternels du client',
    gpLabel: 'Grand-père maternel du client', gmLabel: 'Grand-mère maternelle du client',
  },
  'pere_conjoint': {
    gpLien: 'gp_paternel_conjoint', gmLien: 'gm_paternelle_conjoint',
    sectionLabel: 'Grand-parents paternels du conjoint',
    gpLabel: 'Grand-père paternel du conjoint', gmLabel: 'Grand-mère paternelle du conjoint',
  },
  'mere_conjoint': {
    gpLien: 'gp_maternel_conjoint', gmLien: 'gm_maternelle_conjoint',
    sectionLabel: 'Grand-parents maternels du conjoint',
    gpLabel: 'Grand-père maternel du conjoint', gmLabel: 'Grand-mère maternelle du conjoint',
  },
}

const LIEN_OPTIONS = [
  { v: 'pere_client',           l: 'Père du client' },
  { v: 'mere_client',           l: 'Mère du client' },
  { v: 'pere_conjoint',         l: 'Père du conjoint' },
  { v: 'mere_conjoint',         l: 'Mère du conjoint' },
  { v: 'pere_adoptif_client',   l: 'Père adoptif du client' },
  { v: 'mere_adoptif_client',   l: 'Mère adoptive du client' },
  { v: 'pere_adoptif_conjoint', l: 'Père adoptif du conjoint' },
  { v: 'mere_adoptif_conjoint', l: 'Mère adoptive du conjoint' },
  { v: 'autre',                 l: 'Autre' },
]

// ── GP sub-card ───────────────────────────────────────────────

interface GpSubCardProps {
  lien: Ascendant['lien']
  label: string
  isGP: boolean
  existing: Ascendant | undefined
  onUpdate: (updates: Partial<Ascendant>) => void
  onRemove: () => void
}

function GpSubCard({ label, isGP, existing, onUpdate, onRemove }: GpSubCardProps) {
  return (
    <div style={{
      padding: '12px 14px',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      background: 'rgba(255,255,255,0.02)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {isGP ? '👴' : '👵'} {label}
        </div>
        {existing && (
          <button
            type="button"
            onClick={onRemove}
            style={{
              padding: '2px 8px', fontSize: 11,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 5, color: '#EF4444', cursor: 'pointer',
            }}
          >
            Retirer
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>Situation</div>
          <select
            className="glass-input"
            value={existing?.situation ?? ''}
            onChange={e => onUpdate({ situation: e.target.value as Ascendant['situation'] })}
          >
            <option value="">— Choisir —</option>
            <option value="vivant">Vivant(e)</option>
            <option value="decede">Décédé(e)</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>Âge</div>
          <input
            className="glass-input"
            type="number"
            value={existing?.age ?? ''}
            onChange={e => onUpdate({ age: parseInt(e.target.value) || undefined })}
            placeholder="ex: 82"
            min={0}
          />
        </div>
        {existing?.situation === 'vivant' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>Patrimoine estimé (€)</div>
            <input
              className="glass-input"
              type="number"
              value={existing?.patrimoine_estime ?? ''}
              onChange={e => onUpdate({ patrimoine_estime: parseFloat(e.target.value) || undefined })}
              placeholder="0"
              style={{ textAlign: 'right' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

interface AscendantInputProps {
  idx: number
  ascendant: Ascendant
  gpAscendants: Ascendant[]
  onChange: (updated: Ascendant) => void
  onGpChange: (gps: Ascendant[]) => void
  onRemove: () => void
}

export function AscendantInput({ idx, ascendant: a, gpAscendants, onChange, onGpChange, onRemove }: AscendantInputProps) {
  const gpConfig = GP_CONFIG[a.lien]
  const [showGP, setShowGP] = useState(() => gpAscendants.length > 0)

  const upd = (k: keyof Ascendant, v: unknown) => onChange({ ...a, [k]: v })

  const gpEntry = gpConfig ? gpAscendants.find(g => g.lien === gpConfig.gpLien) : undefined
  const gmEntry = gpConfig ? gpAscendants.find(g => g.lien === gpConfig.gmLien) : undefined

  const handleGpUpdate = (lien: Ascendant['lien'], updates: Partial<Ascendant>) => {
    const existing = gpAscendants.find(g => g.lien === lien)
    if (existing) {
      onGpChange(gpAscendants.map(g => g.lien === lien ? { ...g, ...updates } : g))
    } else {
      const newGp: Ascendant = {
        id: crypto.randomUUID(), lien,
        situation: updates.situation ?? 'vivant',
        dependant: false, testament_connu: false, donation_consentie: false,
        ...updates,
      }
      onGpChange([...gpAscendants, newGp])
    }
  }

  const handleGpRemove = (lien: Ascendant['lien']) => {
    onGpChange(gpAscendants.filter(g => g.lien !== lien))
  }

  const handleLienChange = (newLien: string) => {
    // Clear GPs when switching away from a GP-capable parent lien
    if (gpAscendants.length > 0 && !GP_CONFIG[newLien as Ascendant['lien']]) {
      onGpChange([])
    }
    onChange({ ...a, lien: newLien as Ascendant['lien'] })
  }

  const lbl = (text: string, hint?: string) => (
    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
      {text}
      {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{hint}</span>}
    </label>
  )

  return (
    <div className="glass-card" style={{ padding: 16, position: 'relative' }}>
      <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, marginBottom: 12 }}>
        Ascendant {idx + 1}
      </div>
      <button
        type="button"
        onClick={onRemove}
        style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 6, color: '#EF4444', cursor: 'pointer', padding: '2px 8px', fontSize: 12,
        }}
      >✕</button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Lien */}
        <div>
          {lbl('Lien')}
          <select
            className="glass-input"
            value={a.lien}
            onChange={e => handleLienChange(e.target.value)}
          >
            <option value="">— Choisir —</option>
            {LIEN_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>

        {/* Type adoption */}
        {a.lien.includes('adoptif') && (
          <div>
            {lbl("Type d'adoption")}
            <select
              className="glass-input"
              value={a.type_adoption ?? ''}
              onChange={e => upd('type_adoption', e.target.value as Ascendant['type_adoption'])}
            >
              <option value="">— Choisir —</option>
              <option value="pleniere">Adoption plénière</option>
              <option value="simple">Adoption simple</option>
            </select>
            {a.type_adoption === 'pleniere' && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Mêmes droits successoraux qu&apos;un enfant biologique</div>
            )}
            {a.type_adoption === 'simple' && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>L&apos;adopté conserve ses droits dans sa famille d&apos;origine</div>
            )}
          </div>
        )}

        {/* Situation */}
        <div>
          {lbl('Situation')}
          <select
            className="glass-input"
            value={a.situation}
            onChange={e => upd('situation', e.target.value as Ascendant['situation'])}
          >
            <option value="vivant">Vivant(e)</option>
            <option value="decede">Décédé(e)</option>
          </select>
        </div>

        {/* Âge */}
        <div>
          {lbl('Âge', 'optionnel')}
          <input
            className="glass-input"
            type="number"
            value={a.age ?? ''}
            onChange={e => upd('age', parseInt(e.target.value) || undefined)}
            placeholder="ex: 78"
            min={0}
          />
        </div>

        {a.situation !== 'decede' && (
          <div>
            {lbl('Patrimoine estimé (€)')}
            <input
              className="glass-input"
              type="number"
              value={a.patrimoine_estime ?? ''}
              onChange={e => upd('patrimoine_estime', parseFloat(e.target.value) || undefined)}
              placeholder="0"
              style={{ textAlign: 'right' }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Utile pour anticiper la succession future</div>
          </div>
        )}

        {a.situation !== 'decede' && (
          <div>
            {lbl('Dépendant (à charge) ?')}
            <select className="glass-input" value={a.dependant ? 'oui' : 'non'}
              onChange={e => upd('dependant', e.target.value === 'oui')}>
              <option value="non">Non</option>
              <option value="oui">Oui</option>
            </select>
          </div>
        )}

        {a.situation !== 'decede' && (
          <div>
            {lbl('Testament connu ?')}
            <select
              className="glass-input"
              value={a.testament_connu === 'inconnu' ? 'inconnu' : a.testament_connu ? 'oui' : 'non'}
              onChange={e => upd('testament_connu', e.target.value === 'oui' ? true : e.target.value === 'non' ? false : 'inconnu')}
            >
              <option value="non">Non</option>
              <option value="oui">Oui</option>
              <option value="inconnu">Je ne sais pas</option>
            </select>
          </div>
        )}

        {a.situation !== 'decede' && (
          <div>
            {lbl('Donation consentie à vous ?')}
            <select className="glass-input" value={a.donation_consentie ? 'oui' : 'non'}
              onChange={e => upd('donation_consentie', e.target.value === 'oui')}>
              <option value="non">Non</option>
              <option value="oui">Oui</option>
            </select>
          </div>
        )}

        {a.situation !== 'decede' && (
          <div>
            {lbl('Mandat de protection future')}
            <select
              className="glass-input"
              value={a.mandat_protection_future ?? ''}
              onChange={e => upd('mandat_protection_future', e.target.value as Ascendant['mandat_protection_future'])}
            >
              <option value="">— Choisir —</option>
              <option value="oui">Oui — en place</option>
              <option value="non">Non</option>
              <option value="a_faire">À mettre en place</option>
              <option value="en_cours">En cours de réalisation</option>
            </select>
          </div>
        )}

        {a.situation !== 'decede' && a.mandat_protection_future === 'oui' && (
          <div>
            {lbl('Ce mandat est-il authentique (notarié) ?')}
            <select
              className="glass-input"
              value={a.mpf_authentique ?? ''}
              onChange={e => upd('mpf_authentique', e.target.value as Ascendant['mpf_authentique'])}
            >
              <option value="">— Choisir —</option>
              <option value="oui">Oui (authentique — notarié)</option>
              <option value="non">Non (sous seing privé)</option>
              <option value="inconnu">Je ne sais pas</option>
            </select>
          </div>
        )}
      </div>

      {a.situation === 'vivant' && (a.age ?? 0) > 70 &&
        (a.mandat_protection_future === 'non' || a.mandat_protection_future === 'a_faire') && (
        <div style={{
          marginTop: 10, fontSize: 11, color: '#F59E0B', lineHeight: 1.5,
          padding: '8px 12px', background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8,
        }}>
          ⚠️ Recommandé : le mandat de protection future permet de désigner à l&apos;avance un mandataire en cas de perte d&apos;autonomie.
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {lbl('Notes')}
        <textarea
          className="glass-input"
          rows={2}
          value={a.notes ?? ''}
          onChange={e => upd('notes', e.target.value)}
          style={{ resize: 'vertical', lineHeight: 1.5, fontSize: 12 }}
        />
      </div>

      {/* ── Section grand-parents (parent vivant seulement) ── */}
      {a.situation === 'vivant' && gpConfig && (
        <div style={{
          marginTop: 14, padding: '12px 14px',
          background: 'rgba(16,185,129,0.04)',
          border: '1px solid rgba(16,185,129,0.18)',
          borderRadius: 10,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: showGP ? 14 : 0 }}>
            <input
              type="checkbox"
              checked={showGP}
              onChange={e => setShowGP(e.target.checked)}
              style={{ cursor: 'pointer', width: 15, height: 15, accentColor: '#10B981', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#34D399' }}>
              Renseigner les {gpConfig.sectionLabel.toLowerCase()}
            </span>
          </label>

          {showGP && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <GpSubCard
                lien={gpConfig.gpLien}
                label={gpConfig.gpLabel}
                isGP={true}
                existing={gpEntry}
                onUpdate={updates => handleGpUpdate(gpConfig.gpLien, updates)}
                onRemove={() => handleGpRemove(gpConfig.gpLien)}
              />
              <GpSubCard
                lien={gpConfig.gmLien}
                label={gpConfig.gmLabel}
                isGP={false}
                existing={gmEntry}
                onUpdate={updates => handleGpUpdate(gpConfig.gmLien, updates)}
                onRemove={() => handleGpRemove(gpConfig.gmLien)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
