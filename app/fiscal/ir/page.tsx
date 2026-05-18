'use client';
import { AuthGate } from '@/components/auth-gate';

import { useState, useEffect, useMemo } from 'react';

const n = (v: number): string => Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const calculerPartsDepuisListe = (situation: string, enfants: any[]): number => {
  let parts = situation === 'marie_pacs' ? 2 : 1;
  const eligibles = enfants.filter(enf => {
    if (enf.age < 21) return true;
    if (enf.age < 25 && enf.estEtudiant) return true;
    return false;
  });
  const trie = [...eligibles].sort((a, b) => (a.gardeAlternee === b.gardeAlternee ? 0 : a.gardeAlternee ? 1 : -1));
  trie.forEach((enf, index) => {
    const rang = index + 1;
    const valeurPleine = rang >= 3 ? 1 : 0.5;
    parts += enf.gardeAlternee ? valeurPleine / 2 : valeurPleine;
  });
  return parts;
};

const calculerImpotDetails = (revenuImposable: number, parts: number, tranches: any[]) => {
  if (!tranches || revenuImposable <= 0) return { total: 0, tmi: 0 };
  const quotientFamilial = revenuImposable / parts;
  let impotAccumule = 0;
  let seuilPrecedent = 0;
  let tmi = 0;
  for (const tranche of tranches) {
    const limite = tranche.limite || Infinity;
    if (quotientFamilial > seuilPrecedent) {
      const montantTranche = Math.min(quotientFamilial, limite) - seuilPrecedent;
      impotAccumule += montantTranche * tranche.taux;
      tmi = tranche.taux * 100;
      seuilPrecedent = limite;
    } else {
      break;
    }
  }
  return { total: Math.round(impotAccumule * parts), tmi };
};

