'use client';
import { AuthGate } from '@/components/auth-gate';

import { useState } from 'react';

/* ─── Level styles ─── */
const LEVEL = {
  autonomie:       { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  label: '🟢 Autonomie' },
  leger:           { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  label: '🟢 Protection légère' },
  leger_ext:       { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  label: '🟢 Conventionnel étendu' },
  assistance:      { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  label: '🟡 Assistance' },
  assistance_renf: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  label: '🟡 Assistance renforcée' },
  representation:  { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   label: '🔴 Représentation' },
  represent_par:   { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   label: '🔴 Représentation parentale' },
} as const;
type LevelKey = keyof typeof LEVEL;

/* ─── Regime type ─── */
type RegimeKey =
  | 'sauvegarde' | 'curatelle_simple' | 'curatelle_renforcee' | 'tutelle_majeur'
  | 'mpf_prive'  | 'mpf_auth'
  | 'hab_representation' | 'hab_assistance'
  | 'admin_legale' | 'tutelle_mineur' | 'emancipation';

interface RegimeData {
  key: RegimeKey;
  title: string;
  level: LevelKey;
  description: string;
  whoActs: string;
  duration: string;
  inventaire: string | false;
  compteRendu: string | false;
  avSpec: string;
  ref: string;
}

/* ─── Cell value ─── */
type CellValue = 'seul' | 'assistance' | 'juge' | 'impossible' | 'jugement' | 'na';

