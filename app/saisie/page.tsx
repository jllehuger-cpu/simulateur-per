'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DossierPatrimonial, Enfant, BienImmo, ProduitFinancier, LignePorfolio,
  SituationFamiliale, StatutPro, ProfilRisque, Horizon, FraisContrat, Ascendant, FrereSoeur
} from '@/lib/types'
import {
  nouveauDossier, getDossier, sauvegarderDossier,
  normaliserPourPrompt, exporterDossierJSON
} from '@/lib/dossiers'
import { UnlockGate } from '@/components/unlock-gate'
import { ImportDocument } from '@/components/import-document'
import { useAuth } from '@/lib/use-auth'
import ArbreGenealogie from '@/components/arbre-genealogique'
import { identiteDisponible } from '@/lib/crypto'
import { sauvegarderIdentite, lireIdentite, IdentiteProspect } from '@/lib/db-identite'
import { useIdentiteVisible, masquerTexte } from '@/lib/use-identite-visible'

// ─── Constantes listes ──────────────────────────────────────
const SITUATIONS: { v: SituationFamiliale; l: string }[] = [
  { v: 'celibataire',                    l: 'Célibataire' },
  { v: 'marie',                          l: 'Marié(e)' },
  { v: 'pacse',                          l: 'Pacsé(e)' },
  { v: 'concubin',                        l: 'Concubin(e)' },
  { v: 'divorce',                        l: 'Divorcé(e)' },
  { v: 'veuf',                           l: 'Veuf / Veuve' },
]
const REGIMES_MARIAGE = [
  { v: 'communaute_reduite_acquets',  l: 'Communauté réduite aux acquêts' },
  { v: 'communaute_universelle',      l: 'Communauté universelle' },
  { v: 'communaute_meubles_acquets',  l: 'Communauté de meubles et acquêts (avant 1966)' },
  { v: 'separation_biens',            l: 'Séparation de biens' },
  { v: 'participation_acquets',       l: 'Participation aux acquêts' },
]
const REGIMES_PACS = [
  { v: 'pacs_separation_biens', l: 'Séparation de biens (régime légal depuis 2007)' },
  { v: 'pacs_indivision',       l: 'Indivision (convention spécifique)' },
]
const STATUTS: { v: StatutPro; l: string }[] = [
  { v: 'salarie_cadre',     l: 'Salarié cadre' },
  { v: 'salarie_non_cadre', l: 'Salarié non-cadre' },
  { v: 'tns',               l: 'TNS (indépendant)' },
  { v: 'fonctionnaire',     l: 'Fonctionnaire' },
  { v: 'retraite',          l: 'Retraité(e)' },
  { v: 'sans_emploi',       l: 'Sans emploi' },
]
const OBJECTIFS_LIST = [
  'Préparer la retraite',
  'Réduire la fiscalité',
  'Transmettre le patrimoine',
  'Protéger le conjoint',
  'Développer le patrimoine',
  "Financer les études des enfants",
  'Acquérir la résidence principale',
  "Investir dans l'immobilier locatif",
]
const TYPES_IMMO = ['Résidence principale','Locatif nu','LMNP','Résidence secondaire','Terrain','Parts SCPI']
const TYPES_PRODUIT = [
  'Assurance-Vie', 'Contrat de capitalisation',
  'PEA', 'Compte-Titres', 'PER',
  'Livret A', 'LDDS', 'PEL', 'CEL',
  'Épargne salariale', 'Autre',
]
const CATEGORIES_LIGNES = [
  'Fonds euros', 'Actions-ETF', 'Obligations',
  'SCPI', 'Produit structuré', 'Private Equity', 'Autre',
]
const PRODUITS_AVEC_PORTEFEUILLE = [
  'Assurance-Vie', 'Contrat de capitalisation', 'PEA', 'Compte-Titres', 'PER',
]
const FRAIS_CONFIG: Record<string, {
  label: string
  fields: { key: keyof FraisContrat; label: string; note: string }[]
}> = {
  'Assurance-Vie': {
    label: 'Frais du contrat',
    fields: [
      { key: 'frais_entree_pct',       label: "Frais d'entrée (%)",              note: 'Prélevés sur chaque versement. Négociables — souvent 0 à 5%' },
      { key: 'frais_gestion_uc_pct',   label: 'Frais de gestion UC (% / an)',    note: 'Prélevés annuellement sur les unités de compte. Souvent 0,6 à 1%' },
      { key: 'frais_gestion_euro_pct', label: 'Frais de gestion fonds € (% / an)', note: 'Déjà déduits du taux servi. Souvent 0,5 à 0,8%' },
      { key: 'frais_arbitrage_pct',    label: "Frais d'arbitrage (%)",           note: 'Prélevés à chaque réallocation. Souvent 0 à 1%' },
    ]
  },
  'Contrat de capitalisation': {
    label: 'Frais du contrat',
    fields: [
      { key: 'frais_entree_pct',       label: "Frais d'entrée (%)",              note: '' },
      { key: 'frais_gestion_uc_pct',   label: 'Frais de gestion UC (% / an)',    note: '' },
      { key: 'frais_gestion_euro_pct', label: 'Frais de gestion fonds € (% / an)', note: '' },
      { key: 'frais_arbitrage_pct',    label: "Frais d'arbitrage (%)",           note: '' },
    ]
  },
  'PEA': {
    label: 'Frais du PEA',
    fields: [
      { key: 'frais_courtage_pct',   label: 'Frais de courtage (% / ordre)', note: 'Prélevés à chaque achat/vente. En ligne : 0,1 à 0,5%' },
      { key: 'droits_garde_annuels', label: 'Droits de garde (€ / an)',      note: 'Certains courtiers en ligne : 0€. Banques classiques : 50 à 200€/an' },
    ]
  },
  'Compte-Titres': {
    label: 'Frais du compte-titres',
    fields: [
      { key: 'frais_courtage_pct',   label: 'Frais de courtage (% / ordre)', note: '' },
      { key: 'droits_garde_annuels', label: 'Droits de garde (€ / an)',      note: '' },
    ]
  },
  'PER': {
    label: 'Frais du PER',
    fields: [
      { key: 'frais_entree_per_pct',    label: "Frais d'entrée (%)",           note: 'Sur chaque versement. Négociables — viser 0%' },
      { key: 'frais_gestion_per_pct',   label: 'Frais de gestion (% / an)',    note: "Sur l'encours. Comparer : 0,5% en ligne vs 1% en banque classique" },
      { key: 'frais_arreage_rente_pct', label: "Frais d'arrérage si rente (%)", note: 'Prélevés sur chaque versement de rente. Souvent 1 à 3%' },
    ]
  },
}
const STEPS = [
  { id: 1, label: 'Identité',   icon: '👤' },
  { id: 2, label: 'Famille',    icon: '👨‍👩‍👧' },
  { id: 3, label: 'Revenus',    icon: '💰' },
  { id: 4, label: 'Immobilier', icon: '🏢' },
  { id: 5, label: 'Financier',  icon: '📈' },
  { id: 6, label: 'Prévoyance', icon: '🛡️' },
  { id: 7, label: 'Objectifs',  icon: '🎯' },
]

// ─── Helpers UI ─────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
        {label}
        {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function FieldNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45, marginTop: 2 }}>
      {children}
    </div>
  )
}

function Warn({ children, color = '#F59E0B' }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 11, color, lineHeight: 1.4, marginTop: 3, display: 'flex', gap: 4 }}>
      <span>⚠️</span><span>{children}</span>
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder, min, max, step }: {
  value: string | number; onChange: (v: string) => void
  type?: string; placeholder?: string; min?: number; max?: number; step?: number
}) {
  return (
    <input
      className="glass-input"
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min} max={max} step={step}
    />
  )
}

function Select({ value, onChange, options, disabled }: {
  value: string; onChange: (v: string) => void
  options: { v: string; l: string }[]; disabled?: boolean
}) {
  return (
    <select
      className="glass-input"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1 }}
    >
      <option value="">— Choisir —</option>
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  )
}

function Grid({ cols = 2, children, style }: { cols?: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, ...style }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
      color: 'var(--accent-blue)', textTransform: 'uppercase',
      borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8, marginBottom: 4
    }}>
      {children}
    </div>
  )
}

function ColHeaders({ left = 'Client', right = 'Conjoint' }: { left?: string; right?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: -4 }}>
      <div style={{ fontSize: 11, color: 'var(--accent-gold)', fontWeight: 600, textAlign: 'center' }}>{left}</div>
      <div style={{ fontSize: 11, color: 'var(--accent-indigo)', fontWeight: 600, textAlign: 'center' }}>{right}</div>
    </div>
  )
}

