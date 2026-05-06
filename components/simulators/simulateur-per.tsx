'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */
type MaritalStatus = 'celibataire' | 'marie_pacse';

interface TranchePart {
  rate: number;
  label: string;
  eurosVerses: number;
  economie: number;
}

interface PerResult {
  dedTot: number;
  rbApres: number;
  rfrApres: number;
  impotIRAvant: number;
  impotIRApres: number;
  economieIR: number;
  cehrAvant: number;
  cehrApres: number;
  economieCEHR: number;
  economieTotale: number;
  coutReel: number;
  impotsIRCEHRAvant: number;
  impotsIRCEHRApres: number;
  tmiAvant: number;
  tmiApres: number;
  tmiReelleAvant: number;
  tmiReelleApres: number;
  tmiBaisse: boolean;
  qfPlafonnementActif: boolean;
  repartitionParTranche: TranchePart[];
  revenusAu30Plus: { rate: number; label: string; euros: number }[];
  deductionAu30Plus: number;
}

interface PerApiInput {
  statut: MaritalStatus;
  revenuFiscalReference: number;
  revenuBrutGlobal: number;
  partsFiscales: number;
  plafondDeductibilitePer: number;
  versement: number;
}

/* ─────────────────────────────────────────────────────────────
   HELPERS DISPLAY
───────────────────────────────────────────────────────────── */
function getRateLabel(rate: number): string { return `${Math.round(rate * 100)}%`; }
function formatEuro(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
}
function formatEuroDec(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €';
}

