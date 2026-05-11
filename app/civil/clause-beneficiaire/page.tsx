'use client';

import { useState } from 'react';

/* ─── Types ─── */
interface WizardState {
  situationMatrimoniale: string;
  nombreEnfants: number;
  enfantsMineurs: boolean;
  enfantsNonCommuns: boolean;
  enfantHandicape: boolean;
  parentsVivants: boolean;
  objectifs: string[];
  typeClause: string;
  quotiteOption: string;
  clauseRepresentation: string;
  mentionHeritiers: string;
}

interface ClauseResult {
  variante_simple: string;
  variante_intermediaire: string;
  variante_complete: string;
  points_vigilance: string[];
  conseil_notaire: boolean;
  raison_conseil_notaire: string;
}

interface Alert {
  type: 'warning' | 'info';
  title: string;
  message: string;
}

/* ─── Constants ─── */
const INITIAL_STATE: WizardState = {
  situationMatrimoniale: '',
  nombreEnfants: 0,
  enfantsMineurs: false,
  enfantsNonCommuns: false,
  enfantHandicape: false,
  parentsVivants: false,
  objectifs: [],
  typeClause: '',
  quotiteOption: '',
  clauseRepresentation: 'oui',
  mentionHeritiers: 'oui',
};

const SITUATION_OPTIONS = [
  { value: 'celibataire', label: 'Célibataire' },
  { value: 'marie_communaute', label: 'Marié — communauté' },
  { value: 'marie_separation', label: 'Marié — séparation de biens' },
  { value: 'pacse', label: 'Pacsé(e)' },
  { value: 'divorce', label: 'Divorcé(e)' },
  { value: 'veuf', label: 'Veuf / Veuve' },
];

const OBJECTIF_OPTIONS = [
  { value: 'proteger_conjoint', label: 'Protéger le conjoint / partenaire', icon: '💑' },
  { value: 'transmettre_enfants', label: 'Transmettre aux enfants', icon: '👨‍👩‍👧‍👦' },
  { value: 'reduire_droits', label: 'Réduire les droits de succession', icon: '⚖️' },
  { value: 'proteger_handicap', label: 'Protéger un enfant handicapé', icon: '🤝' },
  { value: 'eviter_conflits', label: 'Prévenir les conflits familiaux', icon: '🕊️' },
  { value: 'optimisation_fiscale', label: 'Optimisation fiscale', icon: '📊' },
];

const TYPE_CLAUSE_OPTIONS = [
  {
    value: 'standard',
    label: 'Clause standard',
    description: 'Désignation par lien de parenté (conjoint, enfants, héritiers)',
    exemple: 'Mon conjoint, à défaut mes enfants nés ou à naître, vivants ou représentés…',
  },
  {
    value: 'quotites',
    label: 'Clause avec quotités',
    description: 'Répartition en pourcentage entre plusieurs bénéficiaires nommément désignés',
    exemple: 'Mon conjoint pour 50 %, mes enfants pour 50 % par parts égales…',
  },
  {
    value: 'demembre',
    label: 'Clause démembrée',
    description: 'Quasi-usufruit au conjoint survivant, nue-propriété aux enfants',
    exemple: 'Mon conjoint en quasi-usufruit et mes enfants en nue-propriété, à parts égales…',
  },
  {
    value: 'condition_age',
    label: "Clause à condition d'âge",
    description: "Attribution conditionnelle selon l'âge ou la capacité juridique du bénéficiaire",
    exemple: 'Mes enfants si majeurs et capables au jour du décès, sinon mes héritiers légaux…',
  },
];

const QUOTITE_OPTIONS = [
  { value: 'conjoint_100', label: 'Conjoint 100 %' },
  { value: 'conjoint_50_enfants_50', label: 'Conjoint 50 %, Enfants 50 %' },
  { value: 'conjoint_tiers_enfants_2tiers', label: 'Conjoint 1/3, Enfants 2/3' },
  { value: 'enfants_100', label: 'Enfants 100 % par parts égales' },
];

const STEP_LABELS = ['Situation', 'Objectifs', 'Type de clause', 'Personnalisation', 'Résultats'];