// NumInput avec séparateur de milliers + prop disabled
function NumInput({ value, onChange, placeholder, disabled }: {
  value: number | undefined; onChange: (v: number) => void
  placeholder?: string; disabled?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const formatted = (value != null && value !== 0) ? value.toLocaleString('fr-FR') : ''
  return (
    <input
      className="glass-input"
      type={focused ? 'number' : 'text'}
      inputMode="numeric"
      disabled={disabled}
      value={focused ? (value || '') : formatted}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      placeholder={placeholder ?? '0'}
      style={{ textAlign: 'right', opacity: disabled ? 0.35 : 1 }}
    />
  )
}

// ─── ÉTAPE 1 : IDENTITÉ ─────────────────────────────────────
function StepIdentite({ d, setD,
  identiteNom, setIdentiteNom, identitePrenom, setIdentitePrenom,
  identiteTel, setIdentiteTel, identiteEmail, setIdentiteEmail,
  identiteNomConjoint, setIdentiteNomConjoint,
  identitePrenomConjoint, setIdentitePrenomConjoint,
  identiteTelConjoint, setIdentiteTelConjoint,
  identiteEmailConjoint, setIdentiteEmailConjoint,
}: {
  d: DossierPatrimonial
  setD: (d: DossierPatrimonial) => void
  identiteNom: string
  setIdentiteNom: (v: string) => void
  identitePrenom: string
  setIdentitePrenom: (v: string) => void
  identiteTel: string
  setIdentiteTel: (v: string) => void
  identiteEmail: string
  setIdentiteEmail: (v: string) => void
  identiteNomConjoint: string
  setIdentiteNomConjoint: (v: string) => void
  identitePrenomConjoint: string
  setIdentitePrenomConjoint: (v: string) => void
  identiteTelConjoint: string
  setIdentiteTelConjoint: (v: string) => void
  identiteEmailConjoint: string
  setIdentiteEmailConjoint: (v: string) => void
}) {
  const { visible: identiteVisible } = useIdentiteVisible()
  const upd = (k: string, v: unknown) => setD({ ...d, identite: { ...d.identite, [k]: v } })
  const i = d.identite
  const sf = (i.situation_familiale ?? '') as string
  const hasConjoint = sf === 'marie' || sf === 'pacse' || sf === 'concubin'
  const contratMariage = i.contrat_mariage ?? 'non'

  const setContratMariage = (val: string) => {
    setD({
      ...d,
      identite: {
        ...d.identite,
        contrat_mariage: val,
        ...(val === 'non' ? { regime_matrimonial: 'communaute_reduite_acquets' } : {}),
      } as DossierPatrimonial['identite'],
    })
  }

  const [rpFeedback, setRpFeedback] = useState(false)

  const handleProprietaireChange = (val: string) => {
    if (val === 'proprio') {
      const hasRP = d.biens_immo.some(b => b.type === 'Résidence principale')
      if (!hasRP) {
        const bienRP: BienImmo = {
          id: 'rp-' + crypto.randomUUID(),
          type: 'Résidence principale',
          localisation: '',
          detenu_par: hasConjoint ? 'Joint' : 'Client',
          mode_propriete: 'Pleine propriété',
          quote_part: 100,
          valeur_venale: 0, prix_acquisition: 0, annee_acquisition: 0,
          crd: 0, mensualite: 0, duree_restante_mois: 0, taux: 0,
          assurance_emprunteur: 0, loyer_mensuel_brut: 0, taux_occupation: 100,
          charges_annuelles: 0, regime_fiscal: 'Résidence principale',
          dispositif_fiscal: 'Aucun',
          notes: "Pré-rempli depuis l'étape Identité — à compléter",
        }
        setD({ ...d, identite: { ...d.identite, proprietaire_rp: true }, biens_immo: [...d.biens_immo, bienRP] })
        setRpFeedback(true)
        setTimeout(() => setRpFeedback(false), 4000)
      } else {
        upd('proprietaire_rp', true)
      }
    } else {
      const biens = d.biens_immo.filter(b => !(b.id.startsWith('rp-') && b.valeur_venale === 0))
      setD({ ...d, identite: { ...d.identite, proprietaire_rp: false }, biens_immo: biens })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ══ DONNÉES PERSONNELLES (Clé B) ══ */}
      {identiteDisponible() ? (
        <>
          <SectionTitle>Données personnelles</SectionTitle>
          <div style={{
            background: 'rgba(127,119,221,0.06)',
            border: '1px solid rgba(127,119,221,0.2)',
            borderRadius: 12, padding: '6px 14px', marginBottom: 4,
            fontSize: 11, color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>🔐</span>
            <span>Chiffrées avec votre clé identité — jamais visibles sur le serveur</span>
          </div>
          <Grid cols={2}>
            <Field label="Prénom">
              <Input value={identitePrenom} onChange={v => setIdentitePrenom(v)} placeholder="Jean" />
            </Field>
            <Field label="Nom">
              <Input value={identiteNom} onChange={v => setIdentiteNom(v)} placeholder="Dupont" />
            </Field>
          </Grid>
          <Grid cols={2}>
            <Field label="Téléphone" hint="optionnel">
              <Input value={identiteTel} onChange={v => setIdentiteTel(v)} placeholder="06 12 34 56 78" />
            </Field>
            <Field label="Email" hint="optionnel">
              <Input value={identiteEmail} onChange={v => setIdentiteEmail(v)} placeholder="jean.dupont@email.fr" />
            </Field>
          </Grid>

          {/* ── Conjoint (affiché si marié/pacsé/concubin) ── */}
          {hasConjoint && (
            <>
              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: 14, marginTop: 6,
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: '#67E8F9',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
                }}>
                  Conjoint
                </div>
              </div>
              <Grid cols={2}>
                <Field label="Prénom conjoint">
                  <Input value={identitePrenomConjoint} onChange={v => setIdentitePrenomConjoint(v)} placeholder="Marie" />
                </Field>
                <Field label="Nom conjoint">
                  <Input value={identiteNomConjoint} onChange={v => setIdentiteNomConjoint(v)} placeholder="Dupont" />
                </Field>
              </Grid>
              <Grid cols={2}>
                <Field label="Téléphone conjoint" hint="optionnel">
                  <Input value={identiteTelConjoint} onChange={v => setIdentiteTelConjoint(v)} placeholder="06 98 76 54 32" />
                </Field>
                <Field label="Email conjoint" hint="optionnel">
                  <Input value={identiteEmailConjoint} onChange={v => setIdentiteEmailConjoint(v)} placeholder="marie.dupont@email.fr" />
                </Field>
              </Grid>
            </>
          )}
        </>
      ) : (
        <>
          <SectionTitle>Données personnelles</SectionTitle>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px dashed rgba(255,255,255,0.15)',
            borderRadius: 12, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 20, opacity: 0.5 }}>🔒</span>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                Clé identité non active
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
                Pour saisir le nom, prénom, téléphone et email du client,
                activez la clé identité (Clé B) lors du déverrouillage.
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══ ALIAS DOSSIER ══ */}
      <SectionTitle>Alias dossier</SectionTitle>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)',
        borderRadius: 10, padding: '12px 16px'
      }}>
        <span style={{ fontSize: 22 }}>🔒</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-gold)', letterSpacing: '0.05em' }}>
            {d.alias}
            {identiteDisponible() && identiteNom.trim() && identitePrenom.trim() && (
              <span style={{
                marginLeft: 10, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400,
                fontFamily: identiteVisible ? 'inherit' : 'var(--font-mono, monospace)',
                letterSpacing: identiteVisible ? 'normal' : '0.05em',
              }}>
                · {masquerTexte(identitePrenom.trim(), identiteVisible)} {masquerTexte(identiteNom.trim().toUpperCase(), identiteVisible)}
                {identitePrenomConjoint.trim() && identiteNomConjoint.trim() && (
                  <span> &amp; {masquerTexte(identitePrenomConjoint.trim(), identiteVisible)} {masquerTexte(identiteNomConjoint.trim().toUpperCase(), identiteVisible)}</span>
                )}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Identifiant anonyme — aucun nom réel stocké sur ce serveur
          </div>
        </div>
      </div>

      <SectionTitle>Situation personnelle</SectionTitle>
      <ColHeaders />
      <Grid cols={2}>
        <Field label="Âge">
          <NumInput value={i.age_client} onChange={v => upd('age_client', v)} placeholder="ex: 45" />
        </Field>
        <Field label="Âge conjoint">
          <NumInput
            value={i.age_conjoint}
            onChange={v => upd('age_conjoint', v)}
            placeholder={hasConjoint ? 'ex: 43' : 'Sans objet'}
            disabled={!hasConjoint}
          />
        </Field>
      </Grid>

      <Field label="Situation familiale">
        <Select value={i.situation_familiale ?? ''} onChange={v => upd('situation_familiale', v)} options={SITUATIONS} />
      </Field>

      {sf === 'marie' && (
        <>
          <Field label="Contrat de mariage ?">
            <Select value={contratMariage} onChange={setContratMariage}
              options={[
                { v: 'non', l: 'Non — régime légal' },
                { v: 'oui', l: 'Oui — avec contrat notarié' },
              ]} />
          </Field>
          {contratMariage === 'oui' ? (
            <Field label="Régime matrimonial">
              <Select value={i.regime_matrimonial ?? ''}
                onChange={v => upd('regime_matrimonial', v)} options={REGIMES_MARIAGE} />
            </Field>
          ) : (
            <div style={{
              background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
              borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)'
            }}>
              Régime légal : <strong style={{ color: 'var(--text-primary)' }}>Communauté réduite aux acquêts</strong>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Les biens acquis pendant le mariage sont communs. Les biens propres (acquis avant ou par succession/donation) restent individuels.
              </div>
            </div>
          )}
          <Field label="Date du mariage">
            <Input type="date" value={i.date_union ?? ''} onChange={v => upd('date_union', v)} />
            <FieldNote>Important pour déterminer si les biens acquis avant/après cette date sont communs ou propres.</FieldNote>
          </Field>
        </>
      )}

      {sf === 'pacse' && (
        <>
          <Field label="Régime PACS">
            <Select value={i.regime_matrimonial ?? ''}
              onChange={v => upd('regime_matrimonial', v)} options={REGIMES_PACS} />
          </Field>
          <Field label="Date du PACS">
            <Input type="date" value={i.date_union ?? ''} onChange={v => upd('date_union', v)} />
            <FieldNote>Important pour déterminer si les biens acquis avant/après cette date sont communs ou propres.</FieldNote>
          </Field>
        </>
      )}

      {sf === 'concubin' && (
        <div style={{
          background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6
        }}>
          Concubinage : aucun régime matrimonial.<br/>
          Les biens sont strictement séparés — seule l&apos;indivision éventuelle sur les biens achetés ensemble s&apos;applique.
        </div>
      )}

      <SectionTitle>Situation professionnelle</SectionTitle>
      <ColHeaders />
      <Grid cols={2}>
        <Field label="Statut client">
          <Select value={i.statut_pro_client ?? ''} onChange={v => upd('statut_pro_client', v)} options={STATUTS} />
        </Field>
        <Field label="Statut conjoint">
          <Select
            value={i.statut_pro_conjoint ?? ''}
            onChange={v => upd('statut_pro_conjoint', v)}
            options={STATUTS}
            disabled={!hasConjoint}
          />
        </Field>
      </Grid>

      <Grid cols={2}>
        <Field label="Département">
          <Input value={i.departement ?? ''} onChange={v => upd('departement', v)} placeholder="ex: 75" />
        </Field>
        <Field label="Résidence principale">
          <Select
            value={i.proprietaire_rp !== undefined ? (i.proprietaire_rp ? 'proprio' : 'locataire') : ''}
            onChange={handleProprietaireChange}
            options={[{ v: 'proprio', l: 'Propriétaire' }, { v: 'locataire', l: 'Locataire' }]}
          />
        </Field>
      </Grid>

      {rpFeedback && (
        <div style={{ fontSize: 11, color: 'var(--accent-emerald)', fontStyle: 'italic', marginTop: -8 }}>
          ✓ Résidence principale ajoutée dans l&apos;onglet Immobilier — pensez à la compléter (valeur, crédit...)
        </div>
      )}

      {i.proprietaire_rp === false && (
        <Field label="Loyer mensuel (€)">
          <NumInput value={i.loyer_mensuel} onChange={v => upd('loyer_mensuel', v)} />
        </Field>
      )}

      <SectionTitle>Dispositions civiles</SectionTitle>

      <Field label="Testament rédigé ?">
        <Select value={i.testament ?? ''} onChange={v => upd('testament', v)}
          options={[{ v: 'oui', l: 'Oui' }, { v: 'non', l: 'Non' }, { v: 'en_cours', l: 'En cours' }]} />
      </Field>

      {i.testament === 'oui' && (
        <Field label="Type de testament">
          <Select value={i.type_testament ?? ''} onChange={v => upd('type_testament', v)}
            options={[
              { v: 'olographe',   l: 'Olographe (manuscrit)' },
              { v: 'authentique', l: 'Authentique (notarié)' },
              { v: 'mystique',    l: 'Mystique (scellé)' },
            ]} />
        </Field>
      )}

      {sf === 'marie' && (
        <Field label="Donation entre époux (DDE) ?">
          <Select value={i.dde ?? ''} onChange={v => upd('dde', v)}
            options={[
              { v: 'oui', l: 'Oui — acte notarié en place' },
              { v: 'non', l: 'Non' },
            ]} />
          <FieldNote>
            Permet au conjoint survivant de recevoir davantage que sa part légale. Réservé aux couples mariés.
          </FieldNote>
        </Field>
      )}
    </div>
  )
}

// ─── ÉTAPE 2 : FAMILLE ──────────────────────────────────────
function situationOpts(age: number): { v: Enfant['situation']; l: string }[] {
  if (age <= 18) return [
    { v: 'mineur', l: 'Mineur' },
    { v: 'etudiant', l: 'Étudiant' },
  ]
  return [
    { v: 'etudiant', l: 'Étudiant' },
    { v: 'actif', l: 'Actif' },
    { v: 'marie', l: 'Marié' },
  ]
}

