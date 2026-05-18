'use client';
import { AuthGate } from '@/components/auth-gate';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */
type LienParente = 'conjoint_pacs' | 'enfant' | 'frere_soeur' | 'neveu_niece' | 'tiers';

interface ContratState {
  id: string;
  nom: string;
  capitalDeces: number | '';
  primesAvant70: number | '';
  primesApres70: number | '';
}

interface BeneficiaireState {
  id: string;
  nom: string;
  lienParente: LienParente;
}

interface BeneficiaireResult {
  id: string; nom: string; lienParente: LienParente; exonere: boolean;
  capital990i: number; abattement990i: number; taxable990i: number; droits990i: number;
  primes757B: number; abattement757B_global: number; apres30500: number;
  abattementPersonnel757B: number; taxable757B: number; droits757B: number;
  capitalTotalRecu: number; droitsTotal: number; netRecu: number;
}

interface SuccessionAVResult {
  totalDroits990i: number;
  totalDroits757B: number;
  totalDroitsGlobal: number;
  totalCapital: number;
  beneficiaires: BeneficiaireResult[];
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 8);
const fmt    = (v: number): string => Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
const fmtDec = (v: number): string => { const [i, d] = Math.abs(v).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + d + ' €'; };

const LIEN_LABELS: Record<LienParente, string> = {
  conjoint_pacs: 'Conjoint / PACS',
  enfant:        'Enfant',
  frere_soeur:   'Frère / Sœur',
  neveu_niece:   'Neveu / Nièce',
  tiers:         'Tiers non parent',
};