const CELL: Record<CellValue, { icon: string; label: string; color: string; bg: string }> = {
  seul:       { icon: '✅', label: 'Seul(e)',           color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
  assistance: { icon: '🤝', label: 'Avec assistance',   color: '#3B82F6', bg: 'rgba(59,130,246,0.1)'  },
  juge:       { icon: '⚖️', label: 'Autorisation juge', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)'  },
  impossible: { icon: '❌', label: 'Impossible',         color: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
  jugement:   { icon: '📋', label: 'Selon jugement',    color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
  na:         { icon: '—',  label: 'N/A',               color: '#475569', bg: 'transparent'            },
};

/* ─── Table columns
   idx: 0=admin_legale  1=tutelle_mineur  2=curatelle_simple  3=curatelle_renforcee
        4=tutelle_majeur  5=mpf_prive  6=mpf_auth  7=hab_representation  8=hab_assistance
─── */
const COLUMNS: { key: RegimeKey; short: string }[] = [
  { key: 'admin_legale',        short: 'Admin. légale' },
  { key: 'tutelle_mineur',      short: 'Tutelle mineur' },
  { key: 'curatelle_simple',    short: 'Curatelle simple' },
  { key: 'curatelle_renforcee', short: 'Curatelle renforcée' },
  { key: 'tutelle_majeur',      short: 'Tutelle majeur' },
  { key: 'mpf_prive',           short: 'MPF seing privé' },
  { key: 'mpf_auth',            short: 'MPF authentique' },
  { key: 'hab_representation',  short: 'Hab. représentation' },
  { key: 'hab_assistance',      short: 'Hab. assistance' },
];

/* ─── Table rows ─── */
interface ActeRow {
  label: string;
  cat: 'admin' | 'disposition';
  cells: CellValue[]; // length 9, aligned with COLUMNS
}

const ACTES: ActeRow[] = [
  /* ADMINISTRATION */
  { label: 'Conclusion/renouvellement bail habitation',        cat: 'admin',
    cells: ['seul','seul','seul','seul','seul','seul','seul','seul','assistance'] },
  { label: 'Travaux de réparation et entretien courant',       cat: 'admin',
    cells: ['seul','seul','seul','seul','seul','seul','seul','seul','assistance'] },
  { label: 'Actes conservatoires',                             cat: 'admin',
    cells: ['seul','seul','seul','seul','seul','seul','seul','seul','assistance'] },
  { label: 'Gestion portefeuille titres (avec remplacement)',  cat: 'admin',
    cells: ['seul','seul','seul','seul','seul','seul','seul','seul','assistance'] },
  { label: 'Paiement des dettes courantes',                    cat: 'admin',
    cells: ['seul','seul','seul','seul','seul','seul','seul','seul','assistance'] },
  { label: 'Acceptation clause bénéficiaire AV sans charge',   cat: 'admin',
    cells: ['seul','seul','seul','seul','seul','seul','seul','seul','assistance'] },
  { label: 'Conclusion contrat assurance biens / RC',          cat: 'admin',
    cells: ['seul','seul','seul','seul','seul','seul','seul','seul','assistance'] },
  /* DISPOSITION */
  { label: 'Souscription contrat assurance-vie',               cat: 'disposition',
    cells: ['seul','juge','assistance','assistance','juge','juge','seul','seul','assistance'] },
  { label: 'Désignation / substitution bénéficiaire AV',       cat: 'disposition',
    cells: ['seul','juge','assistance','assistance','juge','juge','seul','seul','assistance'] },
  { label: 'Versement nouvelles primes sur AV',                cat: 'disposition',
    cells: ['seul','juge','assistance','assistance','juge','impossible','seul','seul','assistance'] },
  { label: 'Rachat partiel ou total AV',                       cat: 'disposition',
    cells: ['seul','juge','assistance','assistance','juge','impossible','seul','seul','assistance'] },
  { label: 'Avance sur contrat AV',                            cat: 'disposition',
    cells: ['seul','juge','assistance','assistance','juge','juge','seul','seul','assistance'] },
  { label: 'Vente bien immobilier',                            cat: 'disposition',
    cells: ['juge','juge','assistance','assistance','juge','impossible','seul','seul','assistance'] },
  { label: 'Donation',                                         cat: 'disposition',
    cells: ['juge','juge','assistance','assistance','juge','impossible','impossible','juge','juge'] },
  { label: 'Testament',                                        cat: 'disposition',
    cells: ['na','na','seul','seul','juge','seul','seul','juge','seul'] },
  { label: 'Emprunt',                                          cat: 'disposition',
    cells: ['juge','juge','assistance','assistance','juge','impossible','seul','juge','juge'] },
  { label: 'Cession portefeuille titres pleine propriété',     cat: 'disposition',
    cells: ['juge','juge','assistance','assistance','juge','impossible','seul','seul','assistance'] },
  { label: 'Retrait sur livret A',                             cat: 'disposition',
    cells: ['seul','seul','seul','seul','seul','impossible','seul','seul','assistance'] },
];

/* ─── Regime data ─── */
const REGIMES: RegimeData[] = [
  {
    key: 'sauvegarde', title: 'Sauvegarde de justice', level: 'leger',
    description: "Mesure légère et temporaire. La personne conserve sa pleine capacité juridique, mais ses actes peuvent être rescindés pour lésion.",
    whoActs: 'La personne protégée seule — actes rescindables pour lésion',
    duration: '1 an max, renouvelable 1 fois',
    inventaire: false, compteRendu: false,
    avSpec: 'Pouvoirs selon jugement. Mandataire spécial possible pour actes déterminés.',
    ref: 'Art. 433 c.civ.',
  },
  {
    key: 'curatelle_simple', title: 'Curatelle simple', level: 'assistance',
    description: "La personne accomplit seule les actes d'administration, mais doit être assistée du curateur pour les actes de disposition.",
    whoActs: 'Seul pour administration · Avec curateur pour disposition',
    duration: "5 ans (jusqu'à 20 ans si irréversible)",
    inventaire: false, compteRendu: false,
    avSpec: 'Souscription, désignation bénéficiaire, rachats, versements primes : assistance curateur obligatoire.',
    ref: 'Art. 440 c.civ.',
  },
  {
    key: 'curatelle_renforcee', title: 'Curatelle renforcée', level: 'assistance_renf',
    description: "En plus des règles de la curatelle simple, le curateur perçoit les revenus et règle les dépenses de la personne protégée.",
    whoActs: 'Curateur perçoit revenus et règle dépenses · Disposition : avec curateur',
    duration: "5 ans (jusqu'à 20 ans si irréversible)",
    inventaire: '3 mois (meubles) / 6 mois (autres biens)',
    compteRendu: 'Annuel',
    avSpec: 'Mêmes règles que curatelle simple. Curateur contrôle tous les flux financiers.',
    ref: 'Art. 472 c.civ.',
  },
  {
    key: 'tutelle_majeur', title: 'Tutelle (majeur)', level: 'representation',
    description: "Mesure de représentation totale. Le tuteur agit seul pour l'administration. Les actes de disposition requièrent une autorisation du juge.",
    whoActs: 'Tuteur seul (administration) · Tuteur + autorisation juge (disposition)',
    duration: "5 ans (jusqu'à 20 ans si irréversible)",
    inventaire: '3 mois (meubles) / 6 mois (autres biens)',
    compteRendu: 'Annuel + budget prévisionnel (6 mois)',
    avSpec: 'Toute opération AV (souscription, désignation bénéficiaire, rachat, versement primes) : autorisation juge.',
    ref: 'Art. 440 al.3 c.civ.',
  },
  {
    key: 'mpf_prive', title: 'MPF — Seing privé', level: 'leger',
    description: "Mandat de protection future sous seing privé. Le mandataire est strictement limité aux actes d'administration.",
    whoActs: "Mandataire (actes administration uniquement) · Mandant conserve pleine capacité",
    duration: 'Selon les termes du mandat',
    inventaire: false, compteRendu: 'Selon mandat',
    avSpec: "Rachat AV ❌ · Versement primes ❌ · Retrait livret A ❌ → mandant agit lui-même ou recourir au mandat authentique.",
    ref: 'Art. 477 c.civ.',
  },
  {
    key: 'mpf_auth', title: 'MPF — Authentique (notarié)', level: 'leger_ext',
    description: "Mandat notarié conférant au mandataire tous les pouvoirs d'un tuteur, sauf les actes à titre gratuit.",
    whoActs: "Mandataire (tous pouvoirs tuteur sauf gratuits) · Mandant conserve pleine capacité",
    duration: 'Selon les termes du mandat',
    inventaire: false, compteRendu: 'Selon mandat',
    avSpec: "Rachat AV ✅ · Versement primes ✅ · Retrait livret A ✅ · Donation ❌",
    ref: 'Art. 477 c.civ. · Décret 16 nov. 2024 (registre)',
  },
  {
    key: 'hab_representation', title: 'Habilitation familiale — Représentation', level: 'representation',
    description: "La personne de la famille habilitée par le juge représente le majeur pour les actes déterminés dans la décision.",
    whoActs: "Personne habilitée seule, dans la limite des actes désignés par le juge",
    duration: 'Selon décision du juge',
    inventaire: false, compteRendu: false,
    avSpec: "Selon l'étendue de l'habilitation accordée par le juge des tutelles.",
    ref: 'Art. 494-1 c.civ.',
  },
  {
    key: 'hab_assistance', title: 'Habilitation familiale — Assistance', level: 'assistance',
    description: "Le majeur et la personne habilitée agissent conjointement pour les actes déterminés dans la décision du juge.",
    whoActs: "Majeur + personne habilitée ensemble, pour les actes désignés",
    duration: 'Selon décision du juge',
    inventaire: false, compteRendu: false,
    avSpec: "Majeur et personne habilitée agissent conjointement pour les opérations AV visées.",
    ref: 'Art. 494-1 c.civ.',
  },
  /* Mineurs */
  {
    key: 'admin_legale', title: 'Administration légale (mineur)', level: 'represent_par',
    description: "Les parents exercent l'administration légale des biens du mineur sous le contrôle du juge des tutelles.",
    whoActs: "Parent(s) seul(s) (administration) · Juge pour actes importants",
    duration: "Jusqu'à la majorité (18 ans)",
    inventaire: false, compteRendu: false,
    avSpec: "Souscription : parent seul (AP seule) ou ensemble (AP conjointe). Rachat important : autorisation juge.",
    ref: 'Art. 382 c.civ.',
  },
  {
    key: 'tutelle_mineur', title: 'Tutelle (mineur)', level: 'representation',
    description: "Ouverte en l'absence d'administration légale (parents décédés ou déchus). Le tuteur représente le mineur.",
    whoActs: "Tuteur seul · Conseil de famille pour actes importants",
    duration: "Jusqu'à la majorité (18 ans)",
    inventaire: false, compteRendu: false,
    avSpec: "Souscription AV : accord du conseil de famille requis.",
    ref: 'Art. 390 c.civ.',
  },
  {
    key: 'emancipation', title: 'Émancipation (mineur ≥ 16 ans)', level: 'autonomie',
    description: "Le mineur émancipé est traité comme un majeur pour tous les actes de la vie civile.",
    whoActs: "Mineur seul — capacité équivalente à un majeur",
    duration: "Jusqu'à la majorité (18 ans)",
    inventaire: false, compteRendu: false,
    avSpec: "Tous actes patrimoniaux comme un majeur sans mesure de protection.",
    ref: 'Art. 413-1 c.civ.',
  },
];

/* ─── Wizard options ─── */
const MINEUR_OPTIONS: { value: RegimeKey; label: string }[] = [
  { value: 'admin_legale',   label: 'Sous autorité parentale (administration légale)' },
  { value: 'tutelle_mineur', label: 'En tutelle (parents décédés ou déchus)' },
  { value: 'emancipation',   label: 'Émancipé(e) (≥ 16 ans, décision JAF)' },
];

const ADULTE_OPTIONS: { value: RegimeKey; label: string }[] = [
  { value: 'sauvegarde',          label: 'Sauvegarde de justice' },
  { value: 'curatelle_simple',    label: 'Curatelle simple' },
  { value: 'curatelle_renforcee', label: 'Curatelle renforcée' },
  { value: 'tutelle_majeur',      label: 'Tutelle' },
  { value: 'mpf_prive',           label: 'Mandat de protection future — seing privé' },
  { value: 'mpf_auth',            label: 'Mandat de protection future — authentique (notarié)' },
  { value: 'hab_representation',  label: 'Habilitation familiale — représentation' },
  { value: 'hab_assistance',      label: 'Habilitation familiale — assistance' },
];

/* ─── Points d'attention ─── */
interface AlertCard { level: 'error' | 'warning' | 'info'; icon: string; title: string; ref?: string; body: string }

const ALERT_CARDS: AlertCard[] = [
  { level: 'error', icon: '🔴', title: 'Logement de la personne protégée', ref: 'Art. 426 c.civ.',
    body: "Même le tuteur ou le curateur ne peut disposer des droits relatifs au logement de la personne protégée sans une autorisation préalable du juge des tutelles. Cette protection est absolue." },
  { level: 'error', icon: '🔴', title: 'Assurance-vie = acte de disposition', ref: 'Décret 22/12/2008',
    body: "Souscrire un contrat AV, désigner un bénéficiaire, verser des primes ou effectuer un rachat sont tous des actes de DISPOSITION selon le décret du 22 décembre 2008. Ne pas les traiter comme de simples actes d'administration." },
  { level: 'warning', icon: '🟡', title: 'MPF seing privé : pouvoirs strictement limités', ref: 'Art. 477 c.civ.',
    body: "Le mandataire sous seing privé ne peut accomplir QUE des actes d'administration. Pour toute opération sur l'assurance-vie (rachat, versements, retrait livret A), il faut un mandat notarié (authentique) ou que le mandant agisse lui-même." },
  { level: 'warning', icon: '🟡', title: 'Comptes bancaires : fermeture interdite sans juge', ref: 'Art. 427 c.civ.',
    body: "Il est interdit de clôturer un compte ou un livret sans autorisation du juge des tutelles. En revanche, l'ouverture d'un compte dans un nouvel établissement est autorisée depuis la loi de 2018." },
  { level: 'warning', icon: '🟡', title: 'Testament sous tutelle : autorisation préalable obligatoire',
    body: "Le tuteur ne peut ni assister ni représenter le majeur en tutelle pour tester. Le majeur doit obtenir une autorisation préalable du juge des tutelles (ou du conseil de famille). Sans cette autorisation, le testament est nul." },
  { level: 'info', icon: '🟢', title: 'Registre des mandats de protection future', ref: 'Décret 16 nov. 2024',
    body: "Le décret du 16 novembre 2024 a créé un registre central des mandats de protection future, renforçant considérablement leur opposabilité aux tiers et leur efficacité pratique." },
  { level: 'info', icon: '🟢', title: 'Principe de subsidiarité du MPF',
    body: "Une fois activé, le mandat de protection future écarte l'ouverture d'une tutelle ou de toute autre mesure de protection judiciaire, sauf si le mandat porte atteinte aux intérêts du mandant." },
];

/* ─── Shared styles ─── */
const labelMuted: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem',
};

/* ─── LevelBadge ─── */
function LevelBadge({ lk }: { lk: LevelKey }) {
  const s = LEVEL[lk];
  return (
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.7rem', borderRadius: 20,
      fontSize: '0.72rem', fontWeight: 700, color: s.color,
      background: s.bg, border: `1px solid ${s.color}40`,
    }}>
      {s.label}
    </span>
  );
}

