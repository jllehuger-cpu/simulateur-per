'use client';
import { AuthGate } from '@/components/auth-gate';

import { useState, useMemo } from 'react';

// ─── Moteur de calcul ─────────────────────────────────────────────────────────

interface ParamsEmprunt {
  montant: number;
  dureeAns: number;
  tauxAnnuel: number;    // taux nominal %
  tauxAssurance: number; // % du capital initial / an
  fraisDossier: number;
}

interface ResultatEmprunt {
  mensualiteHorsAssurance: number;
  mensualiteAssurance: number;
  mensualiteTotale: number;
  coutInterets: number;
  coutAssurance: number;
  coutTotal: number;
  taeg: number;
  tableauAnnuel: {
    annee: number;
    capitalRembourse: number;
    interetsPaies: number;
    capitalRestant: number;
    cumulRembourse: number;
  }[];
}

function calculerEmprunt(p: ParamsEmprunt): ResultatEmprunt {
  const tauxMensuel = p.tauxAnnuel / 100 / 12;
  const n = p.dureeAns * 12;

  // Mensualité hors assurance (formule annuité constante)
  const mensualiteHA = tauxMensuel === 0
    ? p.montant / n
    : p.montant * tauxMensuel * Math.pow(1 + tauxMensuel, n) / (Math.pow(1 + tauxMensuel, n) - 1);

  const mensualiteAssurance = (p.montant * p.tauxAssurance / 100) / 12;
  const mensualiteTotale = mensualiteHA + mensualiteAssurance;
  const coutInterets = mensualiteHA * n - p.montant;
  const coutAssurance = mensualiteAssurance * n;

  // Tableau d'amortissement annuel
  let capitalRestant = p.montant;
  const tableauAnnuel = [];

  for (let annee = 1; annee <= p.dureeAns; annee++) {
    let interetsPaiesAnnee = 0;
    let capitalRembourseAnnee = 0;

    for (let mois = 0; mois < 12; mois++) {
      const interetsMois = capitalRestant * tauxMensuel;
      const capitalMois = mensualiteHA - interetsMois;
      interetsPaiesAnnee += interetsMois;
      capitalRembourseAnnee += capitalMois;
      capitalRestant -= capitalMois;
    }

    tableauAnnuel.push({
      annee,
      capitalRembourse: Math.round(capitalRembourseAnnee),
      interetsPaies: Math.round(interetsPaiesAnnee),
      capitalRestant: Math.round(Math.max(0, capitalRestant)),
      cumulRembourse: Math.round(p.montant - Math.max(0, capitalRestant)),
    });
  }

  // TAEG simplifié (approximation Newton-Raphson)
  const fluxTotal = mensualiteTotale;
  const coutTotalCredit = fluxTotal * n + p.fraisDossier - p.montant;
  const taeg = ((coutTotalCredit / p.montant) / p.dureeAns) * 100;

  return {
    mensualiteHorsAssurance: Math.round(mensualiteHA),
    mensualiteAssurance: Math.round(mensualiteAssurance),
    mensualiteTotale: Math.round(mensualiteTotale),
    coutInterets: Math.round(coutInterets),
    coutAssurance: Math.round(coutAssurance),
    coutTotal: Math.round(coutInterets + coutAssurance + p.fraisDossier),
    taeg: Math.round(taeg * 100) / 100,
    tableauAnnuel,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €';
const fmtC = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + ' M€';
  if (n >= 1_000) return Math.round(n / 1000) + ' k€';
  return Math.round(n) + ' €';
};

// ─── Graphique répartition capital / intérêts ─────────────────────────────────

function GraphiqueAmortissement({ tableau }: { tableau: ResultatEmprunt['tableauAnnuel'] }) {
  if (!tableau.length) return null;
  const W = 700, H = 220;
  const PAD = { top: 16, right: 20, bottom: 36, left: 64 };
  const w = W - PAD.left - PAD.right;
  const h = H - PAD.top - PAD.bottom;
  const maxMontant = tableau[0].capitalRembourse + tableau[0].interetsPaies;
  const barW = Math.max(2, w / tableau.length - 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {/* Légende */}
      <rect x={PAD.left} y={4} width={12} height={8} rx="2" fill="rgba(148,163,184,0.4)" />
      <text x={PAD.left + 16} y={12} fill="rgba(148,163,184,0.8)" fontSize="10">Capital remboursé</text>
      <rect x={PAD.left + 130} y={4} width={12} height={8} rx="2" fill="#3B82F6" />
      <text x={PAD.left + 146} y={12} fill="rgba(148,163,184,0.8)" fontSize="10">Intérêts payés</text>

      {tableau.map((d, i) => {
        const x = PAD.left + i * (w / tableau.length) + (w / tableau.length - barW) / 2;
        const hCap = (d.capitalRembourse / maxMontant) * h;
        const hInt = (d.interetsPaies / maxMontant) * h;
        const yInt = PAD.top + h - hInt - hCap;
        const yCap = PAD.top + h - hCap;

        return (
          <g key={d.annee}>
            <rect x={x} y={yInt} width={barW} height={hInt} fill="#3B82F6" opacity="0.8" rx="1" />
            <rect x={x} y={yCap} width={barW} height={hCap} fill="rgba(148,163,184,0.35)" rx="1" />
          </g>
        );
      })}

      {/* Axe X */}
      {tableau.filter((_, i) => i % Math.max(1, Math.floor(tableau.length / 8)) === 0 || i === tableau.length - 1).map(d => (
        <text key={d.annee}
          x={PAD.left + (d.annee - 1) * (w / tableau.length) + w / tableau.length / 2}
          y={H - 6} textAnchor="middle" fill="rgba(148,163,184,0.6)" fontSize="10">
          {d.annee}
        </text>
      ))}

      {/* Label axe */}
      <text x={W / 2} y={H - 1} textAnchor="middle" fill="rgba(148,163,184,0.4)" fontSize="9">Années</text>
    </svg>
  );
}

// ─── Comparateur de taux ──────────────────────────────────────────────────────

function ComparateurTaux({ params }: { params: Omit<ParamsEmprunt, 'tauxAnnuel'> }) {
  const taux = [2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {['Taux', 'Mensualité', 'Coût intérêts', 'Coût total crédit'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Taux' ? 'left' : 'right', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {taux.map(t => {
            const r = calculerEmprunt({ ...params, tauxAnnuel: t });
            return (
              <tr key={t} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--accent-blue)' }}>{t.toFixed(1)} %</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{fmt(r.mensualiteHorsAssurance)}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: '#F87171' }}>{fmt(r.coutInterets)}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(r.coutTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function EmpruntPage() {
  const [montant, setMontant] = useState(250000);
  const [dureeAns, setDureeAns] = useState(20);
  const [taux, setTaux] = useState(3.5);
  const [tauxAssurance, setTauxAssurance] = useState(0.3);
  const [fraisDossier, setFraisDossier] = useState(1000);
  const [onglet, setOnglet] = useState<'tableau' | 'comparateur'>('tableau');

  const resultats = useMemo(() => calculerEmprunt({
    montant, dureeAns, tauxAnnuel: taux, tauxAssurance, fraisDossier,
  }), [montant, dureeAns, taux, tauxAssurance, fraisDossier]);

  const pctInterets = resultats.coutInterets / (montant + resultats.coutTotal) * 100;

  return (
    <AuthGate>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.25rem', position: 'relative', zIndex: 1 }}>

      {/* En-tête */}
      <div className="animate-fade-up" style={{ marginBottom: '2.5rem' }}>
        <p className="section-title">Axe financier</p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
          fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0,
        }}>
          Simulateur d'emprunt immobilier
        </h1>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Mensualité, coût total du crédit, tableau d'amortissement et comparaison de taux.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── Paramètres ── */}
        <div className="animate-fade-up delay-1 glass-card" style={{ padding: '1.5rem' }}>
          <p className="section-title">Paramètres du prêt</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>

            {/* Montant */}
            <div>
              <label className="field-label">Montant emprunté</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" className="glass-input" value={montant} step={5000}
                  onChange={e => setMontant(Math.max(0, Number(e.target.value)))} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 14, whiteSpace: 'nowrap' }}>€</span>
              </div>
              <input type="range" className="glass-range" min={10000} max={1000000} step={5000}
                value={montant} onChange={e => setMontant(Number(e.target.value))} style={{ marginTop: 8 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>10 k€</span><span>1 M€</span>
              </div>
            </div>

            {/* Durée */}
            <div>
              <label className="field-label">Durée du prêt</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" className="glass-input" value={dureeAns} step={1}
                  onChange={e => setDureeAns(Math.min(30, Math.max(1, Number(e.target.value))))} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 14, whiteSpace: 'nowrap' }}>ans</span>
              </div>
              <input type="range" className="glass-range" min={5} max={30} step={1}
                value={dureeAns} onChange={e => setDureeAns(Number(e.target.value))} style={{ marginTop: 8 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>5 ans</span><span>30 ans</span>
              </div>
            </div>

            {/* Taux nominal */}
            <div>
              <label className="field-label">Taux nominal annuel</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" className="glass-input" value={taux} step={0.05}
                  onChange={e => setTaux(Math.min(15, Math.max(0.1, Number(e.target.value))))} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>%</span>
              </div>
              <input type="range" className="glass-range" min={0.5} max={8} step={0.05}
                value={taux} onChange={e => setTaux(Number(e.target.value))} style={{ marginTop: 8 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>0,5 %</span><span>8 %</span>
              </div>
            </div>

            {/* Taux assurance */}
            <div>
              <label className="field-label">Taux assurance emprunteur</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" className="glass-input" value={tauxAssurance} step={0.05}
                  onChange={e => setTauxAssurance(Math.min(2, Math.max(0, Number(e.target.value))))} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 14, whiteSpace: 'nowrap' }}>% / an</span>
              </div>
              <input type="range" className="glass-range" min={0} max={1} step={0.05}
                value={tauxAssurance} onChange={e => setTauxAssurance(Number(e.target.value))} style={{ marginTop: 8 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>0 %</span><span>1 %</span>
              </div>
            </div>

            {/* Frais de dossier */}
            <div>
              <label className="field-label">Frais de dossier</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" className="glass-input" value={fraisDossier} step={100}
                  onChange={e => setFraisDossier(Math.max(0, Number(e.target.value)))} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 14, whiteSpace: 'nowrap' }}>€</span>
              </div>
            </div>

          </div>
        </div>

        {/* ── Résultats ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Carte principale mensualité */}
          <div className="animate-fade-up delay-2 glass-card" style={{
            padding: '1.75rem',
            background: 'rgba(59,130,246,0.06)',
            borderColor: 'rgba(59,130,246,0.3)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Mensualité totale</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 600, color: 'var(--accent-blue)', lineHeight: 1 }}>
                  {fmt(resultats.mensualiteTotale)}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  dont {fmt(resultats.mensualiteAssurance)} d'assurance
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Coût total du crédit</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 2.5vw, 1.9rem)', fontWeight: 600, color: '#F87171', lineHeight: 1 }}>
                  {fmt(resultats.coutTotal)}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  intérêts + assurance + frais
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Total remboursé</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 2.5vw, 1.9rem)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {fmt(montant + resultats.coutTotal)}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  pour {fmt(montant)} empruntés
                </div>
              </div>
            </div>

            {/* Barre décomposition */}
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
                <div style={{ flex: montant, background: 'rgba(148,163,184,0.3)', transition: 'flex 0.4s' }} title="Capital" />
                <div style={{ flex: resultats.coutInterets, background: '#F87171', opacity: 0.7, transition: 'flex 0.4s' }} title="Intérêts" />
                <div style={{ flex: resultats.coutAssurance, background: 'var(--accent-amber)', opacity: 0.7, transition: 'flex 0.4s' }} title="Assurance" />
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                {[
                  { label: 'Capital', val: montant, color: 'rgba(148,163,184,0.7)' },
                  { label: 'Intérêts', val: resultats.coutInterets, color: '#F87171' },
                  { label: 'Assurance', val: resultats.coutAssurance, color: 'var(--accent-amber)' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{fmt(item.val)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Graphique amortissement */}
          <div className="animate-fade-up delay-3 glass-card" style={{ padding: '1.5rem' }}>
            <p className="section-title" style={{ marginBottom: '1rem' }}>Amortissement annuel — capital vs intérêts</p>
            <GraphiqueAmortissement tableau={resultats.tableauAnnuel} />
          </div>

          {/* Onglets tableau / comparateur */}
          <div className="animate-fade-up delay-4 glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
              {(['tableau', 'comparateur'] as const).map(o => (
                <button key={o} onClick={() => setOnglet(o)} style={{
                  padding: '6px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: 'none',
                  background: onglet === o ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: onglet === o ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}>
                  {o === 'tableau' ? 'Tableau d\'amortissement' : 'Comparateur de taux'}
                </button>
              ))}
            </div>

            {onglet === 'tableau' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Année', 'Capital remboursé', 'Intérêts payés', 'Capital restant', '% remboursé'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Année' ? 'left' : 'right', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultats.tableauAnnuel.map((d, idx) => {
                      const pct = Math.round((d.cumulRembourse / montant) * 100);
                      const isLast = idx === resultats.tableauAnnuel.length - 1;
                      return (
                        <tr key={d.annee} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isLast ? 'rgba(16,185,129,0.06)' : undefined }}>
                          <td style={{ padding: '9px 12px', color: isLast ? 'var(--accent-emerald)' : 'var(--text-primary)', fontWeight: isLast ? 600 : 400 }}>
                            {d.annee === dureeAns ? `${d.annee} (fin)` : d.annee}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: 'rgba(148,163,184,0.7)' }}>{fmt(d.capitalRembourse)}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: '#F87171' }}>{fmt(d.interetsPaies)}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: isLast ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>{fmt(d.capitalRestant)}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                              <div style={{ width: 48, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-emerald)', transition: 'width 0.3s' }} />
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 28 }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <ComparateurTaux params={{ montant, dureeAns, tauxAssurance, fraisDossier }} />
            )}
          </div>

        </div>
      </div>
      </main>
    </AuthGate>
  );
}

