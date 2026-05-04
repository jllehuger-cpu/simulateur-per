'use client';

import { useState, useMemo } from 'react';

// ─── Moteur de calcul ─────────────────────────────────────────────────────────

interface ParamsCapitalisation {
  capitalInitial: number;
  versementMensuel: number;
  dureeAns: number;
  tauxAnnuel: number;
  inflation: number; // en %
}

interface ResultatAnnuel {
  annee: number;
  capitalCumule: number;
  capitalReel: number; // corrigé inflation
  totalInvesti: number;
  interets: number;
}

function calculerCapitalisation(p: ParamsCapitalisation): ResultatAnnuel[] {
  const tauxMensuel = Math.pow(1 + p.tauxAnnuel / 100, 1 / 12) - 1;
  const resultats: ResultatAnnuel[] = [];
  let capital = p.capitalInitial;
  let totalInvesti = p.capitalInitial;

  for (let annee = 1; annee <= p.dureeAns; annee++) {
    for (let mois = 0; mois < 12; mois++) {
      capital = capital * (1 + tauxMensuel) + p.versementMensuel;
      totalInvesti += p.versementMensuel;
    }
    const facteurInflation = Math.pow(1 + p.inflation / 100, annee);
    resultats.push({
      annee,
      capitalCumule: Math.round(capital),
      capitalReel: Math.round(capital / facteurInflation),
      totalInvesti: Math.round(totalInvesti),
      interets: Math.round(capital - totalInvesti),
    });
  }
  return resultats;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €';
const fmtC = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + ' M€';
  if (n >= 1_000) return Math.round(n / 1000) + ' k€';
  return Math.round(n) + ' €';
};

// ─── Graphique SVG ────────────────────────────────────────────────────────────

function Graphique({
  scenarios,
  duree,
  showReel,
}: {
  scenarios: { label: string; taux: number; couleur: string; data: ResultatAnnuel[] }[];
  duree: number;
  showReel: boolean;
}) {
  const W = 700, H = 280;
  const PAD = { top: 20, right: 20, bottom: 40, left: 64 };
  const w = W - PAD.left - PAD.right;
  const h = H - PAD.top - PAD.bottom;

  const allVals = scenarios.flatMap(s => s.data.map(d => showReel ? d.capitalReel : d.capitalCumule));
  const maxVal = Math.max(...allVals, 1);

  const xS = (a: number) => PAD.left + ((a - 1) / Math.max(1, duree - 1)) * w;
  const yS = (v: number) => PAD.top + h - (v / maxVal) * h;

  const path = (data: ResultatAnnuel[], key: 'capitalCumule' | 'capitalReel') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xS(d.annee).toFixed(1)},${yS(d[key]).toFixed(1)}`).join(' ');

  const pathInvesti = (data: ResultatAnnuel[]) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xS(d.annee).toFixed(1)},${yS(d.totalInvesti).toFixed(1)}`).join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({ val: maxVal * r, y: PAD.top + h * (1 - r) }));
  const step = duree <= 10 ? 1 : duree <= 20 ? 5 : 10;
  const xTicks = Array.from({ length: Math.floor(duree / step) + 1 }, (_, i) => i * step || 1).filter(a => a <= duree);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      {yTicks.map(t => (
        <g key={t.val}>
          <line x1={PAD.left} y1={t.y} x2={PAD.left + w} y2={t.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={PAD.left - 8} y={t.y} textAnchor="end" dominantBaseline="central" fill="rgba(148,163,184,0.7)" fontSize="11">{fmtC(t.val)}</text>
        </g>
      ))}
      {xTicks.map(a => (
        <text key={a} x={xS(a)} y={H - 8} textAnchor="middle" fill="rgba(148,163,184,0.6)" fontSize="11">
          {a === 1 ? 'an 1' : `${a} ans`}
        </text>
      ))}

      {/* Capital investi */}
      <path d={pathInvesti(scenarios[0].data)} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="5 4" />

      {/* Courbes nominales */}
      {scenarios.map(s => (
        <path key={`n-${s.taux}`} d={path(s.data, 'capitalCumule')} fill="none" stroke={s.couleur} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      ))}

      {/* Courbes réelles (si affichées) */}
      {showReel && scenarios.map(s => (
        <path key={`r-${s.taux}`} d={path(s.data, 'capitalReel')} fill="none" stroke={s.couleur} strokeWidth="1.5" strokeDasharray="6 3" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      ))}

      {/* Points finaux */}
      {scenarios.map(s => {
        const last = s.data[s.data.length - 1];
        if (!last) return null;
        const val = showReel ? last.capitalReel : last.capitalCumule;
        return <circle key={s.taux} cx={xS(last.annee)} cy={yS(val)} r="4" fill={s.couleur} />;
      })}
    </svg>
  );
}