/* ─── RegimeFiche card ─── */
function RegimeFiche({ r }: { r: RegimeData }) {
  const s = LEVEL[r.level];
  return (
    <div style={{
      borderRadius: 10, padding: '1.25rem',
      border: `1px solid rgba(255,255,255,0.08)`,
      borderLeft: `4px solid ${s.color}`,
      background: 'rgba(255,255,255,0.03)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: '0.625rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{r.title}</h3>
        <LevelBadge lk={r.level} />
      </div>
      <p style={{ margin: '0 0 1rem', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.description}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.875rem' }}>
        <InfoCell label="Qui agit" value={r.whoActs} />
        <InfoCell label="Durée" value={r.duration} />
        {r.inventaire !== false && <InfoCell label="Inventaire" value={r.inventaire} />}
        {r.compteRendu !== false && <InfoCell label="Compte rendu" value={r.compteRendu} />}
      </div>

      <div style={{ padding: '0.75rem', borderRadius: 6, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: '0.625rem' }}>
        <p style={{ margin: '0 0 0.15rem', fontSize: '0.72rem', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assurance-vie</p>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{r.avSpec}</p>
      </div>

      <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.ref}</p>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
      <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{value}</p>
    </div>
  );
}

/* ─── ChoiceBtn ─── */
function ChoiceBtn({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left',
      padding: '0.75rem 1rem', marginBottom: 6, borderRadius: 8,
      border: `2px solid ${selected ? '#6366F1' : 'rgba(255,255,255,0.1)'}`,
      background: selected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
      color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: selected ? 600 : 400,
      cursor: 'pointer', transition: 'all 0.15s',
    }}>
      {label}
    </button>
  );
}

/* ─── Tab 1 — Wizard ─── */
function TabWizard() {
  const [age, setAge] = useState<'mineur' | 'majeur' | null>(null);
  const [regime, setRegime] = useState<RegimeKey | null>(null);
  const regimeData = regime ? REGIMES.find(r => r.key === regime) : null;

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Q1 */}
      <p style={labelMuted}>Question 1 — La personne est…</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem' }}>
        {([['mineur', 'Mineure (< 18 ans)'], ['majeur', 'Majeure (≥ 18 ans)']] as const).map(([val, lbl]) => (
          <button key={val} onClick={() => { setAge(val); setRegime(null); }} style={{
            flex: 1, padding: '0.875rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
            border: `2px solid ${age === val ? '#6366F1' : 'rgba(255,255,255,0.1)'}`,
            background: age === val ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
            color: 'var(--text-primary)', transition: 'all 0.15s',
          }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Q2 */}
      {age && !regime && (
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={labelMuted}>Question 2 — Mesure de protection…</p>
          {(age === 'mineur' ? MINEUR_OPTIONS : ADULTE_OPTIONS).map(o => (
            <ChoiceBtn key={o.value} selected={false} onClick={() => setRegime(o.value)} label={o.label} />
          ))}
        </div>
      )}

      {/* Result */}
      {regime && regimeData && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Régime identifié :</p>
            <button onClick={() => { setAge(null); setRegime(null); }} style={{
              padding: '0.3rem 0.875rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem',
            }}>
              Recommencer
            </button>
          </div>
          <RegimeFiche r={regimeData} />
        </div>
      )}
    </div>
  );
}

/* ─── Tab 2 — Table ─── */
function TabActes() {
  const [filter, setFilter] = useState('all');

  const visibleCols = filter === 'all' ? COLUMNS : COLUMNS.filter(c => c.key === filter);

  // Flatten rows with section headers
  type TableItem =
    | { type: 'header'; cat: 'admin' | 'disposition' }
    | { type: 'row'; acte: ActeRow; idx: number };

  const items: TableItem[] = [];
  let lastCat: string | null = null;
  ACTES.forEach((acte, idx) => {
    if (acte.cat !== lastCat) { items.push({ type: 'header', cat: acte.cat }); lastCat = acte.cat; }
    items.push({ type: 'row', acte, idx });
  });

  return (
    <div>
      {/* Filter + Legend */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <p style={{ ...labelMuted, marginBottom: '0.4rem' }}>Filtrer par régime</p>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{
            padding: '0.4rem 0.875rem', borderRadius: 6, fontSize: '0.875rem', cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)',
          }}>
            <option value="all">Tous les régimes</option>
            {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.short}</option>)}
          </select>
        </div>
        <div>
          <p style={{ ...labelMuted, marginBottom: '0.4rem' }}>Légende</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(Object.entries(CELL) as [CellValue, typeof CELL[CellValue]][]).filter(([k]) => k !== 'na').map(([, v]) => (
              <span key={v.label} style={{ fontSize: '0.72rem', color: v.color, background: v.bg, padding: '0.2rem 0.6rem', borderRadius: 4, border: `1px solid ${v.color}30` }}>
                {v.icon} {v.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: filter === 'all' ? 860 : 360 }}>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: 'left', width: 220 }}>Acte</th>
              {visibleCols.map(c => <th key={c.key} style={{ ...thBase, minWidth: 90 }}>{c.short}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              if (item.type === 'header') {
                const isAdmin = item.cat === 'admin';
                return (
                  <tr key={`h-${i}`}>
                    <td colSpan={visibleCols.length + 1} style={{
                      padding: '0.5rem 0.75rem', fontSize: '0.7rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: isAdmin ? '#60A5FA' : '#FCD34D',
                      background: isAdmin ? 'rgba(59,130,246,0.08)' : 'rgba(245,158,11,0.08)',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      {isAdmin ? "Actes d'administration" : "Actes de disposition"}
                    </td>
                  </tr>
                );
              }
              const { acte } = item;
              return (
                <tr key={`r-${i}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.55rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', verticalAlign: 'middle' }}>
                    {acte.label}
                  </td>
                  {visibleCols.map(col => {
                    const colIdx = COLUMNS.findIndex(c => c.key === col.key);
                    const cv = acte.cells[colIdx];
                    const d = CELL[cv];
                    return (
                      <td key={col.key} title={d.label} style={{
                        padding: '0.5rem', textAlign: 'center', verticalAlign: 'middle',
                        background: d.bg, fontSize: '1rem',
                      }}>
                        {d.icon}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thBase: React.CSSProperties = {
  padding: '0.55rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, textAlign: 'center',
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
  borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)',
  whiteSpace: 'normal',
};

/* ─── Tab 3 — Fiches régimes ─── */
function TabFiches() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
      {REGIMES.map(r => <RegimeFiche key={r.key} r={r} />)}
    </div>
  );
}

/* ─── Tab 4 — Points d'attention ─── */
function TabAlertes() {
  const palette = {
    error:   { border: '#EF4444', bg: 'rgba(239,68,68,0.08)',   title: '#FCA5A5' },
    warning: { border: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  title: '#FCD34D' },
    info:    { border: '#10B981', bg: 'rgba(16,185,129,0.08)',  title: '#6EE7B7' },
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {ALERT_CARDS.map((c, i) => {
        const p = palette[c.level];
        return (
          <div key={i} style={{
            padding: '1.25rem', borderRadius: 10,
            border: `1px solid ${p.border}30`,
            borderLeft: `4px solid ${p.border}`,
            background: p.bg,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: p.title }}>
                {c.icon} {c.title}
              </h3>
              {c.ref && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '0.15rem 0.5rem', borderRadius: 4 }}>
                  {c.ref}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.body}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Tabs config ─── */
const TABS = [
  { id: 'regime',  label: 'Quel régime ?',           icon: '🧭' },
  { id: 'actes',   label: 'Puis-je faire cet acte ?', icon: '📋' },
  { id: 'fiches',  label: 'Fiches régimes',           icon: '📂' },
  { id: 'alertes', label: "Points d'attention",       icon: '⚠️' },
];

/* ─── Page ─── */
export default function PersonnesProtegeesPage() {
  const [tab, setTab] = useState('regime');

  return (
    <AuthGate>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 1.25rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <p style={{
          fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem',
        }}>
          Audit Patrimoine · Axe civil
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
          fontWeight: 600, color: 'var(--text-primary)',
          letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0,
        }}>
          Personnes protégées
        </h1>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 560 }}>
          Mineurs · Curatelle · Tutelle · MPF — Régimes, actes autorisés et assurance-vie.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: '1.75rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '0.625rem 1.125rem', background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: '0.875rem', fontWeight: tab === t.id ? 700 : 400, whiteSpace: 'nowrap',
            color: tab === t.id ? '#6366F1' : 'var(--text-secondary)',
            borderBottom: `2px solid ${tab === t.id ? '#6366F1' : 'transparent'}`,
            marginBottom: -1, transition: 'color 0.15s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="glass-card" style={{ padding: '1.75rem' }}>
        {tab === 'regime'  && <TabWizard />}
        {tab === 'actes'   && <TabActes />}
        {tab === 'fiches'  && <TabFiches />}
        {tab === 'alertes' && <TabAlertes />}
      </div>
    </div>
    </AuthGate>
  );
}