function StepFamille({ d, setD }: { d: DossierPatrimonial; setD: (d: DossierPatrimonial) => void }) {
  const [showArbre, setShowArbre] = useState(false)
  const enfants = d.identite.enfants ?? []
  const ascendants = d.identite.ascendants ?? []
  const gaIds = d.identite.enfants_garde_alternee ?? []
  const extra = d.identite as Record<string, unknown>
  const getE = (k: string): string => (extra[k] as string) ?? ''
  const setE = (k: string, v: string) =>
    setD({ ...d, identite: { ...d.identite, [k]: v } as DossierPatrimonial['identite'] })

  const sfFamille = (d.identite.situation_familiale ?? '') as string
  const hasConjFamille = sfFamille === 'marie' || sfFamille === 'pacse' || sfFamille === 'concubin'

  // Bug 1 : normaliser le lien quand la situation bascule vers sans-conjoint
  useEffect(() => {
    if (!hasConjFamille && enfants.some(e => e.lien !== 'client_seul')) {
      setD({ ...d, identite: { ...d.identite, enfants: enfants.map(e => ({ ...e, lien: 'client_seul' as Enfant['lien'] })) } })
    }
  }, [hasConjFamille]) // eslint-disable-line react-hooks/exhaustive-deps

  const addEnfant = () => {
    const lienDefaut: Enfant['lien'] = hasConjFamille ? 'commun' : 'client_seul'
    const e: Enfant = { id: crypto.randomUUID(), age: 0, lien: lienDefaut, situation: 'mineur', rattachement_fiscal: 'foyer_client' }
    setD({ ...d, identite: { ...d.identite, enfants: [...enfants, e] } })
  }
  const updEnfant = (id: string, k: keyof Enfant, v: unknown) =>
    setD({ ...d, identite: { ...d.identite, enfants: enfants.map(e => e.id === id ? { ...e, [k]: v } : e) } })
  const updEnfantAge = (id: string, age: number) => {
    setD({ ...d, identite: { ...d.identite, enfants: enfants.map(e => {
      if (e.id !== id) return e
      const situation = age > 18 && e.situation === 'mineur' ? 'etudiant' : e.situation
      return { ...e, age, situation }
    })}})
  }
  const delEnfant = (id: string) =>
    setD({ ...d, identite: { ...d.identite, enfants: enfants.filter(e => e.id !== id) } })

  const toggleGA = (id: string, ga: boolean) => {
    const cur = d.identite.enfants_garde_alternee ?? []
    const next = ga ? [...cur, id] : cur.filter(x => x !== id)
    setD({ ...d, identite: { ...d.identite, enfants_garde_alternee: next } })
  }

  const freresSoeurs = d.identite.freres_soeurs ?? []
  const addFS = () => {
    if (freresSoeurs.length >= 10) return
    const fs: FrereSoeur = { id: crypto.randomUUID(), alias: '', age: 0, situation: 'valide', a_enfants: false }
    setD({ ...d, identite: { ...d.identite, freres_soeurs: [...freresSoeurs, fs] } })
  }
  const updFS = (id: string, k: keyof FrereSoeur, v: unknown) =>
    setD({ ...d, identite: { ...d.identite, freres_soeurs: freresSoeurs.map(f => f.id === id ? { ...f, [k]: v } : f) } })
  const delFS = (id: string) =>
    setD({ ...d, identite: { ...d.identite, freres_soeurs: freresSoeurs.filter(f => f.id !== id) } })

  const addAscendant = () => {
    const a: Ascendant = {
      id: crypto.randomUUID(), lien: 'pere_client', situation: 'vivant',
      dependant: false, testament_connu: false, donation_consentie: false,
    }
    setD({ ...d, identite: { ...d.identite, ascendants: [...ascendants, a] } })
  }
  const updAscendant = (id: string, k: keyof Ascendant, v: unknown) =>
    setD({ ...d, identite: { ...d.identite, ascendants: ascendants.map(a => a.id === id ? { ...a, [k]: v } : a) } })
  const delAscendant = (id: string) =>
    setD({ ...d, identite: { ...d.identite, ascendants: ascendants.filter(a => a.id !== id) } })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Bouton arbre ── */}
      <button
        onClick={() => setShowArbre(v => !v)}
        style={{
          alignSelf: 'flex-start',
          background: showArbre ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${showArbre ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 10, color: showArbre ? 'var(--accent-emerald)' : 'var(--text-secondary)',
          cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: '8px 16px',
          transition: 'all 0.2s',
        }}
      >
        🌳 {showArbre ? 'Masquer' : 'Voir'} l&apos;arbre généalogique
      </button>

      {/* ── Arbre dépliable ── */}
      <div style={{
        overflow: 'hidden',
        maxHeight: showArbre ? 800 : 0,
        opacity: showArbre ? 1 : 0,
        transition: 'max-height 0.35s ease, opacity 0.25s ease',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: 16, overflowX: 'auto',
        }}>
          <ArbreGenealogie
            ageClient={d.identite.age_client ?? 0}
            ageConjoint={d.identite.age_conjoint}
            situationFamiliale={d.identite.situation_familiale ?? 'celibataire'}
            enfants={enfants}
            ascendants={ascendants}
            freresSoeurs={d.identite.freres_soeurs ?? []}
            enfantsGardeAlternee={gaIds}
          />
        </div>
      </div>

      <SectionTitle>👶 Famille descendante</SectionTitle>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: -8 }}>
        Enfants ({enfants.length})
      </div>

      {enfants.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>
          Aucun enfant renseigné
        </div>
      )}

      {enfants.map((e, idx) => {
        const ageClient = d.identite.age_client || 0
        const ageConj = d.identite.age_conjoint || 0
        const effectiveLien = !hasConjFamille ? 'client_seul' : e.lien
        const parentAgeForCheck =
          effectiveLien === 'client_seul'   ? ageClient :
          effectiveLien === 'conjoint_seul' ? ageConj :
          (ageConj > 0 ? Math.min(ageClient, ageConj) : ageClient)
        const ageGapWarn = e.age > 0 && parentAgeForCheck > 0 && (parentAgeForCheck - e.age) < 14
        return (
        <div key={e.id} className="glass-card" style={{ padding: 16, position: 'relative' }}>
          <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, marginBottom: 12 }}>
            Enfant {idx + 1}
          </div>
          <button onClick={() => delEnfant(e.id)} style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 6, color: '#EF4444', cursor: 'pointer', padding: '2px 8px', fontSize: 12
          }}>✕</button>
          <Grid cols={2}>
            <Field label="Âge">
              <NumInput value={e.age} onChange={v => updEnfantAge(e.id, v)} />
            </Field>
            <Field label="Lien de filiation">
              <Select
                value={!hasConjFamille ? 'client_seul' : e.lien}
                onChange={v => updEnfant(e.id, 'lien', v as Enfant['lien'])}
                options={hasConjFamille
                  ? [{ v: 'commun', l: 'Enfant commun' }, { v: 'client_seul', l: 'Enfant du client seul' }, { v: 'conjoint_seul', l: 'Enfant du conjoint seul' }]
                  : [{ v: 'client_seul', l: 'Enfant seul' }]
                }
              />
            </Field>
            <Field label="Situation">
              <Select value={e.situation} onChange={v => updEnfant(e.id, 'situation', v as Enfant['situation'])}
                options={situationOpts(e.age)} />
            </Field>
            {e.situation !== 'mineur' && (
              <Field label="Rattachement fiscal">
                {e.age > 25 && e.situation !== 'etudiant' ? (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 10px',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8 }}>
                      Propre foyer fiscal
                    </div>
                    <FieldNote>Un enfant de plus de 25 ans non étudiant ne peut plus être rattaché au foyer fiscal de ses parents.</FieldNote>
                  </>
                ) : (
                  <Select value={e.rattachement_fiscal} onChange={v => updEnfant(e.id, 'rattachement_fiscal', v as Enfant['rattachement_fiscal'])}
                    options={[{ v: 'foyer_client', l: 'Foyer du client' }, { v: 'autonome', l: 'Foyer autonome' }]} />
                )}
              </Field>
            )}
            {e.situation === 'mineur' && e.lien !== 'commun' && (
              <Field label="Garde alternée ?">
                <Select value={gaIds.includes(e.id) ? 'oui' : 'non'}
                  onChange={v => toggleGA(e.id, v === 'oui')}
                  options={[{ v: 'non', l: 'Non' }, { v: 'oui', l: 'Oui — 0,25 part / enfant (rangs 1-2)' }]} />
              </Field>
            )}
          </Grid>
          {ageGapWarn && (
            <div style={{
              marginTop: 8, fontSize: 11, color: '#F59E0B', lineHeight: 1.5,
              padding: '8px 12px', background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8,
            }}>
              ⚠️ L&apos;écart d&apos;âge entre le parent et l&apos;enfant semble incohérent (moins de 14 ans)
            </div>
          )}
        </div>
        )
      })}

      <button onClick={addEnfant} style={{
        background: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.35)',
        borderRadius: 10, color: 'var(--accent-blue)', cursor: 'pointer',
        padding: '12px 20px', fontSize: 13, fontWeight: 500
      }}>
        + Ajouter un enfant
      </button>

      <SectionTitle>Dispositions juridiques</SectionTitle>

      <Field label="Mandat de protection future (client) ?">
        <Select value={getE('mandat_protection_future')} onChange={v => setE('mandat_protection_future', v)}
          options={[
            { v: 'oui',      l: 'Oui' },
            { v: 'non',      l: 'Non' },
            { v: 'en_cours', l: 'En cours de réalisation' },
          ]} />
      </Field>
      {getE('mandat_protection_future') === 'oui' && (
        <Field label="Ce mandat est-il authentique (rédigé par un notaire) ?">
          <Select value={getE('mpf_authentique')} onChange={v => setE('mpf_authentique', v)}
            options={[
              { v: 'oui',     l: 'Oui (authentique — notarié)' },
              { v: 'non',     l: 'Non (sous seing privé)' },
              { v: 'inconnu', l: 'Je ne sais pas' },
            ]} />
        </Field>
      )}

      <SectionTitle>Notes famille</SectionTitle>
      <Field label="Informations complémentaires" hint="Recomposition, donations reçues...">
        <textarea className="glass-input" rows={3}
          value={d.identite.notes_famille ?? ''}
          onChange={e => setD({ ...d, identite: { ...d.identite, notes_famille: e.target.value } })}
          placeholder="Ex: recomposition familiale, donation reçue en 2022..."
          style={{ resize: 'vertical', lineHeight: 1.5 }}
        />
      </Field>

      <SectionTitle>👴 Famille ascendante</SectionTitle>

      {ascendants.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>
          Aucun ascendant renseigné
        </div>
      )}

      {ascendants.map((a, idx) => (
        <div key={a.id} className="glass-card" style={{ padding: 16, position: 'relative' }}>
          <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, marginBottom: 12 }}>
            Ascendant {idx + 1}
          </div>
          <button onClick={() => delAscendant(a.id)} style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 6, color: '#EF4444', cursor: 'pointer', padding: '2px 8px', fontSize: 12
          }}>✕</button>
          <Grid cols={2}>
            <Field label="Lien">
              <Select value={a.lien} onChange={v => updAscendant(a.id, 'lien', v as Ascendant['lien'])}
                options={[
                  { v: 'pere_client',           l: 'Père du client' },
                  { v: 'mere_client',           l: 'Mère du client' },
                  { v: 'pere_conjoint',         l: 'Père du conjoint' },
                  { v: 'mere_conjoint',         l: 'Mère du conjoint' },
                  { v: 'pere_adoptif_client',   l: 'Père adoptif du client' },
                  { v: 'mere_adoptif_client',   l: 'Mère adoptive du client' },
                  { v: 'pere_adoptif_conjoint', l: 'Père adoptif du conjoint' },
                  { v: 'mere_adoptif_conjoint', l: 'Mère adoptive du conjoint' },
                  { v: 'autre',                 l: 'Autre' },
                ]} />
            </Field>
            {a.lien.includes('adoptif') && (
              <Field label="Type d'adoption">
                <Select value={a.type_adoption ?? ''}
                  onChange={v => updAscendant(a.id, 'type_adoption', v as Ascendant['type_adoption'])}
                  options={[
                    { v: 'pleniere', l: 'Adoption plénière' },
                    { v: 'simple',   l: 'Adoption simple' },
                  ]} />
                {a.type_adoption === 'pleniere' && (
                  <FieldNote>L&apos;adopté a les mêmes droits successoraux qu&apos;un enfant biologique</FieldNote>
                )}
                {a.type_adoption === 'simple' && (
                  <FieldNote>L&apos;adopté conserve ses droits dans sa famille d&apos;origine. Droits en ligne directe uniquement si lien au 4e degré (enfant du conjoint, pupille...)</FieldNote>
                )}
              </Field>
            )}
            <Field label="Situation">
              <Select value={a.situation} onChange={v => updAscendant(a.id, 'situation', v as Ascendant['situation'])}
                options={[{ v: 'vivant', l: 'Vivant(e)' }, { v: 'decede', l: 'Décédé(e)' }]} />
            </Field>
            <Field label="Âge" hint="optionnel">
              <NumInput value={a.age} onChange={v => updAscendant(a.id, 'age', v)} placeholder="ex: 78" />
            </Field>
            {a.situation !== 'decede' && (
              <Field label="Patrimoine estimé (€)">
                <NumInput value={a.patrimoine_estime} onChange={v => updAscendant(a.id, 'patrimoine_estime', v)} />
                <FieldNote>Estimation utile pour anticiper la succession future</FieldNote>
              </Field>
            )}
            {a.situation !== 'decede' && (
              <Field label="Dépendant (à charge) ?">
                <Select value={a.dependant ? 'oui' : 'non'}
                  onChange={v => updAscendant(a.id, 'dependant', v === 'oui')}
                  options={[{ v: 'non', l: 'Non' }, { v: 'oui', l: 'Oui' }]} />
              </Field>
            )}
            {a.situation === 'decede' && a.lien !== 'autre' && (() => {
              const gpLabel = ({
                pere_client:           'Grand-parent paternel (côté client)',
                mere_client:           'Grand-parent maternel (côté client)',
                pere_conjoint:         'Grand-parent paternel (côté conjoint)',
                mere_conjoint:         'Grand-parent maternel (côté conjoint)',
                pere_adoptif_client:   'Grand-parent adoptif paternel (côté client)',
                mere_adoptif_client:   'Grand-parent adoptif maternel (côté client)',
                pere_adoptif_conjoint: 'Grand-parent adoptif paternel (côté conjoint)',
                mere_adoptif_conjoint: 'Grand-parent adoptif maternel (côté conjoint)',
              } as Record<string, string>)[a.lien]
              return (
                <Field label={`${gpLabel} vivant ?`}>
                  <Select
                    value={a.grand_parent_vivant === true ? 'oui' : a.grand_parent_vivant === false ? 'non' : ''}
                    onChange={v => updAscendant(a.id, 'grand_parent_vivant', v === 'oui')}
                    options={[{ v: 'oui', l: 'Oui' }, { v: 'non', l: 'Non' }]}
                  />
                  <FieldNote>Utile pour la représentation successorale</FieldNote>
                </Field>
              )
            })()}
            <Field label="Testament connu ?">
              <Select
                value={a.testament_connu === 'inconnu' ? 'inconnu' : a.testament_connu ? 'oui' : 'non'}
                onChange={v => updAscendant(a.id, 'testament_connu', v === 'oui' ? true : v === 'non' ? false : 'inconnu')}
                options={[{ v: 'non', l: 'Non' }, { v: 'oui', l: 'Oui' }, { v: 'inconnu', l: 'Je ne sais pas' }]}
              />
            </Field>
            <Field label="Donation consentie à vous ?">
              <Select value={a.donation_consentie ? 'oui' : 'non'}
                onChange={v => updAscendant(a.id, 'donation_consentie', v === 'oui')}
                options={[{ v: 'non', l: 'Non' }, { v: 'oui', l: 'Oui' }]} />
            </Field>
            {a.situation !== 'decede' && (
              <Field label="Mandat de protection future">
                <Select value={a.mandat_protection_future ?? ''}
                  onChange={v => updAscendant(a.id, 'mandat_protection_future', v as Ascendant['mandat_protection_future'])}
                  options={[
                    { v: 'oui',      l: 'Oui — en place' },
                    { v: 'non',      l: 'Non' },
                    { v: 'a_faire',  l: 'À mettre en place' },
                    { v: 'en_cours', l: 'En cours de réalisation' },
                  ]} />
              </Field>
            )}
            {a.situation !== 'decede' && a.mandat_protection_future === 'oui' && (
              <Field label="Ce mandat est-il authentique (notarié) ?">
                <Select value={a.mpf_authentique ?? ''}
                  onChange={v => updAscendant(a.id, 'mpf_authentique', v as Ascendant['mpf_authentique'])}
                  options={[
                    { v: 'oui',     l: 'Oui (authentique — notarié)' },
                    { v: 'non',     l: 'Non (sous seing privé)' },
                    { v: 'inconnu', l: 'Je ne sais pas' },
                  ]} />
              </Field>
            )}
          </Grid>
          {a.situation === 'vivant' && (a.age ?? 0) > 70 &&
            (a.mandat_protection_future === 'non' || a.mandat_protection_future === 'a_faire') && (
            <div style={{
              marginTop: 8, fontSize: 11, color: '#F59E0B', lineHeight: 1.5,
              padding: '8px 12px', background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8
            }}>
              ⚠️ Recommandé : le mandat de protection future permet de désigner à l&apos;avance un mandataire en cas de perte d&apos;autonomie.
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <Field label="Notes">
              <textarea className="glass-input" rows={2}
                value={a.notes ?? ''}
                onChange={ev => updAscendant(a.id, 'notes', ev.target.value)}
                style={{ resize: 'vertical', lineHeight: 1.5, fontSize: 12 }}
              />
            </Field>
          </div>
        </div>
      ))}

      <button onClick={addAscendant} style={{
        background: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.35)',
        borderRadius: 10, color: 'var(--accent-blue)', cursor: 'pointer',
        padding: '12px 20px', fontSize: 13, fontWeight: 500
      }}>
        + Ajouter un ascendant
      </button>

      <SectionTitle>👫 Frères et sœurs</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
        {freresSoeurs.length}/10 · Utile pour l&apos;analyse successorale (représentation, abattements handicap)
      </div>

      {freresSoeurs.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
          Aucun frère ou sœur renseigné
        </div>
      )}

      {freresSoeurs.map((fs, idx) => (
        <div key={fs.id} className="glass-card" style={{ padding: 16, position: 'relative' }}>
          <div style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, marginBottom: 12 }}>
            Frère / Sœur {idx + 1}
          </div>
          <button onClick={() => delFS(fs.id)} style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 6, color: '#EF4444', cursor: 'pointer', padding: '2px 8px', fontSize: 12
          }}>✕</button>
          <Grid cols={2}>
            <Field label="Prénom ou alias">
              <Input value={fs.alias} onChange={v => updFS(fs.id, 'alias', v)} placeholder="ex: Frère 1" />
            </Field>
            <Field label="Âge">
              <NumInput value={fs.age} onChange={v => updFS(fs.id, 'age', v)} />
            </Field>
            <Field label="Situation">
              <Select value={fs.situation} onChange={v => updFS(fs.id, 'situation', v as FrereSoeur['situation'])}
                options={[{ v: 'valide', l: 'Valide' }, { v: 'handicape', l: 'Handicapé(e)' }]} />
            </Field>
            {fs.situation === 'handicape' && (
              <Field label="Type de handicap">
                <Input value={fs.type_handicap ?? ''} onChange={v => updFS(fs.id, 'type_handicap', v)}
                  placeholder="ex: RQTH, taux d'invalidité..." />
              </Field>
            )}
            <Field label="A des enfants ?">
              <Select value={fs.a_enfants ? 'oui' : 'non'}
                onChange={v => updFS(fs.id, 'a_enfants', v === 'oui')}
                options={[{ v: 'non', l: 'Non' }, { v: 'oui', l: 'Oui' }]} />
            </Field>
            {fs.a_enfants && (
              <Field label="Nombre d'enfants">
                <NumInput value={fs.nb_enfants ?? 0} onChange={v => updFS(fs.id, 'nb_enfants', v)} />
              </Field>
            )}
          </Grid>
          {fs.situation === 'handicape' && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#A78BFA', lineHeight: 1.5,
              padding: '8px 12px', background: 'rgba(167,139,250,0.06)',
              border: '1px solid rgba(167,139,250,0.2)', borderRadius: 8 }}>
              ℹ️ Abattement spécifique de 159 325 € en cas de succession (art. 779 II CGI)
            </div>
          )}
        </div>
      ))}

      {freresSoeurs.length < 10 && (
        <button onClick={addFS} style={{
          background: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.35)',
          borderRadius: 10, color: 'var(--accent-blue)', cursor: 'pointer',
          padding: '12px 20px', fontSize: 13, fontWeight: 500
        }}>
          + Ajouter un frère / une sœur
        </button>
      )}
    </div>
  )
}

