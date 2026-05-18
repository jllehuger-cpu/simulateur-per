'use client';
import { AuthGate } from '@/components/auth-gate';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

const TABLE_INSEE: Record<'H' | 'F', Record<number, number>> = {
  'H': { 0:79.45, 10:69.85, 20:59.98, 30:50.33, 40:40.78, 50:31.59, 60:23.19, 61:22.41, 62:21.64, 63:20.89, 64:20.14, 65:19.39, 66:18.65, 67:17.91, 68:17.17, 69:16.45, 70:15.73, 75:12.24, 80:9.02, 85:6.28, 90:4.23, 95:2.92, 100:2.61 },
  'F': { 0:85.40, 10:75.76, 20:65.83, 30:55.97, 40:46.20, 50:36.68, 60:27.63, 61:26.75, 62:25.88, 63:25.01, 64:24.14, 65:23.28, 66:22.42, 67:21.57, 68:20.72, 69:19.87, 70:19.02, 75:14.93, 80:11.10, 85:7.76, 90:5.16, 95:3.40, 100:2.34 }
};

const getEsperance = (age: number, sexe: 'H' | 'F') => {
  const ages = Object.keys(TABLE_INSEE[sexe]).map(Number).sort((a,b) => b-a);
  const findAge = ages.find(a => a <= age) || 0;
  return TABLE_INSEE[sexe][findAge as keyof typeof TABLE_INSEE['H']] || 2;
};

const calculerDroitsLigneDirecte = (baseTaxable: number, tranchesFiscales: any[]) => {
  if (!tranchesFiscales || tranchesFiscales.length === 0) return 0;
  let droits = 0;
  let reste = baseTaxable;
  let tranchePrecedente = 0;
  for (const t of tranchesFiscales) {
    const limiteActuelle = t.limite === null ? Infinity : t.limite;
    const assietteDansTranche = Math.min(Math.max(0, reste), limiteActuelle - tranchePrecedente);
    if (assietteDansTranche > 0) {
      droits += assietteDansTranche * t.taux;
      reste -= assietteDansTranche;
    }
    tranchePrecedente = limiteActuelle;
    if (reste <= 0) break;
  }
  return droits;
};