/* ─────────────────────────────────────────────────────────────
   COMPOSANTS UI
───────────────────────────────────────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem' }}>
      {children}
    </p>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
      {children}
    </label>
  );
}

function GlassCard({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={`glass-card ${className ?? ''}`} style={{ padding: '1.25rem', ...style }}>
      {children}
    </div>
  );
}

function Row({ label, value, accent, muted, indent }: { label: string; value: string; accent?: boolean; muted?: boolean; indent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', paddingLeft: indent ? '0.75rem' : 0 }}>
      <span style={{ fontSize: '0.83rem', color: muted ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: accent ? 'var(--accent-gold)' : muted ? 'var(--text-muted)' : 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '0.5rem 0' }} />;
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(239,68,68,0.75)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      ×
    </button>
  );
}

function NumericInput({ value, onChange, placeholder, className, style }: {
  value: number | '';
  onChange: (v: number | '') => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  const display = focused
    ? (value === '' ? '' : String(value))
    : (value === '' ? '' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value));
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={e => {
        const raw = e.target.value.replace(/[^\d]/g, '');
        onChange(raw === '' ? '' : Number(raw));
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      className={className}
      style={style}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGE PRINCIPALE
───────────────────────────────────────────────────────────── */
export default function SuccessionAVPage() {
  /* ── State contrats ── */
  const [contrats, setContrats] = useState<ContratState[]>([
    { id: 'c1', nom: 'AV Principale', capitalDeces: 500_000, primesAvant70: 300_000, primesApres70: 80_000 },
  ]);

  /* ── State bénéficiaires ── */
  const [beneficiaires, setBeneficiaires] = useState<BeneficiaireState[]>([
    { id: 'b1', nom: 'Enfant 1',  lienParente: 'enfant' },
    { id: 'b2', nom: 'Enfant 2',  lienParente: 'enfant' },
  ]);

  /* ── Répartitions : repartitions[contratId][benefId] = pct ── */
  const [repartitions, setRepartitions] = useState<Record<string, Record<string, number>>>({
    c1: { b1: 50, b2: 50 },
  });

  /* ── UI state ── */
  const [pedagogieOpen,  setPedagogieOpen]  = useState(false);
  const [result,  setResult]  = useState<SuccessionAVResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  /* ─── Handlers contrats ─────────────────────────────────── */
  const addContrat = () => {
    const id = uid();
    setContrats(prev => [...prev, { id, nom: 'Nouveau contrat', capitalDeces: 0, primesAvant70: 0, primesApres70: 0 }]);
    setRepartitions(prev => ({
      ...prev,
      [id]: Object.fromEntries(beneficiaires.map(b => [b.id, 0])),
    }));
  };

  const removeContrat = (id: string) => {
    setContrats(prev => prev.filter(c => c.id !== id));
    setRepartitions(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const updateContrat = (id: string, field: keyof ContratState, value: string) => {
    setContrats(prev => prev.map(c =>
      c.id !== id ? c : { ...c, [field]: value === '' ? '' : Number(value) }
    ));
  };

  const updateContratNum = (id: string, field: 'capitalDeces' | 'primesAvant70' | 'primesApres70', value: number | '') => {
    setContrats(prev => prev.map(c => c.id !== id ? c : { ...c, [field]: value }));
  };

  /* ─── Handlers bénéficiaires ────────────────────────────── */
  const addBeneficiaire = () => {
    const id = uid();
    setBeneficiaires(prev => [...prev, { id, nom: 'Bénéficiaire', lienParente: 'tiers' }]);
    setRepartitions(prev => {
      const n = { ...prev };
      contrats.forEach(c => { n[c.id] = { ...n[c.id], [id]: 0 }; });
      return n;
    });
  };

  const removeBeneficiaire = (id: string) => {
    setBeneficiaires(prev => prev.filter(b => b.id !== id));
    setRepartitions(prev => {
      const n = { ...prev };
      Object.keys(n).forEach(cId => { const { [id]: _rm, ...rest } = n[cId]; n[cId] = rest; });
      return n;
    });
  };

  const updateBeneficiaire = (id: string, field: keyof BeneficiaireState, value: string) => {
    setBeneficiaires(prev => prev.map(b => b.id !== id ? b : { ...b, [field]: value }));
  };

  /* ─── Répartition ──────────────────────────────────────── */
  const setRepPct = (contratId: string, benefId: string, value: number) => {
    setRepartitions(prev => ({
      ...prev,
      [contratId]: { ...prev[contratId], [benefId]: isNaN(value) ? 0 : value },
    }));
  };

  const sumPct = (contratId: string) =>
    beneficiaires.reduce((s, b) => s + (repartitions[contratId]?.[b.id] ?? 0), 0);

  /* ─── API fetch avec debounce 300 ms ────────────────────── */
  const fetchResults = useCallback(async (body: object, signal: AbortSignal) => {
    const res = await fetch('/api/calculate/succession-av', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Erreur serveur');
    }
    return res.json() as Promise<SuccessionAVResult>;
  }, []);

  useEffect(() => {
    if (contrats.length === 0 || beneficiaires.length === 0) { setResult(null); return; }

    // Vérification rapide que les champs sont renseignés
    const allValid = contrats.every(c =>
      typeof c.capitalDeces  === 'number' &&
      typeof c.primesAvant70 === 'number' &&
      typeof c.primesApres70 === 'number'
    );
    if (!allValid) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current)    abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const apiContrats = contrats.map(c => ({
          id: c.id, nom: c.nom,
          capitalDeces:  c.capitalDeces  as number,
          primesAvant70: c.primesAvant70 as number,
          primesApres70: c.primesApres70 as number,
        }));
        const apiBenefs = beneficiaires.map(b => ({
          id: b.id, nom: b.nom, lienParente: b.lienParente,
          repartition: Object.fromEntries(contrats.map(c => [c.id, repartitions[c.id]?.[b.id] ?? 0])),
        }));
        const data = await fetchResults({ contrats: apiContrats, beneficiaires: apiBenefs }, controller.signal);
        setResult(data);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError((e as Error).message ?? 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      controller.abort();
    };
  }, [contrats, beneficiaires, repartitions, fetchResults]);

  /* ─────────────────────────────────────────────────────────
     RENDU
  ───────────────────────────────────────────────────────── */
  return (
    <AuthGate>
      <main style={{ minHeight: '100vh', padding: '2rem 1rem 4rem', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>

        {/* ── Fil d'Ariane ── */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 0 0.75rem', marginBottom: '2rem' }}>
          <Link href="/fiscal" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            ← Espace fiscal
          </Link>
        </div>

        {/* ── En-tête ── */}
        <div className="animate-fade-up" style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <span className="badge badge-amber">Art. 990 I</span>
            <span className="badge badge-blue">Art. 757 B</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
            Succession Assurance-vie
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 500, margin: '0 auto' }}>
            Simulez les droits selon la date de versement des primes : 990i (avant 70 ans) et 757B (après 70 ans).
          </p>
        </div>

        {/* ── Bannière erreur ── */}
        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, color: '#FCA5A5', fontSize: '0.82rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>

          {loading && (
            <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 10, pointerEvents: 'none' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>calcul…</span>
            </div>
          )}

          {/* ══ SECTION 1 : CONTRATS ══════════════════════════════ */}
          <GlassCard className="animate-fade-up delay-1">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <SectionTitle>Contrats</SectionTitle>
              <button onClick={addContrat} className="btn-primary" style={{ fontSize: '0.72rem', padding: '0.3rem 0.75rem' }}>
                + Contrat
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {contrats.map((c) => (
                <div key={c.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <input
                      value={c.nom}
                      onChange={e => updateContrat(c.id, 'nom', e.target.value)}
                      style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, width: '100%' }}
                      placeholder="Nom du contrat"
                    />
                    {contrats.length > 1 && <RemoveBtn onClick={() => removeContrat(c.id)} />}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <FieldLabel>Capital décès (€)</FieldLabel>
                      <NumericInput
                        value={c.capitalDeces}
                        onChange={v => updateContratNum(c.id, 'capitalDeces', v)}
                        className="glass-input" placeholder="500 000" />
                    </div>
                    <div>
                      <FieldLabel>Primes avant 70 ans (€)</FieldLabel>
                      <NumericInput
                        value={c.primesAvant70}
                        onChange={v => updateContratNum(c.id, 'primesAvant70', v)}
                        className="glass-input" placeholder="300 000" />
                    </div>
                    <div>
                      <FieldLabel>Primes après 70 ans (€)</FieldLabel>
                      <NumericInput
                        value={c.primesApres70}
                        onChange={v => updateContratNum(c.id, 'primesApres70', v)}
                        className="glass-input" placeholder="80 000" />
                    </div>
                  </div>
                  {/* Indicateur de cohérence */}
                  {typeof c.capitalDeces === 'number' && typeof c.primesAvant70 === 'number' && typeof c.primesApres70 === 'number' && (
                    <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: c.primesAvant70 + c.primesApres70 > c.capitalDeces + 0.01 ? '#F87171' : 'var(--text-muted)' }}>
                      Total primes : {fmt(c.primesAvant70 + c.primesApres70)}
                      {' · '}
                      Intérêts latents : {fmt(Math.max(0, c.capitalDeces - c.primesAvant70 - c.primesApres70))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>

          {/* ══ SECTION 2 : BÉNÉFICIAIRES ════════════════════════ */}
          <GlassCard className="animate-fade-up delay-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <SectionTitle>Bénéficiaires</SectionTitle>
              <button onClick={addBeneficiaire} className="btn-primary" style={{ fontSize: '0.72rem', padding: '0.3rem 0.75rem' }}>
                + Bénéficiaire
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {beneficiaires.map((b) => (
                <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.6rem', alignItems: 'center' }}>
                  <input
                    value={b.nom}
                    onChange={e => updateBeneficiaire(b.id, 'nom', e.target.value)}
                    className="glass-input" placeholder="Prénom Nom"
                    style={{ fontSize: '0.88rem' }}
                  />
                  <select
                    value={b.lienParente}
                    onChange={e => updateBeneficiaire(b.id, 'lienParente', e.target.value)}
                    className="glass-select" style={{ fontSize: '0.82rem' }}
                  >
                    {(Object.entries(LIEN_LABELS) as [LienParente, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  {beneficiaires.length > 1
                    ? <RemoveBtn onClick={() => removeBeneficiaire(b.id)} />
                    : <div style={{ width: 22 }} />
                  }
                </div>
              ))}
            </div>
          </GlassCard>

          {/* ══ SECTION 3 : TABLEAU DE RÉPARTITION ═══════════════ */}
          {contrats.length > 0 && beneficiaires.length > 0 && (
            <GlassCard className="animate-fade-up delay-3">
              <SectionTitle>Répartition par contrat (%)</SectionTitle>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Bénéficiaire
                      </th>
                      {contrats.map(c => (
                        <th key={c.id} style={{ textAlign: 'center', padding: '0.4rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                          {c.nom}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {beneficiaires.map((b, bi) => (
                      <tr key={b.id} style={{ background: bi % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 500 }}>{b.nom}</span>
                          {b.lienParente === 'conjoint_pacs' && (
                            <span className="badge badge-green" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>Exonéré</span>
                          )}
                        </td>
                        {contrats.map(c => (
                          <td key={c.id} style={{ padding: '0.3rem 0.4rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                              <input
                                type="number" min={0} max={100} step={1}
                                value={repartitions[c.id]?.[b.id] ?? 0}
                                onChange={e => setRepPct(c.id, b.id, Number(e.target.value))}
                                style={{ width: 58, padding: '0.3rem 0.4rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)', borderRadius: 8, color: 'var(--text-primary)', textAlign: 'right', fontSize: '0.82rem', outline: 'none' }}
                              />
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>%</span>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                    {/* Ligne total */}
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Total
                      </td>
                      {contrats.map(c => {
                        const sum = sumPct(c.id);
                        const ok  = Math.abs(sum - 100) <= 1;
                        return (
                          <td key={c.id} style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: ok ? '#6EE7B7' : '#F87171' }}>
                              {sum.toFixed(0)} %
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* ══ SECTION 4 : RÉSULTATS ════════════════════════════ */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>

              {/* Synthèse globale */}
              <GlassCard
                className="animate-fade-up delay-4"
                style={{ background: 'rgba(59,130,246,0.07)', borderColor: 'rgba(59,130,246,0.25)' }}
              >
                <SectionTitle>Synthèse globale</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.75rem', textAlign: 'center' }}>
                  {[
                    { label: 'Droits 990 I',     value: fmtDec(result.totalDroits990i),   color: '#FCD34D' },
                    { label: 'Droits 757 B',      value: fmtDec(result.totalDroits757B),   color: '#93C5FD' },
                    { label: 'Total droits',       value: fmtDec(result.totalDroitsGlobal), color: '#F87171' },
                    { label: 'Capital transmis',   value: fmt(result.totalCapital),          color: 'var(--text-primary)' },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                      <p style={{ fontSize: '0.67rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>{item.label}</p>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Détail par bénéficiaire */}
              {result.beneficiaires.map((b) => (
                <GlassCard
                  key={b.id}
                  className="animate-fade-up delay-5"
                  style={b.exonere ? { borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.04)' } : {}}
                >
                  {/* En-tête bénéficiaire */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>{b.nom}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{LIEN_LABELS[b.lienParente]}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {b.exonere
                        ? <span className="badge badge-green">Exonéré</span>
                        : (
                          <div>
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem' }}>Total droits</p>
                            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: '#F87171' }}>{fmtDec(b.droitsTotal)}</p>
                          </div>
                        )
                      }
                    </div>
                  </div>

                  <Divider />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>

                    {/* 990i */}
                    <div>
                      <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#FCD34D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                        Art. 990 I — Primes avant 70 ans
                      </p>
                      <Row label="Capital reçu (990i)" value={fmt(b.capital990i)} />
                      {!b.exonere && (
                        <>
                          <Row label="Abattement (152 500 €)" value={`− ${fmt(b.abattement990i)}`} muted indent />
                          <Row label="Base taxable" value={fmt(b.taxable990i)} indent />
                          <Divider />
                          <Row label="Droits 990i (20 / 31,25 %)" value={fmtDec(b.droits990i)} accent={b.droits990i > 0} />
                        </>
                      )}
                      {b.exonere && <p style={{ fontSize: '0.78rem', color: '#6EE7B7', marginTop: '0.3rem' }}>Exonéré (Art. 990 I al. 3)</p>}
                    </div>

                    {/* 757B */}
                    <div>
                      <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                        Art. 757 B — Primes après 70 ans
                      </p>
                      <Row label="Primes après 70 ans reçues" value={fmt(b.primes757B)} />
                      {!b.exonere && (
                        <>
                          <Row label={`Quote-part abattement 30 500 €`} value={`− ${fmtDec(b.abattement757B_global)}`} muted indent />
                          <Row label="Après abattement global" value={fmt(b.apres30500)} indent />
                          <Row label={`Abattement perso. (${fmt(b.abattementPersonnel757B)})`} value={`− ${fmt(Math.min(b.abattementPersonnel757B, b.apres30500))}`} muted indent />
                          <Row label="Base taxable" value={fmt(b.taxable757B)} indent />
                          <Divider />
                          <Row label="Droits 757B" value={fmtDec(b.droits757B)} accent={b.droits757B > 0} />
                        </>
                      )}
                      {b.exonere && <p style={{ fontSize: '0.78rem', color: '#6EE7B7', marginTop: '0.3rem' }}>Exonéré (loi TEPA 2007)</p>}
                    </div>
                  </div>

                  {!b.exonere && (
                    <>
                      <Divider />
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.25rem' }}>
                        <div>
                          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Capital total reçu</p>
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(b.capitalTotalRecu)}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Net perçu après droits</p>
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-emerald)' }}>{fmt(b.netRecu)}</p>
                        </div>
                      </div>
                    </>
                  )}
                </GlassCard>
              ))}
            </div>
          )}

          {/* ══ PÉDAGOGIE (collapsible) ═══════════════════════════ */}
          <GlassCard
            className="animate-fade-up delay-5"
            style={{ borderColor: 'rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.03)' }}
          >
            <button
              onClick={() => setPedagogieOpen(o => !o)}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0 }}
            >
              <SectionTitle>Comprendre la fiscalité de l'assurance-vie en succession</SectionTitle>
              <span style={{ color: 'var(--accent-gold)', fontSize: '0.85rem', marginTop: '-0.75rem', marginLeft: '0.5rem' }}>
                {pedagogieOpen ? '▲' : '▼'}
              </span>
            </button>

            {pedagogieOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>

                <div style={{ padding: '0.9rem 1rem', background: 'rgba(252,211,77,0.07)', borderRadius: 10, borderLeft: '3px solid #FCD34D' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FCD34D', marginBottom: '0.4rem' }}>Article 990 I — Primes versées avant 70 ans</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    L'assurance-vie est <strong style={{ color: 'var(--text-primary)' }}>hors succession civile</strong> pour les primes versées avant 70 ans. Chaque bénéficiaire bénéficie d'un <strong style={{ color: 'var(--text-primary)' }}>abattement de 152 500 €</strong> sur la valeur du capital décès (gains inclus). Au-delà : 20 % jusqu'à 852 500 €, puis 31,25 %. Le conjoint et le partenaire PACS sont <strong style={{ color: '#6EE7B7' }}>totalement exonérés</strong>.
                  </p>
                </div>

                <div style={{ padding: '0.9rem 1rem', background: 'rgba(147,197,253,0.07)', borderRadius: 10, borderLeft: '3px solid #93C5FD' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#93C5FD', marginBottom: '0.4rem' }}>Article 757 B — Primes versées après 70 ans</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    Seules les <strong style={{ color: 'var(--text-primary)' }}>primes brutes</strong> versées après 70 ans sont réintégrées dans l'actif successoral — <strong style={{ color: '#6EE7B7' }}>les intérêts et plus-values sont exonérés</strong>. Un abattement global de <strong style={{ color: 'var(--text-primary)' }}>30 500 €</strong>, partagé entre tous les bénéficiaires au prorata, s'applique. Au-delà, les droits de succession de droit commun s'appliquent selon le lien de parenté.
                  </p>
                </div>

                <div style={{ padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10, borderLeft: '3px solid rgba(255,255,255,0.2)' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Partage de l'abattement 30 500 €</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    Contrairement à l'abattement 990i (152 500 € <em>par bénéficiaire</em>), l'abattement 757B est <strong style={{ color: 'var(--text-primary)' }}>unique et global</strong> pour l'ensemble des contrats du défunt. Il se partage au prorata des primes après 70 reçues par chaque bénéficiaire. Plus il y a de bénéficiaires, plus la quote-part de chacun est faible.
                  </p>
                </div>

                <div style={{ padding: '0.9rem 1rem', background: 'rgba(16,185,129,0.07)', borderRadius: 10, borderLeft: '3px solid rgba(16,185,129,0.4)' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6EE7B7', marginBottom: '0.4rem' }}>Astuce patrimoniale : versez avant 70 ans</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    Les primes versées <strong style={{ color: 'var(--text-primary)' }}>avant 70 ans</strong> bénéficient d'un abattement de 152 500 € <em>par bénéficiaire</em> sur le <em>capital décès complet</em> (primes + intérêts). Pour un couple avec deux enfants, c'est jusqu'à 305 000 € transmis sans droits. Après 70 ans, l'abattement de 30 500 € est <em>global</em> et les intérêts restent certes exonérés, mais le régime est moins favorable. Il est donc stratégiquement avantageux de <strong style={{ color: '#6EE7B7' }}>maximiser les versements avant les 70 ans</strong>.
                  </p>
                </div>

              </div>
            )}
          </GlassCard>

          {/* Note légale */}
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            * Simulation pédagogique — Art. 990 I et 757 B du CGI. Abattements 2024. L'abattement personnel 757B (100 000 € pour un enfant) est ici appliqué à la seule part AV ; en pratique il s'impute sur l'ensemble de la succession. Conjoint/PACS exonéré par la loi TEPA (2007). Non contractuel.
          </p>

        </div>
      </div>
      </main>
    </AuthGate>
  );
}