const PEDAGOGY_TIPS = [
  "La clause peut être modifiée à tout moment tant que le bénéficiaire n'a pas accepté.",
  "Une désignation nominative (nom + prénom + date de naissance) est plus sûre qu'une désignation qualitative.",
  "Sans clause valide, le capital intègre la succession et est taxé.",
  "L'art. 990 I CGI exonère jusqu'à 152 500 € par bénéficiaire pour les primes versées avant 70 ans.",
];

/* ─── Alert computation ─── */
function computeAlerts(state: WizardState): Alert[] {
  const alerts: Alert[] = [];

  if (state.enfantsMineurs) {
    alerts.push({
      type: 'warning',
      title: 'Enfants mineurs',
      message: "Le tuteur légal gérera le capital jusqu'à la majorité. Une clause de représentation est indispensable.",
    });
  }

  if (state.enfantHandicape) {
    alerts.push({
      type: 'info',
      title: 'Enfant handicapé',
      message: 'Une structure spécialisée (MJPM, association habilitée) peut être désignée bénéficiaire. Consultez un notaire.',
    });
  }

  if (state.enfantsNonCommuns && ['marie_communaute', 'marie_separation', 'pacse'].includes(state.situationMatrimoniale)) {
    alerts.push({
      type: 'warning',
      title: 'Famille recomposée',
      message: "Désigner uniquement le conjoint peut léser les enfants du premier lit. Réfléchissez aux quotités.",
    });
  }

  if (state.typeClause === 'demembre') {
    alerts.push({
      type: 'info',
      title: 'Démembrement de clause',
      message: "Le nu-propriétaire dispose d'une créance de restitution. Une rédaction notariale est fortement conseillée.",
    });
  }

  if (state.situationMatrimoniale === 'celibataire' && state.nombreEnfants === 0 && !state.parentsVivants) {
    alerts.push({
      type: 'info',
      title: 'Sans ayants droit proches',
      message: "Désignez un bénéficiaire précis. Sans clause valide, le capital intègre la succession taxable.",
    });
  }

  return alerts;
}

function canProceed(step: number, state: WizardState): boolean {
  if (step === 1) return state.situationMatrimoniale !== '';
  if (step === 2) return state.objectifs.length > 0;
  if (step === 3) return state.typeClause !== '';
  return true;
}

/* ─── Shared styles ─── */
const h2Style: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 600,
  color: 'var(--text-primary)',
  margin: '0 0 0.25rem',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--text-secondary)',
  margin: '0 0 1.5rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: '0.625rem',
};