// ─── ÉTAPE 3 : REVENUS ──────────────────────────────────────
const MODE_CARDS = [
  {
    id: 'package' as const,
    icon: '📦',
    label: 'Package annuel brut',
    desc: 'Saisie rapide — revenu brut total + type',
  },
  {
    id: 'detail_avis' as const,
    icon: '📋',
    label: "Détail de l'avis d'imposition",
    desc: 'Cases 1AJ, 4BA, 3VG… saisie manuelle détaillée',
  },
  {
    id: 'import_pdf' as const,
    icon: '📄',
    label: 'Importer l\'avis (PDF)',
    desc: 'Extraction automatique par IA',
  },
]

function StepRevenus({ d, setD }: { d: DossierPatrimonial; setD: (d: DossierPatrimonial) => void }) {
  const r = d.revenus
  const upd = (k: string, v: number | string | boolean) => setD({ ...d, revenus: { ...d.revenus, [k]: v } })
  const mode = r.mode_revenus ?? 'package'

  const sf = (d.identite.situation_familiale ?? '') as string
  const hasConj = sf === 'marie' || sf === 'pacse' || sf === 'concubin'
  const gaIds = d.identite.enfants_garde_alternee ?? []
  const enfantsFoyer = (d.identite.enfants ?? []).filter(e => e.rattachement_fiscal === 'foyer_client')
  let partsTheo = hasConj ? 2 : 1
  let rang = 0
  enfantsFoyer.forEach(enfant => {
    rang++
    const enGA = gaIds.includes(enfant.id)
    partsTheo += enGA ? (rang <= 2 ? 0.25 : 0.5) : (rang <= 2 ? 0.5 : 1)
  })
  partsTheo = Math.round(partsTheo * 4) / 4
  const nbParts = r.nb_parts ?? 0
  const showPartsWarn = nbParts > 0 && Math.abs(nbParts - partsTheo) > 0.6

  const fmt = (n: number) => n > 0 ? n.toLocaleString('fr-FR') + ' €' : '—'

  // Estimation net pour le mode package
  const typeC  = r.type_revenus_client   ?? 'salarie'
  const typeCo = r.type_revenus_conjoint ?? 'salarie'
  const factorC  = typeC  === 'tns' ? 0.55 : typeC  === 'mixte' ? 0.65 : 0.78
  const factorCo = typeCo === 'tns' ? 0.55 : typeCo === 'mixte' ? 0.65 : 0.78
  const estNetC  = Math.round((r.revenu_brut_annuel_client   ?? 0) * factorC)
  const estNetCo = Math.round((r.revenu_brut_annuel_conjoint ?? 0) * factorCo)

  // Bloc fiscalité commun (tous modes)
  const BlocFiscalite = (
    <>
      <SectionTitle>Fiscalité</SectionTitle>
      <Grid cols={2}>
        <Field label="IR payé N-1 (€)">
          <NumInput value={r.ir_paye_n1} onChange={v => upd('ir_paye_n1', v)} />
          <FieldNote>Montant &lsquo;Impôt après réductions&rsquo; sur votre avis d&apos;imposition</FieldNote>
        </Field>
        <Field label="TMI (%)">
          <Select value={String(r.tmi ?? '')} onChange={v => upd('tmi', parseInt(v))}
            options={[0, 11, 30, 41, 45].map(n => ({ v: String(n), l: `${n}%` }))} />
          <FieldNote>Votre tranche figure sur votre avis d&apos;imposition (page 1)</FieldNote>
        </Field>
        <Field label="Nombre de parts">
          <NumInput value={r.nb_parts} onChange={v => upd('nb_parts', v)} />
          <FieldNote>Quotient familial — avis d&apos;imposition</FieldNote>
          {showPartsWarn && (
            <Warn color="#F59E0B">
              Parts attendues : ~{partsTheo.toLocaleString('fr-FR')} — vérifiez sur votre avis d&apos;imposition
            </Warn>
          )}
        </Field>
        <Field label="IFI payé N-1 (€)">
          <NumInput value={r.ifi_paye_n1} onChange={v => upd('ifi_paye_n1', v)} />
          <FieldNote>À renseigner uniquement si patrimoine immobilier net &gt; 1,3 M€</FieldNote>
        </Field>
      </Grid>
      <Field label="Avantages fiscaux actuels" hint="PER, Pinel, FCPI...">
        <Input value={r.avantages_fiscaux ?? ''} onChange={v => upd('avantages_fiscaux', v)}
          placeholder="ex: PER individuel 3 000 €/an, Pinel..." />
      </Field>
    </>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Sélecteur de mode ─────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
          Comment souhaitez-vous renseigner vos revenus ?
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {MODE_CARDS.map(card => {
            const active = mode === card.id
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => upd('mode_revenus', card.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 6, padding: '14px 14px 12px',
                  background: active ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                  border: active ? '1.5px solid rgba(59,130,246,0.55)' : '1.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.18s',
                }}
              >
                <span style={{ fontSize: 22 }}>{card.icon}</span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: active ? 'var(--accent-blue)' : 'var(--text-primary)',
                  lineHeight: 1.3,
                }}>
                  {card.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {card.desc}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Option 1 : Package annuel brut ────────────────────── */}
      {mode === 'package' && (
        <>
          <SectionTitle>Revenus bruts annuels</SectionTitle>
          <ColHeaders />
          <Grid cols={2}>
            <Field label="Revenu brut annuel">
              <NumInput value={r.revenu_brut_annuel_client}
                onChange={v => upd('revenu_brut_annuel_client', v)} placeholder="€/an" />
            </Field>
            <Field label="Revenu brut annuel">
              <NumInput value={hasConj ? r.revenu_brut_annuel_conjoint : undefined}
                onChange={v => upd('revenu_brut_annuel_conjoint', v)} placeholder="€/an" disabled={!hasConj} />
            </Field>
          </Grid>

          <Grid cols={2}>
            <Field label="Type de revenus">
              <Select
                value={r.type_revenus_client ?? ''}
                onChange={v => upd('type_revenus_client', v)}
                options={[
                  { v: 'salarie', l: 'Salarié' },
                  { v: 'tns',     l: 'TNS (indépendant)' },
                  { v: 'mixte',   l: 'Mixte (salarié + TNS)' },
                ]}
              />
              <FieldNote>Salarié → net ≈ brut × 78 % · TNS → net ≈ brut × 55 %</FieldNote>
            </Field>
            <Field label="Type de revenus">
              <Select
                value={r.type_revenus_conjoint ?? ''}
                onChange={v => upd('type_revenus_conjoint', v)}
                options={[
                  { v: 'salarie', l: 'Salarié' },
                  { v: 'tns',     l: 'TNS (indépendant)' },
                  { v: 'mixte',   l: 'Mixte' },
                ]}
                disabled={!hasConj}
              />
            </Field>
          </Grid>

          <Grid cols={2}>
            <Field label="Primes / bonus inclus ?">
              <Select
                value={r.primes_incluses_client !== undefined ? (r.primes_incluses_client ? 'oui' : 'non') : ''}
                onChange={v => upd('primes_incluses_client', v === 'oui')}
                options={[{ v: 'oui', l: 'Oui — inclus dans le brut' }, { v: 'non', l: 'Non — hors primes' }]}
              />
            </Field>
            <Field label="Primes / bonus inclus ?">
              <Select
                value={r.primes_incluses_conjoint !== undefined ? (r.primes_incluses_conjoint ? 'oui' : 'non') : ''}
                onChange={v => upd('primes_incluses_conjoint', v === 'oui')}
                options={[{ v: 'oui', l: 'Oui — inclus dans le brut' }, { v: 'non', l: 'Non — hors primes' }]}
                disabled={!hasConj}
              />
            </Field>
          </Grid>

          {r.primes_incluses_client === false && (
            <Grid cols={2}>
              <Field label="Montant primes brutes (€/an)">
                <NumInput value={r.primes_montant_client} onChange={v => upd('primes_montant_client', v)} />
              </Field>
              {hasConj && r.primes_incluses_conjoint === false && (
                <Field label="Montant primes brutes (€/an)">
                  <NumInput value={r.primes_montant_conjoint} onChange={v => upd('primes_montant_conjoint', v)} />
                </Field>
              )}
            </Grid>
          )}

          <Grid cols={2}>
            <Field label="Avantages en nature (€/an)" hint="si applicable">
              <NumInput value={r.avantages_nature_client} onChange={v => upd('avantages_nature_client', v)} />
            </Field>
            <Field label="Avantages en nature (€/an)">
              <NumInput value={hasConj ? r.avantages_nature_conjoint : undefined}
                onChange={v => upd('avantages_nature_conjoint', v)} disabled={!hasConj} />
            </Field>
          </Grid>

          {((r.revenu_brut_annuel_client ?? 0) > 0 || (r.revenu_brut_annuel_conjoint ?? 0) > 0) && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
              background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)',
              borderRadius: 10, padding: '12px 16px'
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net estimé — Client</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-emerald)' }}>{fmt(estNetC)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net estimé — Conjoint</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-emerald)' }}>{fmt(estNetCo)}</div>
              </div>
            </div>
          )}

          <SectionTitle>Autres revenus nets annuels</SectionTitle>
          {[
            { k: 'revenus_tns_net',      label: 'Revenus TNS nets (gérance / BNC)' },
            { k: 'dividendes_net',       label: 'Dividendes nets' },
            { k: 'revenus_fonciers_net', label: 'Revenus fonciers nets' },
            { k: 'loyers_lmnp_net',      label: 'Loyers LMNP / LMP nets' },
            { k: 'plus_values_net',      label: 'Plus-values nettes réalisées' },
            { k: 'retraite_net',         label: 'Retraite nette (si retraité)' },
          ].map(row => (
            <Field key={row.k} label={row.label}>
              <NumInput value={(r as Record<string, unknown>)[row.k] as number} onChange={v => upd(row.k, v)} placeholder="€/an" />
            </Field>
          ))}

          {BlocFiscalite}
        </>
      )}

      {/* ── Option 2 : Détail avis d'imposition ───────────────── */}
      {mode === 'detail_avis' && (
        <>
          <SectionTitle>Revenus d&apos;activité</SectionTitle>
          <ColHeaders />
          <Grid cols={2}>
            <Field label="Traitements et salaires" hint="Case 1AJ">
              <NumInput value={r.traitements_salaires_client}
                onChange={v => upd('traitements_salaires_client', v)} placeholder="€" />
            </Field>
            <Field label="Traitements et salaires" hint="Case 1BJ">
              <NumInput value={hasConj ? r.traitements_salaires_conjoint : undefined}
                onChange={v => upd('traitements_salaires_conjoint', v)} disabled={!hasConj} placeholder="€" />
            </Field>
          </Grid>

          <Field label="Revenus indépendants BIC / BNC / BA" hint="Cases 5…">
            <NumInput value={r.bic_bnc_ba} onChange={v => upd('bic_bnc_ba', v)} placeholder="€" />
          </Field>

          <Grid cols={2}>
            <Field label="Pensions et retraites" hint="Case 1AS">
              <NumInput value={r.pensions_retraites_client}
                onChange={v => upd('pensions_retraites_client', v)} placeholder="€" />
            </Field>
            <Field label="Pensions et retraites" hint="Case 1BS">
              <NumInput value={hasConj ? r.pensions_retraites_conjoint : undefined}
                onChange={v => upd('pensions_retraites_conjoint', v)} disabled={!hasConj} placeholder="€" />
            </Field>
          </Grid>

          <SectionTitle>Revenus du patrimoine</SectionTitle>
          <Field label="Revenus fonciers nets" hint="Case 4BA (réel) ou 4BE (micro-foncier)">
            <NumInput value={r.revenus_fonciers_4ba} onChange={v => upd('revenus_fonciers_4ba', v)} placeholder="€" />
          </Field>
          <Grid cols={2}>
            <Field label="Revenus de capitaux mobiliers" hint="Case 2DC">
              <NumInput value={r.rcm_2dc} onChange={v => upd('rcm_2dc', v)} placeholder="€" />
            </Field>
            <Field label="Plus-values mobilières" hint="Case 3VG">
              <NumInput value={r.pv_mobiliere_3vg} onChange={v => upd('pv_mobiliere_3vg', v)} placeholder="€" />
            </Field>
          </Grid>

          <SectionTitle>Charges déductibles</SectionTitle>
          <Grid cols={2}>
            <Field label="Pensions alimentaires versées" hint="Case 6GU">
              <NumInput value={r.pensions_alimentaires_6gu}
                onChange={v => upd('pensions_alimentaires_6gu', v)} placeholder="€" />
            </Field>
            <Field label="CSG déductible" hint="Case 6DE">
              <NumInput value={r.csg_deductible_6de} onChange={v => upd('csg_deductible_6de', v)} placeholder="€" />
            </Field>
          </Grid>
          <Field label="Épargne retraite PER / PERP" hint="Cases 6NS / 6NT">
            <NumInput value={r.epargne_retraite_6ns} onChange={v => upd('epargne_retraite_6ns', v)} placeholder="€" />
          </Field>

          <SectionTitle>Résultat fiscal</SectionTitle>
          <Grid cols={2}>
            <Field label="Revenu brut global (€)">
              <NumInput value={r.revenu_brut_global} onChange={v => upd('revenu_brut_global', v)} />
            </Field>
            <Field label="Revenu net imposable (€)">
              <NumInput value={r.revenu_net_imposable} onChange={v => upd('revenu_net_imposable', v)} />
            </Field>
            <Field label="Nombre de parts fiscales">
              <NumInput value={r.nb_parts} onChange={v => upd('nb_parts', v)} />
              {showPartsWarn && (
                <Warn color="#F59E0B">
                  Parts attendues : ~{partsTheo.toLocaleString('fr-FR')}
                </Warn>
              )}
            </Field>
            <Field label="Revenu fiscal de référence (RFR)">
              <NumInput value={r.rfr} onChange={v => upd('rfr', v)} />
            </Field>
          </Grid>

          {BlocFiscalite}
        </>
      )}

      {/* ── Option 3 : Import PDF ──────────────────────────────── */}
      {mode === 'import_pdf' && (
        <>
          <ImportDocument
            label="Importer l'avis d'imposition (PDF)"
            typeForce="avis_imposition"
            onSuccess={(data) => {
              const extracted = data as {
                ir_paye_n1?: number; tmi?: number; nb_parts?: number
                ifi_paye_n1?: number; deficit_foncier_reportable?: number
                revenu_net_imposable?: number; rfr?: number
                revenus_declares?: {
                  salaires_traitements_net_total?: number
                  revenus_fonciers_nets?: number
                  lmnp_recettes?: number
                  dividendes_rcm?: number
                }
              }
              const rev = extracted.revenus_declares ?? {}
              const updates: Partial<typeof d.revenus> = {}
              if (extracted.ir_paye_n1)               updates.ir_paye_n1 = extracted.ir_paye_n1
              if (extracted.tmi)                       updates.tmi = extracted.tmi
              if (extracted.nb_parts)                  updates.nb_parts = extracted.nb_parts
              if (extracted.ifi_paye_n1)               updates.ifi_paye_n1 = extracted.ifi_paye_n1
              if (extracted.deficit_foncier_reportable) updates.deficit_foncier_reportable = extracted.deficit_foncier_reportable
              if (extracted.revenu_net_imposable)      updates.revenu_net_imposable = extracted.revenu_net_imposable
              if (extracted.rfr)                       updates.rfr = extracted.rfr
              if (rev.salaires_traitements_net_total)  updates.traitements_salaires_client = rev.salaires_traitements_net_total
              if (rev.revenus_fonciers_nets)           updates.revenus_fonciers_4ba = rev.revenus_fonciers_nets
              if (rev.lmnp_recettes)                   updates.loyers_lmnp_net = rev.lmnp_recettes
              if (rev.dividendes_rcm)                  updates.rcm_2dc = rev.dividendes_rcm
              setD({ ...d, revenus: { ...d.revenus, ...updates } })
            }}
          />

          {/* Récapitulatif si données extraites */}
          {(r.ir_paye_n1 || r.revenu_net_imposable || r.traitements_salaires_client) && (
            <>
              <SectionTitle>Données extraites</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Traitements et salaires (client)', v: r.traitements_salaires_client },
                  { label: 'Revenu net imposable', v: r.revenu_net_imposable },
                  { label: 'Revenus fonciers nets', v: r.revenus_fonciers_4ba },
                  { label: 'RFR', v: r.rfr },
                  { label: 'IR payé N-1', v: r.ir_paye_n1 },
                  { label: 'Nombre de parts', v: r.nb_parts },
                  { label: 'TMI (%)', v: r.tmi },
                ].filter(row => row.v).map(row => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 12, color: 'var(--text-secondary)',
                    padding: '6px 12px', background: 'rgba(255,255,255,0.03)',
                    borderRadius: 7, border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <span>{row.label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {typeof row.v === 'number' ? row.v.toLocaleString('fr-FR') : row.v}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {BlocFiscalite}
        </>
      )}
    </div>
  )
}

// ─── ÉTAPE 4 : IMMOBILIER ───────────────────────────────────
function StepImmo({ d, setD }: { d: DossierPatrimonial; setD: (d: DossierPatrimonial) => void }) {
  const biens = d.biens_immo

  const addBien = () => {
    const b: BienImmo = {
      id: crypto.randomUUID(), type: '', localisation: '', detenu_par: 'client',
      mode_propriete: 'pleine_propriete', quote_part: 100,
      valeur_venale: 0, prix_acquisition: 0, annee_acquisition: 0,
      crd: 0, mensualite: 0, duree_restante_mois: 0, taux: 0, assurance_emprunteur: 0,
      loyer_mensuel_brut: 0, taux_occupation: 100, charges_annuelles: 0,
      regime_fiscal: '', dispositif_fiscal: 'aucun',
    }
    setD({ ...d, biens_immo: [...biens, b] })
  }

  const upd = (id: string, k: keyof BienImmo, v: unknown) =>
    setD({ ...d, biens_immo: biens.map(b => b.id === id ? { ...b, [k]: v } : b) })

  const updExtra = (id: string, k: string, v: unknown) =>
    setD({ ...d, biens_immo: biens.map(b => b.id === id ? { ...b, [k]: v } : b) })

  const del = (id: string) => setD({ ...d, biens_immo: biens.filter(b => b.id !== id) })

  const totalNet = biens.reduce((s, b) => s + (b.valeur_venale - b.crd), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {biens.length > 0 && (
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--accent-emerald)' }}>
          Patrimoine immobilier net : <strong>{totalNet.toLocaleString('fr-FR')} €</strong>
        </div>
      )}

      {biens.map((b, idx) => {
        const bExtra = b as unknown as Record<string, unknown>
        const pvAlert = b.valeur_venale > 0 && b.prix_acquisition > 0 &&
          b.valeur_venale < b.prix_acquisition * 0.5
        const dateUnion = d.identite.date_union ?? ''
        const anneeUnion = dateUnion ? new Date(dateUnion).getFullYear() : null
        const showMariageZone = d.identite.situation_familiale === 'marie' && anneeUnion !== null && b.annee_acquisition === anneeUnion
        const dateAchatExacte = b.date_achat_exacte ?? ''
        const bienPropre = showMariageZone && dateAchatExacte && dateUnion && dateAchatExacte < dateUnion
        const bienCommun = showMariageZone && dateAchatExacte && dateUnion && dateAchatExacte >= dateUnion
        return (
          <div key={b.id} className="glass-card" style={{ padding: 16, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>Bien {idx + 1}</span>
              <button onClick={() => del(b.id)} style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 6, color: '#EF4444', cursor: 'pointer', padding: '2px 8px', fontSize: 12
              }}>✕</button>
            </div>
            <Grid cols={2}>
              <Field label="Type de bien">
                <Select value={b.type} onChange={v => upd(b.id, 'type', v)}
                  options={TYPES_IMMO.map(t => ({ v: t, l: t }))} />
              </Field>
              <Field label="Localisation">
                <Input value={b.localisation} onChange={v => upd(b.id, 'localisation', v)} placeholder="Ville / Dép." />
              </Field>
              <Field label="Valeur vénale (€)">
                <NumInput value={b.valeur_venale} onChange={v => upd(b.id, 'valeur_venale', v)} />
                {pvAlert && (
                  <Warn color="#EF4444">
                    Valeur vénale inférieure de plus de 50% au prix d&apos;acquisition — vérifier
                  </Warn>
                )}
              </Field>
              <Field label="Prix d'acquisition (€)">
                <NumInput value={b.prix_acquisition} onChange={v => upd(b.id, 'prix_acquisition', v)} />
              </Field>
              <Field label="Année d'acquisition">
                <NumInput value={b.annee_acquisition} onChange={v => upd(b.id, 'annee_acquisition', v)} placeholder="ex: 2018" />
              </Field>
              {showMariageZone && (
                <Field label="Date exacte d'achat" hint={`Date du mariage : ${dateUnion}`}>
                  <Input type="date" value={dateAchatExacte} onChange={v => upd(b.id, 'date_achat_exacte', v)} />
                  {(bienPropre || bienCommun) && (
                    <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: bienPropre ? 'rgba(167,139,250,0.12)' : 'rgba(52,211,153,0.1)',
                      border: `1px solid ${bienPropre ? 'rgba(167,139,250,0.3)' : 'rgba(52,211,153,0.25)'}`,
                      color: bienPropre ? '#A78BFA' : '#34D399',
                    }}>
                      🏠 {bienPropre ? 'Bien propre (achat avant mariage)' : 'Bien commun (achat après mariage)'}
                    </div>
                  )}
                </Field>
              )}
              <Field label="Quote-part (%)">
                <NumInput value={b.quote_part} onChange={v => upd(b.id, 'quote_part', v)} />
              </Field>
              <Field label="Capital restant dû (€)">
                <NumInput value={b.crd} onChange={v => upd(b.id, 'crd', v)} />
              </Field>
              <Field label="Mensualité crédit (€/mois)">
                <NumInput value={b.mensualite} onChange={v => upd(b.id, 'mensualite', v)} />
              </Field>
              <Field label="Assurance du prêt — mensualité (€/mois)">
                <NumInput value={b.assurance_emprunteur} onChange={v => upd(b.id, 'assurance_emprunteur', v)} />
              </Field>
              <Field label="Taux de couverture assurance (%)">
                <NumInput
                  value={bExtra.taux_couverture_assurance as number}
                  onChange={v => updExtra(b.id, 'taux_couverture_assurance', v)}
                />
                <FieldNote>Ex : 100% = couverture totale, 50%/50% = couple à parité</FieldNote>
              </Field>
              <Field label="Loyer brut mensuel (€)">
                <NumInput value={b.loyer_mensuel_brut} onChange={v => upd(b.id, 'loyer_mensuel_brut', v)} />
              </Field>
              <Field label="Régime fiscal">
                <Input value={b.regime_fiscal} onChange={v => upd(b.id, 'regime_fiscal', v)}
                  placeholder="Micro-foncier / Réel / LMNP..." />
              </Field>
            </Grid>
            {b.valeur_venale > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                Plus-value latente :
                <span style={{ color: b.valeur_venale - b.prix_acquisition > 0 ? 'var(--accent-emerald)' : '#EF4444', marginLeft: 6 }}>
                  {(b.valeur_venale - b.prix_acquisition).toLocaleString('fr-FR')} €
                </span>
                &nbsp;·&nbsp; Immo net :
                <span style={{ color: 'var(--accent-emerald)', marginLeft: 4 }}>
                  {(b.valeur_venale - b.crd).toLocaleString('fr-FR')} €
                </span>
              </div>
            )}
          </div>
        )
      })}

      <button onClick={addBien} style={{
        background: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.35)',
        borderRadius: 10, color: 'var(--accent-blue)', cursor: 'pointer',
        padding: '12px 20px', fontSize: 13, fontWeight: 500
      }}>
        + Ajouter un bien immobilier
      </button>
    </div>
  )
}