// ─── Barre capital / intérêts ─────────────────────────────────────────────────

function BarreRepartition({ totalInvesti, interets }: { totalInvesti: number; interets: number }) {
  const total = totalInvesti + interets;
  if (total <= 0) return null;
  const pct = (totalInvesti / total) * 100;
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
        <div style={{ width: `${pct}%`, background: 'rgba(148,163,184,0.5)', transition: 'width 0.5s ease' }} />
        <div style={{ flex: 1, background: 'var(--accent-emerald)', transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Capital investi · {pct.toFixed(0)}%</span>
        <span style={{ fontSize: 11, color: 'var(--accent-emerald)' }}>Intérêts · {(100 - pct).toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const INFLATIONS = [
  { label: 'Aucune', val: 0 },
  { label: '1%', val: 1 },
  { label: '2%', val: 2 },
  { label: '3%', val: 3 },
];

export default function CapitalisationPage() {
  const [capitalInitial, setCapitalInitial] = useState(10000);
  const [versementMensuel, setVersementMensuel] = useState(300);
  const [dureeAns, setDureeAns] = useState(20);
  const [tauxRealiste, setTauxRealiste] = useState(5);
  const [inflation, setInflation] = useState(0);
  const [showReel, setShowReel] = useState(false);

  const scenarios = useMemo(() => [
    { label: 'Pessimiste', taux: Math.max(0.5, tauxRealiste - 2), couleur: '#94A3B8' },
    { label: 'Réaliste',   taux: tauxRealiste,                     couleur: '#3B82F6' },
    { label: 'Optimiste',  taux: tauxRealiste + 2,                 couleur: '#10B981' },
  ].map(s => ({
    ...s,
    data: calculerCapitalisation({ capitalInitial, versementMensuel, dureeAns, tauxAnnuel: s.taux, inflation }),
  })), [capitalInitial, versementMensuel, dureeAns, tauxRealiste, inflation]);

  const realiste = scenarios[1];
  const last = realiste.data[realiste.data.length - 1];

  const etapes = realiste.data.filter(d => d.annee % 5 === 0 || d.annee === 1 || d.annee === dureeAns);

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.25rem', position: 'relative', zIndex: 1 }}>

      {/* En-tête */}
      <div className="animate-fade-up" style={{ marginBottom: '2.5rem' }}>
        <p className="section-title">Axe financier</p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
          fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0,
        }}>
          Simulateur de capitalisation
        </h1>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Visualisez la croissance de votre épargne selon différents scénarios de rendement.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── Paramètres ── */}
        <div className="animate-fade-up delay-1 glass-card" style={{ padding: '1.5rem' }}>
          <p className="section-title">Paramètres</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>

            {/* Capital initial */}
            <div>
              <label className="field-label">Capital initial</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" className="glass-input" value={capitalInitial} step={1000}
                  onChange={e => setCapitalInitial(Math.max(0, Number(e.target.value)))} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 14, whiteSpace: 'nowrap' }}>€</span>
              </div>
              <input type="range" className="glass-range" min={0} max={200000} step={1000}
                value={capitalInitial} onChange={e => setCapitalInitial(Number(e.target.value))} style={{ marginTop: 8 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>0 €</span><span>200 k€</span>
              </div>
            </div>

            {/* Versement mensuel */}
            <div>
              <label className="field-label">Versement mensuel</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" className="glass-input" value={versementMensuel} step={50}
                  onChange={e => setVersementMensuel(Math.max(0, Number(e.target.value)))} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 14, whiteSpace: 'nowrap' }}>€ / mois</span>
              </div>
              <input type="range" className="glass-range" min={0} max={5000} step={50}
                value={versementMensuel} onChange={e => setVersementMensuel(Number(e.target.value))} style={{ marginTop: 8 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>0 €</span><span>5 000 €/mois</span>
              </div>
            </div>

            {/* Durée */}
            <div>
              <label className="field-label">Durée de placement</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" className="glass-input" value={dureeAns} step={1}
                  onChange={e => setDureeAns(Math.min(50, Math.max(1, Number(e.target.value))))} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 14, whiteSpace: 'nowrap' }}>ans</span>
              </div>
              <input type="range" className="glass-range" min={1} max={50} step={1}
                value={dureeAns} onChange={e => setDureeAns(Number(e.target.value))} style={{ marginTop: 8 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>1 an</span><span>50 ans</span>
              </div>
            </div>

            {/* Taux réaliste */}
            <div>
              <label className="field-label">Taux réaliste (scénario central)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" className="glass-input" value={tauxRealiste} step={0.5}
                  onChange={e => setTauxRealiste(Math.min(20, Math.max(0.5, Number(e.target.value))))} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>% / an</span>
              </div>
              <input type="range" className="glass-range" min={0.5} max={15} step={0.5}
                value={tauxRealiste} onChange={e => setTauxRealiste(Number(e.target.value))} style={{ marginTop: 8 }} />
              <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                {scenarios.map(s => (
                  <span key={s.taux} style={{
                    flex: 1, textAlign: 'center', fontSize: 10, padding: '3px 0',
                    borderRadius: 6, border: `1px solid ${s.couleur}40`, color: s.couleur, background: `${s.couleur}12`,
                  }}>
                    {s.label}<br /><strong>{s.taux}%</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Inflation */}
            <div>
              <label className="field-label">Hypothèse d'inflation</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {INFLATIONS.map(inf => (
                  <button
                    key={inf.val}
                    onClick={() => { setInflation(inf.val); setShowReel(inf.val > 0); }}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${inflation === inf.val ? 'var(--accent-amber)' : 'rgba(255,255,255,0.1)'}`,
                      background: inflation === inf.val ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                      color: inflation === inf.val ? 'var(--accent-amber)' : 'var(--text-secondary)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {inf.label}
                  </button>
                ))}
              </div>
              {inflation > 0 && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={showReel} onChange={e => setShowReel(e.target.checked)}
                      style={{ accentColor: 'var(--accent-amber)' }} />
                    Afficher le capital en euros constants
                  </label>
                </div>
              )}
            </div>

            <div className="glass-divider" />

            {/* Récap effort */}
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Capital initial</span>
                <span style={{ color: 'var(--text-primary)' }}>{fmt(capitalInitial)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Versements sur {dureeAns} ans</span>
                <span style={{ color: 'var(--text-primary)' }}>{fmt(versementMensuel * 12 * dureeAns)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>
                <span>Total investi</span>
                <span style={{ color: 'var(--text-primary)' }}>{fmt(capitalInitial + versementMensuel * 12 * dureeAns)}</span>
              </div>
            </div>

          </div>
        </div>

        {/* ── Résultats ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* 3 cartes scénarios */}
          <div className="animate-fade-up delay-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {scenarios.map((s, i) => {
              const d = s.data[s.data.length - 1];
              const mult = d ? d.capitalCumule / Math.max(1, d.totalInvesti) : 0;
              const tauxReel = s.taux - inflation;
              return (
                <div key={s.taux} className="glass-card" style={{
                  padding: '1.25rem',
                  borderColor: i === 1 ? `${s.couleur}50` : undefined,
                  background: i === 1 ? `${s.couleur}08` : undefined,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: s.couleur }}>{s.label}</span>
                    <span className="badge" style={{ background: `${s.couleur}18`, color: s.couleur, border: `1px solid ${s.couleur}35`, fontSize: 10 }}>{s.taux}%</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)', fontWeight: 600, color: s.couleur }}>
                    {d ? fmtC(d.capitalCumule) : '—'}
                  </div>
                  {inflation > 0 && d && (
                    <div style={{ marginTop: 3, fontSize: 11, color: 'var(--accent-amber)' }}>
                      ≈ {fmtC(d.capitalReel)} réels
                    </div>
                  )}
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                    dont <span style={{ color: s.couleur }}>{d ? fmtC(d.interets) : '—'}</span> d'intérêts
                  </div>
                  {inflation > 0 && (
                    <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                      Taux réel : {tauxReel > 0 ? '+' : ''}{tauxReel.toFixed(1)}% / an
                    </div>
                  )}
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                    × {mult.toFixed(2)} mise
                  </div>
                </div>
              );
            })}
          </div>

          {/* Graphique */}
          <div className="animate-fade-up delay-3 glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
              <p className="section-title" style={{ margin: 0 }}>Évolution du capital</p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {scenarios.map(s => (
                  <div key={s.taux} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <div style={{ width: 20, height: 2, background: s.couleur, borderRadius: 1 }} />
                    {s.label}
                  </div>
                ))}
                {showReel && inflation > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--accent-amber)' }}>
                    <div style={{ width: 20, height: 2, borderTop: '2px dashed var(--accent-amber)', opacity: 0.6 }} />
                    Euros constants
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <div style={{ width: 20, borderTop: '1.5px dashed rgba(255,255,255,0.25)' }} />
                  Investi
                </div>
              </div>
            </div>
            <Graphique scenarios={scenarios} duree={dureeAns} showReel={showReel && inflation > 0} />
          </div>

          {/* Décomposition */}
          {last && (
            <div className="animate-fade-up delay-4 glass-card" style={{ padding: '1.5rem' }}>
              <p className="section-title" style={{ marginBottom: '1rem' }}>
                Décomposition · scénario réaliste ({tauxRealiste}% / an{inflation > 0 ? `, inflation ${inflation}%` : ''})
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: inflation > 0 ? 'repeat(3, 1fr)' : '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ padding: '1rem', background: 'rgba(148,163,184,0.08)', borderRadius: 10, border: '1px solid rgba(148,163,184,0.15)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Capital investi</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 600 }}>{fmt(last.totalInvesti)}</div>
                </div>
                <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.08)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.25)' }}>
                  <div style={{ fontSize: 11, color: 'var(--accent-emerald)', marginBottom: 4 }}>Intérêts générés</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 600, color: 'var(--accent-emerald)' }}>{fmt(last.interets)}</div>
                </div>
                {inflation > 0 && (
                  <div style={{ padding: '1rem', background: 'rgba(245,158,11,0.08)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.25)' }}>
                    <div style={{ fontSize: 11, color: 'var(--accent-amber)', marginBottom: 4 }}>Capital réel ({inflation}% inflation)</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 600, color: 'var(--accent-amber)' }}>{fmt(last.capitalReel)}</div>
                  </div>
                )}
              </div>
              <BarreRepartition totalInvesti={last.totalInvesti} interets={last.interets} />
            </div>
          )}

          {/* Tableau */}
          <div className="animate-fade-up delay-5 glass-card" style={{ padding: '1.5rem' }}>
            <p className="section-title" style={{ marginBottom: '0.75rem' }}>Progression — scénario réaliste</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Échéance', 'Capital investi', 'Intérêts', 'Capital nominal', ...(inflation > 0 ? ['Capital réel'] : []), 'Multiplicateur'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Échéance' ? 'left' : 'right', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {etapes.map((d, idx) => {
                    const isLast = idx === etapes.length - 1;
                    const mult = d.capitalCumule / Math.max(1, d.totalInvesti);
                    return (
                      <tr key={d.annee} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isLast ? 'rgba(59,130,246,0.06)' : undefined }}>
                        <td style={{ padding: '10px 12px', color: isLast ? 'var(--accent-blue)' : 'var(--text-primary)', fontWeight: isLast ? 600 : 400 }}>
                          {d.annee === 1 ? '1 an' : `${d.annee} ans`}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(d.totalInvesti)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--accent-emerald)' }}>+{fmt(d.interets)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: isLast ? 'var(--accent-blue)' : 'var(--text-primary)' }}>{fmt(d.capitalCumule)}</td>
                        {inflation > 0 && (
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--accent-amber)' }}>{fmt(d.capitalReel)}</td>
                        )}
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: 12 }}>× {mult.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