/* ─── Stepper ─── */
function Stepper({ currentStep, labels }: { currentStep: number; labels: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '2rem' }}>
      {labels.map((label, i) => {
        const stepNum = i + 1;
        const done = stepNum < currentStep;
        const active = stepNum === currentStep;
        const isLast = i === labels.length - 1;

        return (
          <div key={stepNum} style={{ display: 'flex', alignItems: 'flex-start', flex: isLast ? 'none' : 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: done ? '#10B981' : active ? '#F59E0B' : 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.78rem', fontWeight: 700,
                color: (done || active) ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'background 0.2s',
              }}>
                {done ? '✓' : stepNum}
              </div>
              <span style={{
                marginTop: 5, fontSize: '0.65rem', textAlign: 'center', whiteSpace: 'nowrap',
                color: active ? '#F59E0B' : 'rgba(255,255,255,0.35)',
                fontWeight: active ? 600 : 400,
              }}>
                {label}
              </span>
            </div>
            {!isLast && (
              <div style={{
                flex: 1, height: 2, marginTop: 14, marginLeft: 4, marginRight: 4,
                background: done ? '#10B981' : 'rgba(255,255,255,0.1)',
                transition: 'background 0.2s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── ChoiceCard ─── */
function ChoiceCard({ selected, onClick, label, description, exemple, icon }: {
  selected: boolean;
  onClick: () => void;
  label: string;
  description?: string;
  exemple?: string;
  icon?: string;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      style={{
        padding: '0.875rem 1rem',
        borderRadius: 8,
        border: `2px solid ${selected ? '#F59E0B' : 'rgba(255,255,255,0.1)'}`,
        background: selected ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
        <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{label}</span>
      </div>
      {description && (
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {description}
        </p>
      )}
      {exemple && (
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
          Ex. : {exemple}
        </p>
      )}
    </div>
  );
}

/* ─── Toggle buttons (oui/non) ─── */
function YesNoToggle({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {['oui', 'non'].map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: '0.4rem 1.25rem',
              borderRadius: 6,
              border: `1.5px solid ${value === opt ? '#F59E0B' : 'rgba(255,255,255,0.15)'}`,
              background: value === opt ? 'rgba(245,158,11,0.12)' : 'transparent',
              color: value === opt ? '#F59E0B' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: value === opt ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Steps ─── */
function Step1({ state, setState }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  return (
    <div>
      <h2 style={h2Style}>Situation familiale</h2>
      <p style={subtitleStyle}>Indiquez votre situation pour personnaliser la clause bénéficiaire.</p>

      <div style={{ marginBottom: '1.75rem' }}>
        <label style={labelStyle}>Situation matrimoniale *</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {SITUATION_OPTIONS.map(opt => (
            <ChoiceCard
              key={opt.value}
              selected={state.situationMatrimoniale === opt.value}
              onClick={() => setState(s => ({ ...s, situationMatrimoniale: opt.value }))}
              label={opt.label}
            />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '1.75rem' }}>
        <label style={labelStyle}>Nombre d&apos;enfants</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => setState(s => ({ ...s, nombreEnfants: Math.max(0, s.nombreEnfants - 1) }))}
            style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
          >
            −
          </button>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: 28, textAlign: 'center' }}>
            {state.nombreEnfants}
          </span>
          <button
            onClick={() => setState(s => ({ ...s, nombreEnfants: s.nombreEnfants + 1 }))}
            style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
          >
            +
          </button>
        </div>
      </div>

      {state.nombreEnfants > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.25rem' }}>
          {([
            ['enfantsMineurs', 'Certains enfants sont encore mineurs'],
            ['enfantsNonCommuns', 'Famille recomposée (enfants non communs)'],
            ['enfantHandicape', 'Enfant en situation de handicap'],
          ] as [keyof WizardState, string][]).map(([field, label]) => (
            <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={!!state[field]}
                onChange={() => setState(s => ({ ...s, [field]: !s[field] }))}
                style={{ width: 16, height: 16, accentColor: '#F59E0B', flexShrink: 0 }}
              />
              {label}
            </label>
          ))}
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        <input
          type="checkbox"
          checked={state.parentsVivants}
          onChange={() => setState(s => ({ ...s, parentsVivants: !s.parentsVivants }))}
          style={{ width: 16, height: 16, accentColor: '#F59E0B', flexShrink: 0 }}
        />
        Vos parents (père / mère) sont encore en vie
      </label>
    </div>
  );
}

function Step2({ state, setState }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  const toggle = (value: string) => {
    setState(s => ({
      ...s,
      objectifs: s.objectifs.includes(value)
        ? s.objectifs.filter(o => o !== value)
        : [...s.objectifs, value],
    }));
  };

  return (
    <div>
      <h2 style={h2Style}>Objectifs patrimoniaux</h2>
      <p style={subtitleStyle}>Sélectionnez un ou plusieurs objectifs (au moins 1 requis).</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {OBJECTIF_OPTIONS.map(opt => (
          <ChoiceCard
            key={opt.value}
            selected={state.objectifs.includes(opt.value)}
            onClick={() => toggle(opt.value)}
            label={opt.label}
            icon={opt.icon}
          />
        ))}
      </div>
    </div>
  );
}

function Step3({ state, setState }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  return (
    <div>
      <h2 style={h2Style}>Type de clause</h2>
      <p style={subtitleStyle}>Choisissez la structure de la clause bénéficiaire.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TYPE_CLAUSE_OPTIONS.map(opt => (
          <ChoiceCard
            key={opt.value}
            selected={state.typeClause === opt.value}
            onClick={() => setState(s => ({ ...s, typeClause: opt.value }))}
            label={opt.label}
            description={opt.description}
            exemple={opt.exemple}
          />
        ))}
      </div>
    </div>
  );
}

function Step4({ state, setState }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  return (
    <div>
      <h2 style={h2Style}>Personnalisation</h2>
      <p style={subtitleStyle}>Affinez les options de rédaction.</p>

      {state.typeClause === 'quotites' && (
        <div style={{ marginBottom: '1.75rem' }}>
          <label style={labelStyle}>Répartition souhaitée</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {QUOTITE_OPTIONS.map(opt => (
              <ChoiceCard
                key={opt.value}
                selected={state.quotiteOption === opt.value}
                onClick={() => setState(s => ({ ...s, quotiteOption: opt.value }))}
                label={opt.label}
              />
            ))}
          </div>
        </div>
      )}

      {state.typeClause === 'demembre' && (
        <div style={{ padding: '0.875rem 1rem', borderRadius: 8, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', marginBottom: '1.75rem' }}>
          <p style={{ margin: 0, fontSize: '0.825rem', color: 'rgba(139,92,246,0.9)', lineHeight: 1.5 }}>
            <strong>Clause démembrée :</strong> le conjoint bénéficiera d&apos;un quasi-usufruit (usage du capital) et les enfants d&apos;une créance de restitution en nue-propriété. Une rédaction précise par un notaire est vivement recommandée.
          </p>
        </div>
      )}

      <YesNoToggle
        label="Clause de représentation par souche"
        value={state.clauseRepresentation}
        onChange={v => setState(s => ({ ...s, clauseRepresentation: v }))}
      />

      <YesNoToggle
        label="Mention de renvoi aux héritiers légaux (dernier rang)"
        value={state.mentionHeritiers}
        onChange={v => setState(s => ({ ...s, mentionHeritiers: v }))}
      />
    </div>
  );
}

function Step5({ state, result, loading, error, onGenerate, onReset }: {
  state: WizardState;
  result: ClauseResult | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(key); setTimeout(() => setCopied(null), 2000); })
      .catch(() => {});
  };

  const LABELS_SITUATION: Record<string, string> = {
    celibataire: 'Célibataire', marie_communaute: 'Marié — communauté',
    marie_separation: 'Marié — séparation', pacse: 'Pacsé(e)', divorce: 'Divorcé(e)', veuf: 'Veuf / Veuve',
  };
  const LABELS_TYPE: Record<string, string> = {
    standard: 'Standard', quotites: 'Avec quotités', demembre: 'Démembrée', condition_age: "Condition d'âge",
  };

  const summaryItems = [
    { label: 'Situation', value: LABELS_SITUATION[state.situationMatrimoniale] ?? state.situationMatrimoniale },
    { label: 'Enfants', value: state.nombreEnfants.toString() },
    { label: 'Objectifs', value: `${state.objectifs.length} sélectionné(s)` },
    { label: 'Type de clause', value: LABELS_TYPE[state.typeClause] ?? state.typeClause },
  ];

  const variants = result ? [
    { key: 'simple', label: 'Clause simple', text: result.variante_simple, color: '#10B981' },
    { key: 'intermediaire', label: 'Clause intermédiaire', text: result.variante_intermediaire, color: '#3B82F6' },
    { key: 'complete', label: 'Clause complète', text: result.variante_complete, color: '#F59E0B' },
  ] : [];

  return (
    <div>
      <h2 style={h2Style}>Récapitulatif & génération</h2>
      <p style={subtitleStyle}>Vérifiez vos choix, puis générez vos clauses.</p>

      {/* Summary */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem',
        padding: '1rem 1.25rem', borderRadius: 8,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        marginBottom: '1.75rem',
      }}>
        {summaryItems.map(({ label, value }) => (
          <div key={label}>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>{value || '—'}</p>
          </div>
        ))}
      </div>

      {/* Generate */}
      {!result && !loading && (
        <button onClick={onGenerate} className="btn-primary" style={{ width: '100%', padding: '0.875rem', fontSize: '1rem' }}>
          Générer les clauses →
        </button>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem', animation: 'spin 1.5s linear infinite' }}>⏳</div>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Génération de vos clauses en cours…</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cela prend quelques secondes.</p>
        </div>
      )}

      {error && !loading && (
        <div>
          <div style={{ padding: '1rem', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: '1rem' }}>
            <p style={{ margin: 0, color: '#EF4444', fontSize: '0.875rem' }}>{error}</p>
          </div>
          <button onClick={onGenerate} className="btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
            Réessayer
          </button>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {variants.map(({ key, label, text, color }) => (
            <div key={key} style={{
              padding: '1.25rem',
              borderRadius: 8,
              border: `1px solid ${color}33`,
              background: `${color}08`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color }}>{label}</span>
                <button
                  onClick={() => copy(text, key)}
                  style={{
                    padding: '0.25rem 0.75rem', borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent', cursor: 'pointer', fontSize: '0.75rem',
                    color: copied === key ? '#10B981' : 'var(--text-secondary)',
                    transition: 'color 0.15s',
                  }}
                >
                  {copied === key ? '✓ Copié' : 'Copier'}
                </button>
              </div>
              <p style={{
                margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)',
                lineHeight: 1.65, fontStyle: 'italic',
                borderLeft: `3px solid ${color}`, paddingLeft: '0.875rem',
              }}>
                {text}
              </p>
            </div>
          ))}

          {result.points_vigilance.length > 0 && (
            <div style={{ padding: '1.25rem', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Points de vigilance
              </h3>
              <ul style={{ margin: 0, padding: '0 0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.points_vigilance.map((pt, i) => (
                  <li key={i} style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{pt}</li>
                ))}
              </ul>
            </div>
          )}

          {result.conseil_notaire && (
            <div style={{ padding: '1rem 1.25rem', borderRadius: 8, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚖️</span>
              <div>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', fontWeight: 600, color: '#A78BFA' }}>
                  Consultation notariale recommandée
                </p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {result.raison_conseil_notaire}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={onReset}
            style={{
              padding: '0.625rem 1.25rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem',
            }}
          >
            Recommencer
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Sidebar ─── */
function Sidebar({ alerts }: { alerts: Alert[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {alerts.length > 0 && (
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
            Points d&apos;attention
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map((alert, i) => (
              <div key={i} style={{
                padding: '0.75rem',
                borderRadius: 6,
                background: alert.type === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
                borderLeft: `3px solid ${alert.type === 'warning' ? '#F59E0B' : '#3B82F6'}`,
              }}>
                <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: alert.type === 'warning' ? '#F59E0B' : '#60A5FA' }}>
                  {alert.title}
                </p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {alert.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
          À savoir
        </h3>
        <ul style={{ margin: 0, padding: '0 0 0 1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PEDAGOGY_TIPS.map((tip, i) => (
            <li key={i} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Main page ─── */
export default function ClauseBeneficiairePage() {
  const [step, setStep] = useState(1);
  const [wizardState, setWizardState] = useState<WizardState>(INITIAL_STATE);
  const [result, setResult] = useState<ClauseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alerts = computeAlerts(wizardState);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/calculate/clause-beneficiaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wizardState),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Erreur serveur.');
      setResult(data as ClauseResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la génération.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setWizardState(INITIAL_STATE);
    setResult(null);
    setError(null);
  };

  const goNext = () => setStep(s => Math.min(5, s + 1));
  const goBack = () => setStep(s => Math.max(1, s - 1));

  return (
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
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
          fontWeight: 600, color: 'var(--text-primary)',
          letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0,
        }}>
          Clause bénéficiaire
        </h1>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 520 }}>
          Générez une clause personnalisée et juridiquement robuste en 5 étapes.
        </p>
      </div>

      {/* Stepper */}
      <Stepper currentStep={step} labels={STEP_LABELS} />

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Main card */}
        <div className="glass-card" style={{ padding: '1.75rem' }}>
          {step === 1 && <Step1 state={wizardState} setState={setWizardState} />}
          {step === 2 && <Step2 state={wizardState} setState={setWizardState} />}
          {step === 3 && <Step3 state={wizardState} setState={setWizardState} />}
          {step === 4 && <Step4 state={wizardState} setState={setWizardState} />}
          {step === 5 && (
            <Step5
              state={wizardState}
              result={result}
              loading={loading}
              error={error}
              onGenerate={handleGenerate}
              onReset={handleReset}
            />
          )}

          {/* Navigation */}
          {step < 5 && (
            <div style={{
              marginTop: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.25rem',
            }}>
              {step > 1 ? (
                <button
                  onClick={goBack}
                  style={{
                    padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem',
                  }}
                >
                  ← Retour
                </button>
              ) : <div />}
              <button
                onClick={goNext}
                disabled={!canProceed(step, wizardState)}
                className="btn-primary"
                style={{ opacity: canProceed(step, wizardState) ? 1 : 0.4, cursor: canProceed(step, wizardState) ? 'pointer' : 'not-allowed' }}
              >
                {step === 4 ? 'Voir le récapitulatif →' : 'Suivant →'}
              </button>
            </div>
          )}

          {step === 5 && !result && !loading && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
              <button onClick={goBack} style={{ padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>
                ← Retour
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ position: 'sticky', top: '1.5rem' }}>
          <Sidebar alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