export default function DemembrementPage() {
  const [methode, setMethode] = useState<'fiscal' | 'economique'>('fiscal');
  const [typeDossier, setTypeDossier] = useState<'solo' | 'couple'>('couple');
  const [prixPP, setPrixPP] = useState<number>(500000);
  const [repartitionH, setRepartitionH] = useState<number>(50);
  const [nbEnfants, setNbEnfants] = useState<number>(2);
  const [ageH, setAgeH] = useState<number>(68);
  const [ageF, setAgeF] = useState<number>(65);
  const [ageSolo, setAgeSolo] = useState<number>(65);
  const [sexeSolo, setSexeSolo] = useState<'H' | 'F'>('F');
  const [rendement, setRendement] = useState<number>(4);
  const [tauxActualisation, setTauxActualisation] = useState<number>(3);
  const [baremes, setBaremes] = useState<any>(null);

  useEffect(() => {
    fetch('/baremes.json').then(res => res.json()).then(data => setBaremes(data));
  }, []);

  const calculs = useMemo(() => {
    const i = tauxActualisation / 100;
    const getFiscalPctU = (a: number) => {
      if (a < 21) return 90; if (a < 31) return 80; if (a < 41) return 70;
      if (a < 51) return 60; if (a < 61) return 50; if (a < 71) return 40;
      if (a < 81) return 30; if (a < 91) return 20; return 10;
    };
    const getEconoPctU = (valPP: number, a: number, s: 'H' | 'F') => {
      const n = getEsperance(a, s);
      const flux = valPP * (rendement / 100);
      const uE = i === 0 ? flux * n : flux * (1 - Math.pow(1 + i, -n)) / i;
      return (uE / valPP) * 100;
    };
    const processPerson = (valPP: number, a: number, s: 'H' | 'F') => {
      const pct = methode === 'fiscal' ? getFiscalPctU(a) : getEconoPctU(valPP, a, s);
      const u = (valPP * pct) / 100;
      return { u, np: valPP - u, pct };
    };
    if (typeDossier === 'solo') {
      const res = processPerson(prixPP, ageSolo, sexeSolo);
      return { h: res, f: { u: 0, np: 0, pct: 0 }, total: { u: res.u, np: res.np, pp: prixPP } };
    } else {
      const ppH = (prixPP * repartitionH) / 100;
      const ppF = prixPP - ppH;
      const resH = processPerson(ppH, ageH, 'H');
      const resF = processPerson(ppF, ageF, 'F');
      return { h: resH, f: resF, total: { u: resH.u + resF.u, np: resH.np + resF.np, pp: prixPP } };
    }
  }, [methode, typeDossier, prixPP, repartitionH, ageH, ageF, ageSolo, sexeSolo, rendement, tauxActualisation, baremes]);

  const montantAbattement = baremes?.abattements?.enfant || 100000;
  const multiplicateurAbattement = typeDossier === 'couple' ? 2 : 1;
  const abattementTotal = montantAbattement * multiplicateurAbattement * nbEnfants;
  const resteTaxableTotal = Math.max(0, calculs.total.np - abattementTotal);
  const partTaxableParEnfant = resteTaxableTotal / nbEnfants;
  const droitsParEnfant = baremes
    ? calculerDroitsLigneDirecte(partTaxableParEnfant, baremes.baremes.ligne_directe)
    : 0;

  const btnToggle = (active: boolean) => ({
    padding: '0.4rem 1.2rem',
    borderRadius: 8,
    fontSize: '0.75rem',
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: active ? 'rgba(59,130,246,0.25)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    outline: active ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
  } as React.CSSProperties);

  return (
    <AuthGate>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem 3rem' }}>

      {/* BARRE TOGGLES */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link href="/civil" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'none' }}>← Pôle civil</Link>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 10, padding: 4 }}>
            <button onClick={() => setMethode('fiscal')} style={btnToggle(methode === 'fiscal')}>FISCAL</button>
            <button onClick={() => setMethode('economique')} style={btnToggle(methode === 'economique')}>ÉCONOMIQUE</button>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 10, padding: 4 }}>
            <button onClick={() => setTypeDossier('solo')} style={btnToggle(typeDossier === 'solo')}>INDIVIDUEL</button>
            <button onClick={() => setTypeDossier('couple')} style={btnToggle(typeDossier === 'couple')}>COUPLE</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>

        {/* COLONNE PARAMÈTRES */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Patrimoine & Famille</h2>

          <div>
            <label className="field-label">Valeur Pleine Propriété (€)</label>
            <input type="number" value={prixPP} onChange={e => setPrixPP(Number(e.target.value))} className="glass-input" style={{ fontWeight: 700, fontSize: '1.2rem' }} />
          </div>

          <div>
            <label className="field-label">Nombre d'enfants</label>
            <input type="number" value={nbEnfants} onChange={e => setNbEnfants(Number(e.target.value))} className="glass-input" min="1" />
          </div>

          {typeDossier === 'couple' && (
            <div>
              <label className="field-label">Répartition (H: {repartitionH}% / F: {100 - repartitionH}%)</label>
              <input type="range" min="0" max="100" value={repartitionH} onChange={e => setRepartitionH(Number(e.target.value))} className="glass-range" />
            </div>
          )}

          {methode === 'economique' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '1rem' }}>
              <div>
                <label className="field-label" style={{ color: '#93C5FD' }}>Rendement %</label>
                <input type="number" step="0.1" value={rendement} onChange={e => setRendement(Number(e.target.value))} className="glass-input" />
              </div>
              <div>
                <label className="field-label" style={{ color: '#93C5FD' }}>Actualisation %</label>
                <input type="number" step="0.1" value={tauxActualisation} onChange={e => setTauxActualisation(Number(e.target.value))} className="glass-input" />
              </div>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '0.25rem 0' }} />
          <h2 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Âges & Espérance de vie</h2>

          {typeDossier === 'couple' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase' }}>Monsieur : {ageH} ans</label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Exp. {getEsperance(ageH, 'H')} ans</span>
                </div>
                <input type="range" min="0" max="100" value={ageH} onChange={e => setAgeH(Number(e.target.value))} className="glass-range" />
              </div>
              <div style={{ background: 'rgba(236,72,153,0.07)', border: '1px solid rgba(236,72,153,0.2)', borderRadius: 12, padding: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#F9A8D4', textTransform: 'uppercase' }}>Madame : {ageF} ans</label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Exp. {getEsperance(ageF, 'F')} ans</span>
                </div>
                <input type="range" min="0" max="100" value={ageF} onChange={e => setAgeF(Number(e.target.value))} className="glass-range" style={{ '--thumb-color': '#EC4899' } as any} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSexeSolo('H')} style={{ ...btnToggle(sexeSolo === 'H'), flex: 1 }}>HOMME</button>
                <button onClick={() => setSexeSolo('F')} style={{ ...btnToggle(sexeSolo === 'F'), flex: 1 }}>FEMME</button>
              </div>
              <input type="range" min="0" max="100" value={ageSolo} onChange={e => setAgeSolo(Number(e.target.value))} className="glass-range" />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{ageSolo} ans</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Espérance : {getEsperance(ageSolo, sexeSolo)} ans</span>
              </div>
            </div>
          )}
        </div>

        {/* COLONNE RÉSULTATS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* TABLEAU RÉCAPITULATIF */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-md)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Origine</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nue-Propriété (Transmis)</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Usufruit (Retenu)</th>
                </tr>
              </thead>
              <tbody>
                {typeDossier === 'couple' ? (
                  <>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#93C5FD' }}>Monsieur</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.1rem' }}>{Math.round(calculs.h.np).toLocaleString()} €</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{Math.round(calculs.h.u).toLocaleString()} € ({Math.round(calculs.h.pct)}%)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#F9A8D4' }}>Madame</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.1rem' }}>{Math.round(calculs.f.np).toLocaleString()} €</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{Math.round(calculs.f.u).toLocaleString()} € ({Math.round(calculs.f.pct)}%)</td>
                    </tr>
                  </>
                ) : (
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Titulaire Unique</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.1rem' }}>{Math.round(calculs.h.np).toLocaleString()} €</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{Math.round(calculs.h.u).toLocaleString()} € ({Math.round(calculs.h.pct)}%)</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: methode === 'fiscal' ? 'rgba(99,102,241,0.2)' : 'rgba(59,130,246,0.2)', borderTop: '1px solid var(--border-glass)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Total NP à transmettre</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 900, fontSize: '1.4rem', color: 'var(--accent-emerald)' }}>{Math.round(calculs.total.np).toLocaleString()} €</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>{Math.round(calculs.total.u).toLocaleString()} €</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* SYNTHÈSE FISCALE */}
          <div className="glass-card" style={{ padding: '1.5rem', border: resteTaxableTotal === 0 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)', background: resteTaxableTotal === 0 ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>Simulation des Droits de Mutation</h3>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'var(--bg-surface-md)', border: '1px solid var(--border-glass)', padding: '0.25rem 0.6rem', borderRadius: 999, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Art. 779-I et 777 du CGI</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Abattement ({typeDossier === 'couple' ? '2 parents' : '1 parent'} × {nbEnfants} enfant{nbEnfants > 1 ? 's' : ''})</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>−{abattementTotal.toLocaleString()} €</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Assiette taxable totale</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round(resteTaxableTotal).toLocaleString()} €</span>
                </div>
                <div style={{ background: 'var(--bg-surface-md)', border: '1px solid var(--border-glass)', borderRadius: 10, padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Part taxable / enfant</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round(partTaxableParEnfant).toLocaleString()} €</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 12, padding: '1.25rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Droits à payer / enfant</span>
                <span style={{ fontSize: '2.5rem', fontWeight: 900, color: droitsParEnfant === 0 ? 'var(--accent-emerald)' : 'var(--accent-amber)', fontFamily: 'var(--font-display)' }}>
                  {droitsParEnfant === 0 ? '0 €' : `${Math.round(droitsParEnfant).toLocaleString()} €`}
                </span>
                {droitsParEnfant > 0 ? (
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                    Soit {Math.round(droitsParEnfant * nbEnfants).toLocaleString()} € au total
                  </p>
                ) : (
                  <p style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', marginTop: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Franchise de droits</p>
                )}
              </div>
            </div>
          </div>

          {/* NOTE */}
          <div style={{ padding: '0.75rem 1rem', border: '1px dashed var(--border-glass)', borderRadius: 10, fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6 }}>
            {methode === 'fiscal'
              ? "L'évaluation fiscale (Art. 669 CGI) est obligatoire pour le calcul des droits. Elle suit un barème fixe par tranches d'âge de 10 ans."
              : "L'évaluation économique utilise l'espérance de vie réelle (INSEE 2019) pour estimer la valeur de marché réelle du patrimoine démembré."}
          </div>
        </div>
      </div>
      </main>
    </AuthGate>
  );
}