// ─── ÉTAPE 5 : FINANCIER ────────────────────────────────────
function StepFinancier({ d, setD }: { d: DossierPatrimonial; setD: (d: DossierPatrimonial) => void }) {
  const produits = d.produits_financiers
  const total = produits.reduce((s, p) => s + p.valeur_actuelle, 0)
  const [modalPortefeuille, setModalPortefeuille] = useState<string | null>(null)
  const [importBadge, setImportBadge] = useState<number | null>(null)
  const [importedProduits, setImportedProduits] = useState<Record<string, { date: string; nb: number }>>({})

  const sfFin = (d.identite.situation_familiale ?? '') as string
  const hasConjFin = sfFin === 'marie' || sfFin === 'pacse' || sfFin === 'concubin'

  const addProduit = () => {
    const p: ProduitFinancier = {
      id: crypto.randomUUID(), type: '', etablissement: '',
      titulaire: 'client', date_ouverture: '',
      valeur_actuelle: 0, versements_annuels: 0, lignes: [],
    }
    setD({ ...d, produits_financiers: [...produits, p] })
  }
  const upd = (id: string, k: keyof ProduitFinancier, v: unknown) =>
    setD({ ...d, produits_financiers: produits.map(p => p.id === id ? { ...p, [k]: v } : p) })
  const updExtra = (id: string, k: string, v: unknown) =>
    setD({ ...d, produits_financiers: produits.map(p => p.id === id ? { ...p, [k]: v } : p) })
  const del = (id: string) => setD({ ...d, produits_financiers: produits.filter(p => p.id !== id) })

  const updFrais = (id: string, key: string, val: number) => {
    const prod = produits.find(p => p.id === id)
    if (!prod) return
    upd(id, 'frais', { ...(prod.frais ?? {}), [key]: val })
  }

  const handleImportPortefeuille = async (
    e: React.ChangeEvent<HTMLInputElement>,
    produitId: string
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1, defval: ''
    })

    const CATEGORIES_VALIDES = [
      'Fonds euros', 'Actions-ETF', 'Obligations',
      'SCPI', 'Produit structuré', 'Private Equity', 'Autre'
    ]

    const lignes = rows.slice(1)
      .filter(row => row[1] || row[0])
      .map(row => ({
        isin:             String(row[0] ?? '').trim(),
        libelle:          String(row[1] ?? '').trim(),
        categorie:        CATEGORIES_VALIDES.includes(String(row[2] ?? '').trim())
                            ? String(row[2]).trim()
                            : 'Autre',
        pct_portefeuille: parseFloat(String(row[3] ?? '0')) || 0,
        valeur:           0,
      }))
      .filter(l => l.libelle || l.isin)
      .slice(0, 20)

    if (lignes.length === 0) {
      alert('Aucune ligne valide trouvée dans le fichier.')
      return
    }

    upd(produitId, 'lignes', lignes)
    setImportBadge(lignes.length)
    setTimeout(() => setImportBadge(null), 3000)
    e.target.value = ''
  }

  // Modal portefeuille
  const modalProd = modalPortefeuille ? produits.find(p => p.id === modalPortefeuille) : null
  const lignesModal = modalProd?.lignes ?? []
  const totalPoids = lignesModal.reduce((s, l) => s + (l.pct_portefeuille ?? 0), 0)
  const updLigne = (idx: number, k: string, v: unknown) => {
    if (!modalPortefeuille) return
    const newLignes = lignesModal.map((l, i) => i === idx ? { ...l, [k]: v } : l)
    upd(modalPortefeuille, 'lignes', newLignes)
  }
  const addLigne = () => {
    if (!modalPortefeuille || lignesModal.length >= 20) return
    const newLigne: LignePorfolio = { libelle: '', isin: '', categorie: 'Fonds euros', valeur: 0, pct_portefeuille: 0 }
    upd(modalPortefeuille, 'lignes', [...lignesModal, newLigne])
  }
  const delLigne = (idx: number) => {
    if (!modalPortefeuille) return
    upd(modalPortefeuille, 'lignes', lignesModal.filter((_, i) => i !== idx))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {total > 0 && (
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--accent-emerald)' }}>
          Total financier : <strong>{total.toLocaleString('fr-FR')} €</strong>
        </div>
      )}

      {produits.map((p, idx) => {
        const montantVerse = p.montant_verse ?? 0
        const pvLatente = p.valeur_actuelle - montantVerse
        const showPV = montantVerse > 0 && p.valeur_actuelle > 0
        const isLivretSimple = p.type === 'Livret A' || p.type === 'LDDS'
        const livretA_warn = p.type === 'Livret A' && p.valeur_actuelle > 22950
        const ldds_warn = p.type === 'LDDS' && p.valeur_actuelle > 12000
        const hasPortefeuille = PRODUITS_AVEC_PORTEFEUILLE.includes(p.type)
        return (
          <div key={p.id} className="glass-card" style={{ padding: 16, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>Produit {idx + 1}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {hasPortefeuille && (
                  <button onClick={() => setModalPortefeuille(p.id)} style={{
                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: 6, color: 'var(--accent-indigo)', cursor: 'pointer', padding: '2px 10px', fontSize: 11, fontWeight: 600
                  }}>📊 Détail du portefeuille</button>
                )}
                {hasPortefeuille && (
                  <ImportDocument
                    compact
                    label="Importer relevé PDF"
                    onSuccess={(data) => {
                      const d2 = data as Record<string, unknown>
                      const valeur = (d2.valeur_rachat ?? d2.valorisation_totale ?? d2.encours_total) as number | undefined
                      const verse = d2.montant_total_verse as number | undefined
                      const assureur = (d2.assureur ?? d2.courtier) as string | undefined
                      const lignes = d2.lignes_portefeuille as unknown[] | undefined
                      const nb = lignes?.length ?? 0
                      const dateStr = new Date().toLocaleDateString('fr-FR')
                      // Batch toutes les mises à jour en un seul setD pour éviter
                      // l'écrasement mutuel des appels upd() sur le même d de closure
                      const patch: Partial<ProduitFinancier> = {}
                      if (valeur) patch.valeur_actuelle = valeur
                      if (verse) patch.montant_verse = verse
                      if (assureur && !p.etablissement) patch.etablissement = assureur
                      if (nb > 0) {
                        patch.lignes = lignes!.map((l: unknown) => {
                          const ligne = l as Record<string, unknown>
                          return {
                            libelle:          String(ligne.libelle ?? ''),
                            isin:             ligne.isin ? String(ligne.isin) : undefined,
                            categorie:        String(ligne.categorie ?? 'Autre'),
                            valeur:           Number(ligne.valeur ?? ligne.valeur_totale ?? 0),
                            pct_portefeuille: Number(ligne.pct_portefeuille ?? 0),
                          }
                        })
                      }
                      if (!p.notes) patch.notes = `Importé le ${dateStr}`
                      setD({ ...d, produits_financiers: d.produits_financiers.map(prod =>
                        prod.id === p.id ? { ...prod, ...patch } : prod
                      )})
                      setImportedProduits(prev => ({ ...prev, [p.id]: { date: dateStr, nb } }))
                    }}
                  />
                )}
                <button onClick={() => del(p.id)} style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 6, color: '#EF4444', cursor: 'pointer', padding: '2px 8px', fontSize: 12
                }}>✕</button>
              </div>
            </div>
            {importedProduits[p.id] && (
              <div style={{ fontSize: 11, color: 'var(--accent-gold)', fontStyle: 'italic', marginBottom: 8 }}>
                📥 Importé le {importedProduits[p.id].date} — {importedProduits[p.id].nb} lignes de portefeuille
              </div>
            )}

            {/* Type + Établissement — toujours visibles */}
            <Grid cols={2}>
              <Field label="Type">
                <Select value={p.type} onChange={v => upd(p.id, 'type', v)}
                  options={TYPES_PRODUIT.map(t => ({ v: t, l: t }))} />
              </Field>
              <Field label="Établissement">
                <Input value={p.etablissement} onChange={v => upd(p.id, 'etablissement', v)} placeholder="Banque / Assureur" />
              </Field>
            </Grid>

            {/* Interface simplifiée pour Livret A et LDDS */}
            {isLivretSimple ? (
              <div style={{ marginTop: 12 }}>
                <Field label="Solde actuel (€)">
                  <NumInput value={p.valeur_actuelle} onChange={v => upd(p.id, 'valeur_actuelle', v)} />
                  {livretA_warn && (
                    <Warn color="#F59E0B">
                      Le plafond légal du Livret A est 22 950 €. Vérifiez ce montant.
                    </Warn>
                  )}
                  {ldds_warn && (
                    <Warn color="#F59E0B">
                      Plafond LDDS : 12 000 €. Vérifiez ce montant.
                    </Warn>
                  )}
                </Field>
              </div>
            ) : (
              <>
                <Grid cols={2} style={{ marginTop: 12 }}>
                  <Field label="Titulaire">
                    <Select
                      value={hasConjFin ? p.titulaire : 'client'}
                      onChange={v => upd(p.id, 'titulaire', v)}
                      options={hasConjFin
                        ? [{ v: 'client', l: 'Client' }, { v: 'conjoint', l: 'Conjoint' }, { v: 'joint', l: 'Joint' }]
                        : [{ v: 'client', l: 'Client' }]
                      }
                      disabled={!hasConjFin}
                    />
                  </Field>
                  <Field label="Date d'ouverture">
                    <Input type="date" value={p.date_ouverture} onChange={v => upd(p.id, 'date_ouverture', v)} />
                  </Field>
                  <Field label="Valeur de rachat actuelle (€)">
                    <NumInput value={p.valeur_actuelle} onChange={v => upd(p.id, 'valeur_actuelle', v)} />
                  </Field>
                  <Field label="Montant total versé (€)">
                    <NumInput value={p.montant_verse} onChange={v => upd(p.id, 'montant_verse', v)} />
                    <FieldNote>Primes versées depuis l&apos;ouverture — sur votre relevé annuel</FieldNote>
                  </Field>
                </Grid>
                {showPV && (
                  <div style={{
                    marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                    background: pvLatente >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                    border: `1px solid ${pvLatente >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    display: 'flex', justifyContent: 'space-between'
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>Plus-value latente</span>
                    <strong style={{ color: pvLatente >= 0 ? 'var(--accent-emerald)' : '#EF4444' }}>
                      {pvLatente >= 0 ? '+' : ''}{pvLatente.toLocaleString('fr-FR')} €
                    </strong>
                  </div>
                )}
                {(p.type === 'Assurance-Vie' || p.type === 'Contrat de capitalisation') && (
                  <div style={{ marginTop: 12 }}>
                    <Field label="Clause bénéficiaire">
                      <Input value={p.clause_beneficiaire ?? ''} onChange={v => upd(p.id, 'clause_beneficiaire', v)}
                        placeholder="ex: Conjoint à défaut enfants par parts égales" />
                    </Field>
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <Field label="Notes / allocation">
                    <Input value={p.notes ?? ''} onChange={v => upd(p.id, 'notes', v)}
                      placeholder="ex: 60% fonds euros, 40% UC — ETF monde" />
                  </Field>
                </div>
                {FRAIS_CONFIG[p.type] && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                      color: 'var(--accent-gold)', textTransform: 'uppercase',
                      borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6, marginBottom: 12
                    }}>
                      💸 {FRAIS_CONFIG[p.type].label}
                    </div>
                    <Grid cols={2}>
                      {FRAIS_CONFIG[p.type].fields.map(f => (
                        <Field key={f.key} label={f.label}>
                          <NumInput
                            value={p.frais?.[f.key]}
                            onChange={v => updFrais(p.id, f.key, v)}
                          />
                          {f.note && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>
                              {f.note}
                            </div>
                          )}
                        </Field>
                      ))}
                    </Grid>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}

      <button onClick={addProduit} style={{
        background: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.35)',
        borderRadius: 10, color: 'var(--accent-blue)', cursor: 'pointer',
        padding: '12px 20px', fontSize: 13, fontWeight: 500
      }}>
        + Ajouter un produit financier
      </button>

      {/* Modal portefeuille */}
      {modalProd && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}
          onClick={() => setModalPortefeuille(null)}
        >
          <div className="glass-card" style={{
            maxWidth: 680, width: '95%', maxHeight: '80vh', overflow: 'auto', padding: 24
          }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', flexShrink: 0 }}>
                {modalProd.type} — {modalProd.etablissement || 'sans établissement'}
              </span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={() => window.open('/api/template-portefeuille', '_blank')} style={{
                  background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)',
                  borderRadius: 6, color: 'var(--accent-gold)', cursor: 'pointer',
                  padding: '4px 10px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap'
                }}>⬇️ Télécharger template</button>
                <label style={{
                  background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: 6, color: 'var(--accent-indigo)', cursor: 'pointer',
                  padding: '4px 10px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap'
                }}>
                  📥 Importer Excel
                  <input type="file" accept=".xls,.xlsx" style={{ display: 'none' }}
                    onChange={e => handleImportPortefeuille(e, modalPortefeuille!)} />
                </label>
                <button onClick={() => setModalPortefeuille(null)} style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1
                }}>✕</button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['ISIN', 'Nom / Libellé', 'Catégorie', 'Poids (%)', ''].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '6px 8px', fontSize: 11,
                        color: 'var(--text-muted)', fontWeight: 600,
                        borderBottom: '1px solid var(--border-glass)'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignesModal.map((l, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '4px 6px', width: 130 }}>
                        <input className="glass-input" value={l.isin ?? ''}
                          onChange={e => updLigne(idx, 'isin', e.target.value)}
                          placeholder="FR0000000000" style={{ padding: '4px 6px', fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input className="glass-input" value={l.libelle}
                          onChange={e => updLigne(idx, 'libelle', e.target.value)}
                          placeholder="Ex: Fonds euros, ETF World..." style={{ padding: '4px 6px', fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <select className="glass-input" value={l.categorie}
                          onChange={e => updLigne(idx, 'categorie', e.target.value)}
                          style={{ padding: '4px 6px', fontSize: 12, cursor: 'pointer' }}>
                          {CATEGORIES_LIGNES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '4px 6px', width: 80 }}>
                        <input className="glass-input" type="number" min={0} max={100}
                          value={l.pct_portefeuille || ''}
                          onChange={e => updLigne(idx, 'pct_portefeuille', parseFloat(e.target.value) || 0)}
                          placeholder="0" style={{ padding: '4px 6px', fontSize: 12, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <button onClick={() => delLigne(idx)} style={{
                          background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 14
                        }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {lignesModal.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
                Aucune ligne — cliquez &ldquo;+ Ajouter une ligne&rdquo; pour commencer
              </div>
            )}
            {lignesModal.length < 20 && (
              <button onClick={addLigne} style={{
                marginTop: 12, background: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.35)',
                borderRadius: 8, color: 'var(--accent-blue)', cursor: 'pointer',
                padding: '8px 16px', fontSize: 12, width: '100%'
              }}>
                + Ajouter une ligne
              </button>
            )}
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              {lignesModal.length > 0 && totalPoids !== 100 ? (
                <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600 }}>
                  ⚠️ Total : {Math.round(totalPoids)}% (doit être 100%)
                </span>
              ) : lignesModal.length > 0 ? (
                <span style={{ fontSize: 12, color: 'var(--accent-emerald)', fontWeight: 600 }}>✓ 100%</span>
              ) : null}
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {importBadge !== null ? (
                <span style={{ fontSize: 12, color: 'var(--accent-emerald)', fontWeight: 600 }}>
                  ✓ {importBadge} lignes importées
                </span>
              ) : <span />}
              <button onClick={() => setModalPortefeuille(null)} className="btn-ghost">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ÉTAPE 6 : PRÉVOYANCE ───────────────────────────────────
function StepPrevoyance({ d, setD }: { d: DossierPatrimonial; setD: (d: DossierPatrimonial) => void }) {
  const p = d.prevoyance
  const upd = (k: string, v: number | string) => setD({ ...d, prevoyance: { ...d.prevoyance, [k]: v } })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionTitle>Décès / Invalidité</SectionTitle>
      <ColHeaders />
      <Grid cols={2}>
        <Field label="Capital décès (€)">
          <NumInput value={p.capital_deces_client} onChange={v => upd('capital_deces_client', v)} />
          <FieldNote>
            Vérifiez votre contrat collectif (bulletin de salaire) ou contrat individuel.
            En l&apos;absence de contrat : 0€
          </FieldNote>
        </Field>
        <Field label="Capital décès (€)">
          <NumInput value={p.capital_deces_conjoint} onChange={v => upd('capital_deces_conjoint', v)} />
        </Field>
      </Grid>
      <Field label="Source couverture décès client">
        <Select value={p.source_deces_client ?? ''} onChange={v => upd('source_deces_client', v)}
          options={[
            { v: 'employeur',    l: 'Employeur' },
            { v: 'individuelle', l: 'Individuelle' },
            { v: 'madelin',      l: 'Madelin / TNS' },
            { v: 'aucune',       l: 'Aucune' },
          ]} />
        <FieldNote>
          Employeur = art. 83 ou contrat collectif obligatoire. Madelin = contrat TNS déductible.
        </FieldNote>
      </Field>

      <SectionTitle>Arrêt de travail</SectionTitle>
      <Grid cols={2}>
        <Field label="IJ nettes (€/jour)">
          <NumInput value={p.ij_client} onChange={v => upd('ij_client', v)} />
          <FieldNote>
            Indemnités journalières après CSG. Sécu seule : ~50% du salaire brut plafonné
          </FieldNote>
        </Field>
        <Field label="Délai de carence (jours)">
          <NumInput value={p.delai_carence_client} onChange={v => upd('delai_carence_client', v)} />
          <FieldNote>
            Souvent 3 jours (maladie) ou 90 jours (contrat haut de gamme)
          </FieldNote>
        </Field>
      </Grid>
      <Field label="Maintien de salaire employeur">
        <Select value={p.maintien_salaire_client ?? ''} onChange={v => upd('maintien_salaire_client', v)}
          options={[{ v: 'oui', l: 'Oui — intégral' }, { v: 'partiel', l: 'Partiel' }, { v: 'non', l: 'Non' }]} />
        <FieldNote>
          Obligation légale : 90% pendant 30 jours, puis 2/3. Vérifiez votre convention collective
        </FieldNote>
      </Field>

      <SectionTitle>Retraite</SectionTitle>
      <ColHeaders />
      <Grid cols={2}>
        <Field label="Retraite estimée nette (€/mois)">
          <NumInput value={p.retraite_estimee_client} onChange={v => upd('retraite_estimee_client', v)} />
          <FieldNote>Disponible sur info-retraite.fr avec votre numéro de sécurité sociale</FieldNote>
        </Field>
        <Field label="Retraite estimée nette (€/mois)">
          <NumInput value={p.retraite_estimee_conjoint} onChange={v => upd('retraite_estimee_conjoint', v)} />
        </Field>
      </Grid>
      <Field label="Âge de départ envisagé (client)">
        <NumInput value={p.age_depart_client} onChange={v => upd('age_depart_client', v)} placeholder="ex: 63" />
        <FieldNote>
          Âge légal : 64 ans (réforme 2023). Taux plein selon trimestres validés.
        </FieldNote>
      </Field>
      <div style={{ marginTop: 4 }}>
        <a
          href="https://www.info-retraite.fr"
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8,
            padding: '6px 12px', background: 'rgba(59,130,246,0.06)',
          }}
        >
          → Estimer ma retraite sur info-retraite.fr
        </a>
      </div>
    </div>
  )
}

// ─── ÉTAPE 7 : OBJECTIFS ────────────────────────────────────
function StepObjectifs({ d, setD }: { d: DossierPatrimonial; setD: (d: DossierPatrimonial) => void }) {
  const i = d.identite
  const upd = (k: string, v: unknown) => setD({ ...d, identite: { ...d.identite, [k]: v } })
  const toggleObj = (obj: string) => {
    const cur = i.objectifs ?? []
    upd('objectifs', cur.includes(obj) ? cur.filter(o => o !== obj) : [...cur, obj])
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionTitle>Objectifs patrimoniaux</SectionTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {OBJECTIFS_LIST.map(obj => {
          const active = (i.objectifs ?? []).includes(obj)
          return (
            <button key={obj} onClick={() => toggleObj(obj)} style={{
              padding: '8px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              border: active ? '1px solid var(--accent-blue)' : '1px solid var(--border-glass)',
              background: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
              color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}>
              {obj}
            </button>
          )
        })}
      </div>

      <SectionTitle>Paramètres de placement</SectionTitle>
      <Grid cols={2}>
        <Field label="Profil de risque">
          <Select value={i.profil_risque ?? ''} onChange={v => upd('profil_risque', v as ProfilRisque)}
            options={[{ v: 'prudent', l: 'Prudent' }, { v: 'equilibre', l: 'Équilibré' }, { v: 'dynamique', l: 'Dynamique' }]} />
        </Field>
        <Field label="Horizon principal">
          <Select value={i.horizon ?? ''} onChange={v => upd('horizon', v as Horizon)}
            options={[{ v: 'court', l: 'Court terme (< 3 ans)' }, { v: 'moyen', l: 'Moyen terme (3-8 ans)' }, { v: 'long', l: 'Long terme (> 8 ans)' }]} />
        </Field>
      </Grid>
      <Field label="Capacité d'épargne mensuelle disponible (€)">
        <NumInput value={i.capacite_epargne_mensuelle} onChange={v => upd('capacite_epargne_mensuelle', v)} />
      </Field>
      <Field label="Projet imminent (< 2 ans)">
        <Input value={i.projet_imminent ?? ''} onChange={v => upd('projet_imminent', v)}
          placeholder="ex: achat RP prévu, départ retraite dans 18 mois..." />
      </Field>
      <Field label="Précisez votre projet (optionnel)">
        <textarea
          className="glass-input"
          rows={4}
          value={i.objectifs_commentaire ?? ''}
          onChange={e => upd('objectifs_commentaire', e.target.value)}
          placeholder="Décrivez ici plus en détail votre projet ou vos attentes..."
          style={{ resize: 'vertical', lineHeight: 1.5 }}
        />
      </Field>
    </div>
  )
}

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────────
function SaisieInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { loading: authLoading } = useAuth()
  const [step, setStep] = useState(1)
  const [dossier, setDossier] = useState<DossierPatrimonial>(nouveauDossier)
  const [saved, setSaved] = useState(false)
  const [launching, setLaunching] = useState(false)

  const { visible: identiteVisible } = useIdentiteVisible()

  // Données personnelles (Clé B)
  const [identiteNom,    setIdentiteNom]    = useState('')
  const [identitePrenom, setIdentitePrenom] = useState('')
  const [identiteTel,    setIdentiteTel]    = useState('')
  const [identiteEmail,  setIdentiteEmail]  = useState('')
  const [identiteNomConjoint,    setIdentiteNomConjoint]    = useState('')
  const [identitePrenomConjoint, setIdentitePrenomConjoint] = useState('')
  const [identiteTelConjoint,    setIdentiteTelConjoint]    = useState('')
  const [identiteEmailConjoint,  setIdentiteEmailConjoint]  = useState('')

  // Charger dossier existant si alias en param
  useEffect(() => {
    const alias = params.get('alias')
    if (!alias) return
    getDossier(alias)
      .then(existing => { if (existing) setDossier(existing) })
      .catch(() => { /* session locked */ })
  }, [params])

  // Charger identité existante si Clé B active
  useEffect(() => {
    if (!dossier.alias || !identiteDisponible()) return
    lireIdentite(dossier.alias).then((id: IdentiteProspect | null) => {
      if (id) {
        setIdentiteNom(id.nom)
        setIdentitePrenom(id.prenom)
        setIdentiteTel(id.tel ?? '')
        setIdentiteEmail(id.email ?? '')
        setIdentiteNomConjoint(id.nom_conjoint ?? '')
        setIdentitePrenomConjoint(id.prenom_conjoint ?? '')
        setIdentiteTelConjoint(id.tel_conjoint ?? '')
        setIdentiteEmailConjoint(id.email_conjoint ?? '')
      }
    }).catch(() => { /* clé indisponible */ })
  }, [dossier.alias])

  // Auto-save
  const save = useCallback(() => {
    const updated = { ...dossier, updated_at: new Date().toISOString() }
    void sauvegarderDossier(updated)
      .then(() => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      })
      .catch(() => { /* session locked */ })
  }, [dossier])

  useEffect(() => {
    const t = setTimeout(save, 800)
    return () => clearTimeout(t)
  }, [dossier, save])

  // Auto-save identité (debounce 1.5s)
  const saveIdentite = useCallback(async () => {
    if (!identiteDisponible() || !identiteNom.trim() || !identitePrenom.trim()) return
    try {
      await sauvegarderIdentite({
        alias: dossier.alias,
        nom: identiteNom.trim(),
        prenom: identitePrenom.trim(),
        tel: identiteTel.trim() || undefined,
        email: identiteEmail.trim() || undefined,
        nom_conjoint: identiteNomConjoint.trim() || undefined,
        prenom_conjoint: identitePrenomConjoint.trim() || undefined,
        tel_conjoint: identiteTelConjoint.trim() || undefined,
        email_conjoint: identiteEmailConjoint.trim() || undefined,
      })
    } catch (err) {
      console.error('[SAISIE] Erreur sauvegarde identité:', err)
    }
  }, [dossier.alias, identiteNom, identitePrenom, identiteTel, identiteEmail,
      identiteNomConjoint, identitePrenomConjoint, identiteTelConjoint, identiteEmailConjoint])

  useEffect(() => {
    if (!identiteDisponible() || !identiteNom.trim()) return
    const t = setTimeout(() => void saveIdentite(), 1500)
    return () => clearTimeout(t)
  }, [identiteNom, identitePrenom, identiteTel, identiteEmail,
      identiteNomConjoint, identitePrenomConjoint, identiteTelConjoint, identiteEmailConjoint,
      saveIdentite])

  if (authLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Chargement...</div>

  const handleLaunchAudit = async () => {
    setLaunching(true)
    try {
      await sauvegarderDossier({ ...dossier, updated_at: new Date().toISOString() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* session locked */ }
    const json = normaliserPourPrompt(dossier)
    sessionStorage.setItem('audit_payload', json)
    sessionStorage.setItem('audit_alias', dossier.alias)
    router.push('/audit')
  }

  const stepComponents: Record<number, React.ReactNode> = {
    1: <StepIdentite
          d={dossier} setD={setDossier}
          identiteNom={identiteNom} setIdentiteNom={setIdentiteNom}
          identitePrenom={identitePrenom} setIdentitePrenom={setIdentitePrenom}
          identiteTel={identiteTel} setIdentiteTel={setIdentiteTel}
          identiteEmail={identiteEmail} setIdentiteEmail={setIdentiteEmail}
          identiteNomConjoint={identiteNomConjoint} setIdentiteNomConjoint={setIdentiteNomConjoint}
          identitePrenomConjoint={identitePrenomConjoint} setIdentitePrenomConjoint={setIdentitePrenomConjoint}
          identiteTelConjoint={identiteTelConjoint} setIdentiteTelConjoint={setIdentiteTelConjoint}
          identiteEmailConjoint={identiteEmailConjoint} setIdentiteEmailConjoint={setIdentiteEmailConjoint}
        />,
    2: <StepFamille    d={dossier} setD={setDossier} />,
    3: <StepRevenus    d={dossier} setD={setDossier} />,
    4: <StepImmo       d={dossier} setD={setDossier} />,
    5: <StepFinancier  d={dossier} setD={setDossier} />,
    6: <StepPrevoyance d={dossier} setD={setDossier} />,
    7: <StepObjectifs  d={dossier} setD={setDossier} />,
  }

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px', maxWidth: 720, margin: '0 auto', position: 'relative', zIndex: 1 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Saisie patrimoniale
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Dossier anonyme ·{' '}
            <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{dossier.alias}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && (
            <span style={{ fontSize: 11, color: 'var(--accent-emerald)' }}>✓ Sauvegardé</span>
          )}
          <button onClick={() => exporterDossierJSON(dossier)} className="btn-ghost" style={{ fontSize: 12 }}>
            ↓ Exporter JSON
          </button>
          <button onClick={() => router.push('/dossiers')} className="btn-ghost" style={{ fontSize: 12 }}>
            Mes dossiers
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, overflowX: 'auto', paddingBottom: 4 }}>
        {STEPS.map(s => {
          const isActive = s.id === step
          const isDone = s.id < step
          return (
            <button key={s.id} onClick={() => setStep(s.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 12px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap',
              flex: '1 0 auto', minWidth: 72,
              border: isActive ? '1px solid var(--accent-blue)' : '1px solid var(--border-glass)',
              background: isActive ? 'rgba(59,130,246,0.12)' : isDone ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: 16 }}>{isDone ? '✓' : s.icon}</span>
              <span style={{
                fontSize: 11, fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--accent-blue)' : isDone ? 'var(--accent-emerald)' : 'var(--text-muted)'
              }}>{s.label}</span>
            </button>
          )
        })}
      </div>

      {/* Contenu de l'étape */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{STEPS[step - 1].icon}</span>
          <span>{STEPS[step - 1].label}</span>
        </div>
        {stepComponents[step]}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          className="btn-ghost"
          style={{ opacity: step === 1 ? 0.3 : 1 }}
        >
          ← Précédent
        </button>

        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{step} / {STEPS.length}</span>

        {step < STEPS.length ? (
          <button onClick={() => setStep(s => Math.min(STEPS.length, s + 1))} className="btn-ghost">
            Suivant →
          </button>
        ) : (
          <button
            onClick={handleLaunchAudit}
            disabled={launching}
            style={{
              padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))',
              color: '#fff', fontWeight: 600, fontSize: 14,
              opacity: launching ? 0.7 : 1, transition: 'opacity 0.2s'
            }}
          >
            {launching ? '⏳ Lancement...' : '🚀 Générer l\'audit'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function SaisiePage() {
  return (
    <UnlockGate>
      <Suspense>
        <SaisieInner />
      </Suspense>
    </UnlockGate>
  )
}