export default function IRPage() {
  const [annee, setAnnee] = useState('2024');
  const [dataFiscal, setDataFiscal] = useState<any>(null);
  const [situation, setSituation] = useState<'celibataire' | 'marie_pacs'>('celibataire');
  const [revenus, setRevenus] = useState<Record<string, number>>({});
  const [enfants, setEnfants] = useState([
    { id: 1, age: 10, estEtudiant: false, gardeAlternee: false }
  ]);

  useEffect(() => {
    fetch('/baremes-ir.json')
      .then(res => res.json())
      .then(data => setDataFiscal(data))
      .catch(err => console.error("Erreur chargement JSON:", err));
  }, []);

  const ajouterEnfant = () => {
    setEnfants([...enfants, { id: Date.now(), age: 18, estEtudiant: true, gardeAlternee: false }]);
  };
  const supprimerEnfant = (id: number) => {
    setEnfants(enfants.filter(e => e.id !== id));
  };
  const updateEnfant = (id: number, field: string, value: any) => {
    setEnfants(enfants.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const resultats = useMemo(() => {
    if (!dataFiscal || !dataFiscal.baremes[annee]) return null;
    const config = dataFiscal.baremes[annee];
    const metadata = dataFiscal.metadata;
    const params = config.configuration;
    let totalBrut = 0;
    let totalCharges = 0;
    metadata.sections_avis.forEach((section: any) => {
      section.cases.forEach((c: any) => {
        const val = revenus[c.id] || 0;
        if (c.type === 'revenu') totalBrut += val;
        if (c.type === 'charge') totalCharges += val;
      });
    });
    const abattement = Math.min(Math.max(totalBrut * 0.10, 494), params.abattement_10_max);
    const revenuNetGlobal = Math.max(0, totalBrut - abattement - totalCharges);
    const partsA = calculerPartsDepuisListe(situation, enfants);
    const resA = calculerImpotDetails(revenuNetGlobal, partsA, config.tranches_ir);
    const enfantADetacher = enfants.find(e => e.age >= 18);
    let partsB = partsA;
    let revenuNetB = revenuNetGlobal;
    if (enfantADetacher) {
      const listeB = enfants.filter(e => e.id !== enfantADetacher.id);
      partsB = calculerPartsDepuisListe(situation, listeB);
      revenuNetB = Math.max(0, revenuNetGlobal - params.pension_max);
    }
    const resB = calculerImpotDetails(revenuNetB, partsB, config.tranches_ir);
    return { impotA: resA.total, tmiA: resA.tmi, partsA, impotB: resB.total, tmiB: resB.tmi, partsB, gain: resA.total - resB.total, revenuNetGlobal, abattement, totalBrut, totalCharges };
  }, [annee, dataFiscal, situation, enfants, revenus]);

  if (!dataFiscal) return (
    <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
      Initialisation…
    </div>
  );

  const btnSituation = (active: boolean) => ({
    flex: 1, padding: '0.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s',
    background: active ? 'rgba(59,130,246,0.2)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    outline: active ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
  } as React.CSSProperties);

  return (
    <AuthGate>
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.25rem 3rem' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div>
          <p className="section-title">Aspect fiscal · Simulateur IR Expert</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            Optimisation & Arbitrage Fiscal
          </h1>
        </div>
        <select value={annee} onChange={e => setAnnee(e.target.value)} className="glass-select" style={{ width: 'auto', minWidth: 200 }}>
          {Object.keys(dataFiscal.baremes).map(a => <option key={a} value={a}>BARÈME FISCAL {a}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* COLONNE GAUCHE : SAISIE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Foyer & Enfants */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>1. Foyer & Enfants</h2>
              <button onClick={ajouterEnfant} className="btn-primary" style={{ fontSize: '0.7rem', padding: '0.3rem 0.7rem' }}>+ Enfant</button>
            </div>

            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 10, padding: 4, marginBottom: '1rem' }}>
              <button onClick={() => setSituation('celibataire')} style={btnSituation(situation === 'celibataire')}>Célibataire</button>
              <button onClick={() => setSituation('marie_pacs')} style={btnSituation(situation === 'marie_pacs')}>Marié / PACS</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {enfants.map(enf => (
                <div key={enf.id} style={{ padding: '0.75rem', background: 'var(--bg-surface-md)', border: '1px solid var(--border-glass)', borderRadius: 12, position: 'relative' }}>
                  <button
                    onClick={() => supprimerEnfant(enf.id)}
                    style={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, borderRadius: '50%', background: 'rgba(239,68,68,0.8)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '0.75rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >×</button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Âge</label>
                      <input type="number" value={enf.age} onChange={e => updateEnfant(enf.id, 'age', Number(e.target.value))} className="glass-input" style={{ padding: '0.4rem 0.6rem' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingTop: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={enf.estEtudiant} onChange={e => updateEnfant(enf.id, 'estEtudiant', e.target.checked)} style={{ accentColor: 'var(--accent-blue)' }} />
                        Étudiant
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.72rem', color: '#93C5FD' }}>
                        <input type="checkbox" checked={enf.gardeAlternee} onChange={e => updateEnfant(enf.id, 'gardeAlternee', e.target.checked)} style={{ accentColor: 'var(--accent-blue)' }} />
                        Alternée
                      </label>
                    </div>
                  </div>
                  {(enf.age >= 25 || (enf.age >= 21 && !enf.estEtudiant)) && (
                    <p style={{ fontSize: '0.7rem', color: '#FCA5A5', marginTop: '0.4rem', fontWeight: 600 }}>⚠️ Inéligible au rattachement</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Revenus dynamiques */}
          {dataFiscal.metadata.sections_avis.map((section: any) => (
            <div key={section.categorie} className="glass-card" style={{ padding: '1.5rem' }}>
              <h2 style={{ margin: '0 0 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{section.categorie}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {section.cases.map((c: any) => (
                  <div key={c.id}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem', letterSpacing: '0.06em' }}>{c.label} ({c.id})</label>
                    <input type="number" value={revenus[c.id] || ''} onChange={e => setRevenus({ ...revenus, [c.id]: Number(e.target.value) })} className="glass-input" placeholder="0 €" style={{ fontWeight: 700 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* COLONNE DROITE : RÉSULTATS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {resultats && (
            <>
              {/* Options A / B */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem', border: resultats.gain <= 0 ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--border-glass)', background: resultats.gain <= 0 ? 'rgba(16,185,129,0.07)' : undefined }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Option A · Rattachement</span>
                  <p style={{ margin: '0.5rem 0 0', fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{n(resultats.impotA)} €</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-blue">{resultats.partsA} parts</span>
                    <span className="badge badge-blue">TMI {resultats.tmiA}%</span>
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', border: resultats.gain > 0 ? '1px solid rgba(59,130,246,0.5)' : '1px solid var(--border-glass)', background: resultats.gain > 0 ? 'rgba(59,130,246,0.08)' : undefined }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Option B · Pension + détachement</span>
                  <p style={{ margin: '0.5rem 0 0', fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, color: '#93C5FD', letterSpacing: '-0.03em' }}>{n(resultats.impotB)} €</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-blue">{resultats.partsB} parts</span>
                    <span className="badge badge-blue">TMI {resultats.tmiB}%</span>
                  </div>
                </div>
              </div>

              {/* Décomposition */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Décomposition du Net Imposable</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    { label: 'Revenus bruts (Salaires)', value: `${n(resultats.totalBrut)} €`, color: 'var(--text-primary)' },
                    { label: 'Abattement Forfaitaire (10%)', value: `− ${n(resultats.abattement)} €`, color: 'var(--accent-emerald)' },
                    { label: 'Charges déductibles (6DD, 6GU…)', value: `− ${n(resultats.totalCharges)} €`, color: 'var(--accent-emerald)' },
                  ].map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{row.label}</span>
                      <span style={{ fontWeight: 700, color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', color: '#93C5FD' }}>Revenu Net Imposable Global</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, color: '#93C5FD' }}>{n(resultats.revenuNetGlobal)} €</span>
                  </div>
                </div>
              </div>

              {/* Verdict */}
              <div style={{ padding: '1.5rem 2rem', background: resultats.gain > 0 ? 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(99,102,241,0.25))' : 'rgba(255,255,255,0.04)', border: resultats.gain > 0 ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(16,185,129,0.4)', borderRadius: 20 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 0.5rem', fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                      {resultats.gain > 0 ? `Optimisation : +${n(resultats.gain)} €` : 'Le rattachement est gagnant'}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {resultats.gain > 0 ? "Détachez un enfant majeur et versez-lui une pension pour maximiser vos économies." : "Conservez tous vos enfants au foyer pour bénéficier du maximum de parts."}
                    </p>
                  </div>
                  <div style={{ padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-glass)', borderRadius: 16, backdropFilter: 'blur(12px)', textAlign: 'center', minWidth: 160 }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>Gain Réel Net</span>
                    <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{Math.abs(resultats.gain).toLocaleString()} €</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      </main>
    </AuthGate>
  );
}