/* ─────────────────────────────────────────────────────────────
   COMPOSANTS UI INTERNES
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
    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
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

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0' }}>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: accent ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily: accent ? 'var(--font-display)' : 'inherit' }}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '0.6rem 0' }} />;
}

/* ─────────────────────────────────────────────────────────────
   COMPOSANT PRINCIPAL
───────────────────────────────────────────────────────────── */
export function SimulateurPer() {
  const [statut, setStatut] = useState<MaritalStatus>('celibataire');
  const [revenuFiscalReference, setRevenuFiscalReference] = useState<number | ''>(60000);
  const [partsFiscales, setPartsFiscales] = useState<number | ''>(1);
  const [revenuBrutGlobal, setRevenuBrutGlobal] = useState<number | ''>(60000);
  const [plafondDeductibilitePer2026, setPlafondDeductibilitePer2026] = useState<number | ''>(20000);
  const [age, setAge] = useState<number | ''>(35);
  const [versement, setVersement] = useState<number>(1000);

  const [result, setResult]   = useState<PerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  const minPartsFiscales = statut === 'marie_pacse' ? 2 : 1;
  const plafondSecurise  = Math.max(0, typeof plafondDeductibilitePer2026 === 'number' ? plafondDeductibilitePer2026 : 0);
  const versementStep    = plafondSecurise <= 5000 ? 50 : 100;

  /* ── Clamp parts fiscales lors du changement de statut ── */
  useEffect(() => {
    if (typeof partsFiscales !== 'number') return;
    const clamped = Math.max(minPartsFiscales, partsFiscales);
    if (clamped !== partsFiscales) setPartsFiscales(clamped);
  }, [minPartsFiscales, partsFiscales]);

  /* ── Clamp versement si le plafond baisse ── */
  useEffect(() => { setVersement((v) => Math.min(v, plafondSecurise)); }, [plafondSecurise]);

  /* ── Appel API avec debounce 300 ms ── */
  const fetchResults = useCallback(async (body: PerApiInput, signal: AbortSignal) => {
    const res = await fetch('/api/calculate/per', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Erreur serveur');
    }
    return res.json() as Promise<PerResult>;
  }, []);

  useEffect(() => {
    /* Attendre que tous les champs numériques soient renseignés */
    if (
      typeof revenuFiscalReference !== 'number' ||
      typeof revenuBrutGlobal      !== 'number' ||
      typeof partsFiscales         !== 'number'
    ) return;

    /* Annuler la requête précédente et repartir sur 300 ms */
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current)    abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await fetchResults(
          {
            statut,
            revenuFiscalReference,
            revenuBrutGlobal,
            partsFiscales,
            plafondDeductibilitePer: plafondSecurise,
            versement,
          },
          controller.signal,
        );
        setResult(data);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setError((e as Error).message ?? 'Erreur inconnue');
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      controller.abort();
    };
  }, [statut, revenuFiscalReference, partsFiscales, revenuBrutGlobal, plafondSecurise, versement, fetchResults]);

  /* ── Raccourcis d'affichage (valeurs nulles jusqu'au premier résultat) ── */
  const tAvant               = result?.tmiAvant           ?? 0;
  const tApres               = result?.tmiApres           ?? 0;
  const baisse               = result?.tmiBaisse          ?? false;
  const tmiReelle            = result?.tmiReelleAvant     ?? 0;
  const tmiReelleApresPct    = result?.tmiReelleApres     ?? 0;
  const rbApres              = result?.rbApres            ?? 0;
  const repart               = result?.repartitionParTranche ?? [];
  const impotIRAvant         = result?.impotIRAvant       ?? 0;
  const impotIRApres         = result?.impotIRApres       ?? 0;
  const economieIRReelle     = result?.economieIR         ?? 0;
  const qfPlafonnementActif  = result?.qfPlafonnementActif ?? false;
  const cehrAv               = result?.cehrAvant          ?? 0;
  const cehrAp               = result?.cehrApres          ?? 0;
  const ecoCEHR              = result?.economieCEHR       ?? 0;
  const ecoTotale            = result?.economieTotale     ?? 0;
  const cr                   = result?.coutReel           ?? 0;
  const revenusAu30Plus      = result?.revenusAu30Plus    ?? [];
  const deductionAu30Plus    = result?.deductionAu30Plus  ?? 0;
  const impotsIRTotalAvant   = result?.impotsIRCEHRAvant  ?? 0;
  const impotsIRTotalApres   = result?.impotsIRCEHRApres  ?? 0;
  const dedTot               = result?.dedTot             ?? 0;

  const sliderPct = plafondSecurise > 0 ? (versement / plafondSecurise) * 100 : 0;

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1rem 4rem', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* ── En-tête ── */}
        <div className="animate-fade-up" style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <span className="badge badge-blue" style={{ marginBottom: '0.75rem' }}>Fiscal · Barème 2026</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
            Simulateur PER
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 460, margin: '0 auto' }}>
            Estimez votre économie d'impôt selon votre situation fiscale et votre versement.
          </p>
        </div>

        {/* ── Bannière erreur ── */}
        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, color: '#FCA5A5', fontSize: '0.82rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>

          {/* ── Overlay loading ── */}
          {loading && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', pointerEvents: 'none' }}>
              <span style={{ marginTop: '0.25rem', marginRight: '0.25rem', fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                calcul…
              </span>
            </div>
          )}

          {/* ── Configuration fiscale ── */}
          <GlassCard className="animate-fade-up delay-1">
            <SectionTitle>Configuration fiscale</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>

              <div>
                <FieldLabel>Statut</FieldLabel>
                <select value={statut} onChange={(e) => setStatut(e.target.value as MaritalStatus)} className="glass-select">
                  <option value="celibataire">Célibataire</option>
                  <option value="marie_pacse">Marié · Pacsé</option>
                </select>
              </div>

              <div>
                <FieldLabel>Âge</FieldLabel>
                <input
                  type="number" min={0} max={120} step={1}
                  value={age === '' ? '' : age}
                  onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                  className="glass-input" placeholder="35"
                />
              </div>

              <div>
                <FieldLabel>Parts fiscales</FieldLabel>
                <input
                  type="number" min={minPartsFiscales} step={0.5}
                  value={partsFiscales === '' ? '' : partsFiscales}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') { setPartsFiscales(''); return; }
                    setPartsFiscales(Math.max(minPartsFiscales, Number(raw)));
                  }}
                  className="glass-input" placeholder={String(minPartsFiscales)}
                />
              </div>

              <div>
                <FieldLabel>RFR (€)</FieldLabel>
                <input
                  type="number" min={0} step={100}
                  value={revenuFiscalReference === '' ? '' : revenuFiscalReference}
                  onChange={(e) => setRevenuFiscalReference(e.target.value === '' ? '' : Number(e.target.value))}
                  className="glass-input" placeholder="60 000"
                />
              </div>

              <div>
                <FieldLabel>Revenu brut global (€)</FieldLabel>
                <input
                  type="number" min={0} step={100}
                  value={revenuBrutGlobal === '' ? '' : revenuBrutGlobal}
                  onChange={(e) => setRevenuBrutGlobal(e.target.value === '' ? '' : Number(e.target.value))}
                  className="glass-input" placeholder="60 000"
                />
              </div>

              <div>
                <FieldLabel>Plafond déductibilité PER (€)</FieldLabel>
                <input
                  type="number" min={0} step={100}
                  value={plafondDeductibilitePer2026 === '' ? '' : plafondDeductibilitePer2026}
                  onChange={(e) => setPlafondDeductibilitePer2026(e.target.value === '' ? '' : Number(e.target.value))}
                  className="glass-input" placeholder="20 000"
                />
              </div>

            </div>
          </GlassCard>

          {/* ── Slider versement ── */}
          <GlassCard className="animate-fade-up delay-2">
            <SectionTitle>Versement PER</SectionTitle>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Montant versé</span>
              <span className="stat-number-gold">{formatEuro(versement)}</span>
            </div>

            <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
              <div style={{
                position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)',
                height: 6, width: `${sliderPct}%`, borderRadius: 3,
                background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-indigo))',
                pointerEvents: 'none', zIndex: 1, transition: 'width 0.1s',
              }} />
              <input
                type="range" min={0} max={plafondSecurise} step={versementStep}
                value={versement}
                onChange={(e) => setVersement(Math.min(Number(e.target.value), plafondSecurise))}
                disabled={plafondSecurise <= 0}
                className="glass-range"
                style={{ position: 'relative', zIndex: 2 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              <span>0 €</span>
              <span>{formatEuro(plafondSecurise)}</span>
            </div>

            {plafondSecurise <= 0 && (
              <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#F87171', textAlign: 'center' }}>
                Plafond à 0 € — renseignez votre plafond de déductibilité.
              </p>
            )}

            {/* TMI badge */}
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>TMI marginale réelle (IR différentiel)</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="badge badge-amber">{getRateLabel(tAvant)} avant</span>
                  {baisse
                    ? <span className="badge badge-green">↓ {getRateLabel(tApres)} après</span>
                    : <span className="badge badge-blue">{getRateLabel(tApres)} après</span>
                  }
                </div>
              </div>
              <p style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                IR différentiel : {tmiReelle.toFixed(2)} % avant · {tmiReelleApresPct.toFixed(2)} % après versement
                {qfPlafonnementActif && <span style={{ color: '#FCD34D', marginLeft: '0.5rem' }}>· Plafonnement QF actif</span>}
              </p>
            </div>
          </GlassCard>

          {/* ── Résultats principaux ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }} className="animate-fade-up delay-3">

            <GlassCard>
              <SectionTitle>Impôt sur le revenu</SectionTitle>
              <Row label="Avant PER" value={formatEuro(impotIRAvant)} />
              <Row label="Après PER" value={formatEuro(impotIRApres)} />
              <Divider />
              <Row label="Économie IR" value={formatEuroDec(economieIRReelle)} accent />
              <Divider />
              <Row label="Total (IR+CEHR) avant" value={formatEuro(impotsIRTotalAvant)} />
              <Row label="Total (IR+CEHR) après" value={formatEuro(impotsIRTotalApres)} />
            </GlassCard>

            <GlassCard>
              <SectionTitle>CEHR estimée</SectionTitle>
              <Row label="Avant PER" value={formatEuro(cehrAv)} />
              <Row label="Après PER" value={formatEuro(cehrAp)} />
              <Divider />
              <Row label="Économie CEHR" value={formatEuroDec(ecoCEHR)} accent={ecoCEHR > 0} />
            </GlassCard>

          </div>

          {/* ── Synthèse ── */}
          <GlassCard
            className="animate-fade-up delay-4"
            style={{ background: 'rgba(59,130,246,0.07)', borderColor: 'rgba(59,130,246,0.25)', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}
          >
            <SectionTitle>Synthèse</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
              {[
                { label: 'Versement',     value: formatEuro(versement),       color: 'var(--text-primary)' },
                { label: 'Économie totale', value: formatEuroDec(ecoTotale),   color: 'var(--accent-emerald)' },
                { label: 'Coût réel',     value: formatEuroDec(cr),           color: 'var(--accent-gold)' },
              ].map((item) => (
                <div key={item.label} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{item.label}</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 600, color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* ── Répartition par tranche ── */}
          <GlassCard className="animate-fade-up delay-5" style={{ borderColor: 'rgba(99,102,241,0.25)', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            <SectionTitle>Répartition du versement par tranche (IR différentiel)</SectionTitle>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Chaque euro déduit est retiré du sommet de l'assiette : gain IR = impôt(R) − impôt(R − 1 €), regroupé par taux du barème le plus proche.
            </p>
            {dedTot <= 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>Aucun versement · aucune déduction à répartir.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {repart.map((item) => {
                  const pct = dedTot > 0 ? (item.eurosVerses / dedTot) * 100 : 0;
                  return (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {formatEuro(item.eurosVerses)} à la marge {item.label}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-indigo)' }}>
                          Gain : {formatEuroDec(item.economie)}
                        </span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent-indigo), var(--accent-blue))', borderRadius: 2, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* ── Tranches 30%+ ── */}
          {revenusAu30Plus.length > 0 && (
            <GlassCard className="animate-fade-up delay-5" style={{ borderColor: 'rgba(16,185,129,0.25)', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <SectionTitle>Revenus imposés à 30 % et plus</SectionTitle>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
                La déduction PER est la plus efficace dans ces tranches. Sur votre versement, <strong style={{ color: 'var(--text-secondary)' }}>{formatEuro(deductionAu30Plus)}</strong> seraient déduits à 30 % ou plus.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {revenusAu30Plus.map((b) => (
                  <Row key={b.label} label={b.label} value={formatEuro(b.euros)} />
                ))}
                <Divider />
                <Row label="Total" value={formatEuro(revenusAu30Plus.reduce((s, b) => s + b.euros, 0))} accent />
              </div>
            </GlassCard>
          )}

          {/* ── Effet de seuil ── */}
          <GlassCard
            className="animate-fade-up delay-5"
            style={baisse ? { borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' } : {}}
          >
            <SectionTitle>Effet de seuil</SectionTitle>
            {baisse ? (
              <p style={{ fontSize: '0.88rem', color: '#6EE7B7', lineHeight: 1.7 }}>
                ✦ Le versement fait passer la TMI effective de <strong>{getRateLabel(tAvant)}</strong> à <strong>{getRateLabel(tApres)}</strong>.
              </p>
            ) : (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                La TMI effective reste à <strong style={{ color: 'var(--text-primary)' }}>{getRateLabel(tApres)}</strong> après ce versement.
              </p>
            )}
            <p style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Revenu brut global après déduction : {formatEuro(rbApres)}
              {ecoCEHR > 0 && ` · Économie CEHR : ${formatEuroDec(ecoCEHR)}`}
            </p>
          </GlassCard>

          {/* ── Pédagogie ── */}
          <GlassCard className="animate-fade-up delay-5" style={{ borderColor: 'rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.04)' }}>
            <SectionTitle>Pourquoi le PER est plus avantageux à TMI élevée ?</SectionTitle>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.75 }}>
              Le versement PER est déductible du revenu imposable : plus la TMI est élevée (30 %, 41 %, 45 %),
              plus chaque euro versé réduit l'IR. Votre marge effective avant versement est de{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{tmiReelle.toFixed(2)} %</strong>{' '}
              (tranche la plus proche : <strong style={{ color: 'var(--accent-gold)' }}>{getRateLabel(tAvant)}</strong>
              ), ce qui correspond à une économie IR de{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{formatEuroDec(economieIRReelle)}</strong> sur ce versement.
            </p>
          </GlassCard>

          {/* ── Note légale ── */}
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            * Estimation pédagogique : barème progressif 2026 (0/11/30/41/45) + quotient familial plafonné (≈ 1 750 €/demi-part) + CEHR (hypothèse : le PER réduit le RFR du montant déduit). Non contractuel.
          </p>

        </div>
      </div>
    </main>
  );
}
