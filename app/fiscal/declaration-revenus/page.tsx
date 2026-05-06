'use client';

import { useMemo, useState } from 'react';

const PLAFOND_ABATTEMENT_10_PCT = 14_171;

type CvBand = '3' | '4' | '5' | '6plus';

const BAREME_KM: Record<CvBand, { d1: number; r1: number; r2: number; fix2: number; r3: number; fix3: number }> = {
  '3': { d1: 5000, r1: 0.529, r2: 0.316, fix2: 1065, r3: 0.37, fix3: 915 },
  '4': { d1: 5000, r1: 0.568, r2: 0.339, fix2: 1140, r3: 0.397, fix3: 983 },
  '5': { d1: 5000, r1: 0.606, r2: 0.34, fix2: 1322, r3: 0.395, fix3: 1282 },
  '6plus': { d1: 5000, r1: 0.646, r2: 0.361, fix2: 1432, r3: 0.417, fix3: 1388 },
};

function indemniteKm(d: number, cv: CvBand): number {
  const km = Math.max(0, d);
  const b = BAREME_KM[cv];
  if (km <= b.d1) return km * b.r1;
  if (km <= 20_000) return km * b.r2 + b.fix2;
  return km * b.r3 + b.fix3;
}

function formatEuro(value: number): string {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
}

export default function DeclarationRevenusPage() {
  const [salaires, setSalaires] = useState<number | ''>(45_000);
  const [autresFraisReels, setAutresFraisReels] = useState<number | ''>(2_000);
  const [km, setKm] = useState<number | ''>(8_000);
  const [cv, setCv] = useState<CvBand>('5');

  const forfait10 = useMemo(() => {
    const s = typeof salaires === 'number' ? salaires : 0;
    return Math.min(s * 0.1, PLAFOND_ABATTEMENT_10_PCT);
  }, [salaires]);

  const partKm = useMemo(() => {
    const k = typeof km === 'number' ? km : 0;
    return indemniteKm(k, cv);
  }, [km, cv]);

  const fraisReelsTotal = useMemo(() => {
    const autres = typeof autresFraisReels === 'number' ? autresFraisReels : 0;
    return Math.max(0, autres) + partKm;
  }, [autresFraisReels, partKm]);

  const meilleur = forfait10 >= fraisReelsTotal ? 'forfait' : 'reels';
  const ecart = Math.abs(forfait10 - fraisReelsTotal);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.25rem 3rem' }}>
      <p className="section-title">Aspect fiscal · Déclaration de revenus</p>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 2rem' }}>
        Aide à la préparation
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* SAISIE */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Données</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="field-label">Salaires nets à déclarer (€)</label>
              <input type="number" min={0} step={100} value={salaires === '' ? '' : salaires}
                onChange={e => setSalaires(e.target.value === '' ? '' : Number(e.target.value))}
                className="glass-input" />
            </div>
            <div>
              <label className="field-label">Autres frais réels — hors véhicule (€)</label>
              <input type="number" min={0} step={50} value={autresFraisReels === '' ? '' : autresFraisReels}
                onChange={e => setAutresFraisReels(e.target.value === '' ? '' : Number(e.target.value))}
                className="glass-input" />
            </div>
            <div>
              <label className="field-label">Kilomètres professionnels / an</label>
              <input type="number" min={0} step={100} value={km === '' ? '' : km}
                onChange={e => setKm(e.target.value === '' ? '' : Number(e.target.value))}
                className="glass-input" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="field-label">Puissance fiscale (barème kilométrique)</label>
              <select value={cv} onChange={e => setCv(e.target.value as CvBand)} className="glass-select">
                <option value="3">3 CV</option>
                <option value="4">4 CV</option>
                <option value="5">5 CV</option>
                <option value="6plus">6 CV et +</option>
              </select>
              <p style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Indemnité kilométrique estimée : <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{formatEuro(partKm)}</span>
              </p>
            </div>
          </div>
        </div>

        {/* COMPARAISON */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ padding: '1.25rem', background: 'rgba(59,130,246,0.08)', border: `2px solid ${meilleur === 'forfait' ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.15)'}`, borderRadius: 14, transition: 'border-color 0.3s' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#93C5FD' }}>Forfait 10 %</h3>
            <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatEuro(forfait10)}</p>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>min(10 % des salaires, plafond {formatEuro(PLAFOND_ABATTEMENT_10_PCT)})</p>
            {meilleur === 'forfait' && <span className="badge badge-green" style={{ marginTop: '0.75rem' }}>✓ Plus avantageux</span>}
          </div>
          <div style={{ padding: '1.25rem', background: 'rgba(99,102,241,0.08)', border: `2px solid ${meilleur === 'reels' ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.15)'}`, borderRadius: 14, transition: 'border-color 0.3s' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#A5B4FC' }}>Frais réels (estimés)</h3>
            <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatEuro(fraisReelsTotal)}</p>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              autres frais + indemnité km ({typeof km === 'number' ? km.toLocaleString('fr-FR') : 0} km, {cv} CV)
            </p>
            {meilleur === 'reels' && <span className="badge badge-green" style={{ marginTop: '0.75rem' }}>✓ Plus avantageux</span>}
          </div>
        </div>

        {/* VERDICT */}
        <div style={{ padding: '1.25rem', background: meilleur === 'forfait' ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${meilleur === 'forfait' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`, borderRadius: 14 }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 700, color: meilleur === 'forfait' ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>Comparaison</h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {meilleur === 'forfait' ? (
              <>Le <strong>forfait 10 %</strong> est plus favorable d'environ <strong style={{ color: 'var(--text-primary)' }}>{formatEuro(ecart)}</strong> par rapport à vos frais réels déclarés.</>
            ) : (
              <>Les <strong>frais réels</strong> (avec barème km) sont plus favorables d'environ <strong style={{ color: 'var(--text-primary)' }}>{formatEuro(ecart)}</strong> par rapport au forfait.</>
            )}
          </p>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Vous retenez la déduction la plus avantageuse si vous optez pour les frais réels (et que vous pouvez les justifier). Ceci ne remplace pas le calcul officiel de l'impôt.
          </p>
        </div>

        {/* CHECKLIST */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Réductions / crédits d'impôt courants</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              { title: "Garde d'enfants de moins de 6 ans", desc: "Crèche, assistante maternelle agréée, garde à domicile déclarée — pensez aux cases et plafonds." },
              { title: "Emploi à domicile", desc: "Ménage, jardinage, garde dans le cadre des services à la personne — conservez les attestations fiscales." },
            ].map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-surface-md)', border: '1px solid var(--border-glass)', borderRadius: 10 }}>
                <input type="checkbox" style={{ marginTop: 2, accentColor: 'var(--accent-blue)', flexShrink: 0 }} readOnly tabIndex={-1} aria-hidden />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{item.title}</strong> — {item.desc}
                </span>
              </div>
            ))}
          </div>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Les cases cochées ici sont des rappels visuels (non enregistrés). Pour une vraie checklist interactive, remplace les <code style={{ background: 'var(--bg-surface-md)', padding: '0.1rem 0.3rem', borderRadius: 4 }}>readOnly</code> par un <code style={{ background: 'var(--bg-surface-md)', padding: '0.1rem 0.3rem', borderRadius: 4 }}>useState</code> par ligne.
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          * Outil pédagogique simplifié. Plafonds et barème kilométrique exact : voir impots.gouv.fr
        </p>
      </div>
    </div>
  );
}
