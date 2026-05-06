'use client';

import { useState, useEffect, useMemo } from 'react';

interface DonationPassee {
  id: number;
  montant: number;
  type: 'droit_commun' | 'sarkozy';
}

const getValeurNuePropriete = (valeurPP: number, age: number) => {
  if (age < 21) return valeurPP * 0.10;
  if (age < 31) return valeurPP * 0.20;
  if (age < 41) return valeurPP * 0.30;
  if (age < 51) return valeurPP * 0.40;
  if (age < 61) return valeurPP * 0.50;
  if (age < 71) return valeurPP * 0.60;
  if (age < 81) return valeurPP * 0.70;
  if (age < 91) return valeurPP * 0.80;
  return valeurPP * 0.90;
};

export default function AuditDonationPage() {
  const [valeurBien, setValeurBien] = useState<number>(200000);
  const [isDemembre, setIsDemembre] = useState<boolean>(false);
  const [ageUsufruitier, setAgeUsufruitier] = useState<number>(65);
  const [donationsPassees, setDonationsPassees] = useState<DonationPassee[]>([]);
  const [baremes, setBaremes] = useState<any>(null);

  useEffect(() => {
    fetch('/baremes.json')
      .then(res => res.json())
      .then(data => setBaremes(data))
      .catch(err => console.error("Erreur chargement barèmes:", err));
  }, []);

  const ajouterDonation = () => {
    setDonationsPassees([...donationsPassees, { id: Date.now(), montant: 0, type: 'droit_commun' }]);
  };
  const supprimerDonation = (id: number) => {
    setDonationsPassees(donationsPassees.filter(d => d.id !== id));
  };
  const modifierDonation = (id: number, champ: string, valeur: any) => {
    setDonationsPassees(donationsPassees.map(d => d.id === id ? { ...d, [champ]: valeur } : d));
  };

  const calculs = useMemo(() => {
    if (!baremes) return null;
    const valeurTaxableActuelle = isDemembre
      ? getValeurNuePropriete(valeurBien, ageUsufruitier)
      : valeurBien;
    let abattementCommunRestant = baremes.abattements.enfant || 100000;
    let abattementSarkozyRestant = baremes.abattements.sarkozy || 31865;
    donationsPassees.forEach(d => {
      if (d.type === 'sarkozy') abattementSarkozyRestant -= d.montant;
      else abattementCommunRestant -= d.montant;
    });
    abattementCommunRestant = Math.max(0, abattementCommunRestant);
    abattementSarkozyRestant = Math.max(0, abattementSarkozyRestant);
    const assietteFinale = Math.max(0, valeurTaxableActuelle - abattementCommunRestant);
    return { valeurTaxableActuelle, abattementCommunRestant, abattementSarkozyRestant, assietteFinale, tauxNP: Math.round((valeurTaxableActuelle / valeurBien) * 100) };
  }, [valeurBien, isDemembre, ageUsufruitier, donationsPassees, baremes]);

  if (!baremes || !calculs) return (
    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
      Chargement de l'audit…
    </div>
  );

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem 3rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2rem', letterSpacing: '-0.02em' }}>
        Audit de Donation Expert
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

        {/* BLOC 1 : PROJET */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 22, height: 22, background: 'rgba(59,130,246,0.3)', border: '1px solid rgba(59,130,246,0.5)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#93C5FD' }}>1</span>
            Projet Immobilier / Titres
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label className="field-label">Valeur en Pleine Propriété (€)</label>
              <input type="number" value={valeurBien} onChange={e => setValeurBien(Number(e.target.value))} className="glass-input" style={{ fontWeight: 700, fontSize: '1.2rem' }} />
            </div>

            <div style={{ padding: '1rem', background: isDemembre ? 'rgba(59,130,246,0.08)' : 'var(--bg-surface)', border: `1px solid ${isDemembre ? 'rgba(59,130,246,0.3)' : 'var(--border-glass)'}`, borderRadius: 12, transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isDemembre ? '1rem' : 0 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Démembrement (Réserve d'usufruit)</span>
                <button
                  onClick={() => setIsDemembre(!isDemembre)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: isDemembre ? 'rgba(59,130,246,0.6)' : 'var(--bg-surface-hi)',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, background: '#fff', borderRadius: '50%',
                    position: 'absolute', top: 4,
                    left: isDemembre ? 24 : 4,
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
              {isDemembre && (
                <div>
                  <label className="field-label" style={{ color: '#93C5FD' }}>Âge du donateur</label>
                  <input type="number" value={ageUsufruitier} onChange={e => setAgeUsufruitier(Number(e.target.value))} className="glass-input" />
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontStyle: 'italic' }}>Valeur fiscale de la Nue-Propriété : {calculs.tauxNP}%</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BLOC 2 : HISTORIQUE */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 22, height: 22, background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: '#FCD34D' }}>2</span>
              Passé Fiscal (15 ans)
            </h2>
            <button onClick={ajouterDonation} className="btn-primary" style={{ fontSize: '0.72rem', padding: '0.4rem 0.9rem' }}>+ Ajouter</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 250, overflowY: 'auto' }}>
            {donationsPassees.map(d => (
              <div key={d.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'var(--bg-surface-md)', border: '1px solid var(--border-glass)', borderRadius: 10, padding: '0.6rem 0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <select value={d.type} onChange={e => modifierDonation(d.id, 'type', e.target.value)} className="glass-select" style={{ marginBottom: '0.4rem', fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}>
                    <option value="droit_commun">Donation Classique</option>
                    <option value="sarkozy">Don Argent (Sarkozy)</option>
                  </select>
                  <input type="number" value={d.montant} onChange={e => modifierDonation(d.id, 'montant', Number(e.target.value))} className="glass-input" style={{ fontSize: '0.875rem' }} placeholder="Montant" />
                </div>
                <button onClick={() => supprimerDonation(d.id)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--border-glass)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', transition: 'color 0.2s, border-color 0.2s' }}>×</button>
              </div>
            ))}
            {donationsPassees.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center', border: '1px dashed var(--border-glass)', borderRadius: 12, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Aucun antécédent fiscal
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RÉSULTATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>Abattement Enfant Restant</span>
          <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>{calculs.abattementCommunRestant.toLocaleString()} €</p>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '1rem 0 0.75rem' }} />
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Don Sarkozy restant</span>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{calculs.abattementSarkozyRestant.toLocaleString()} €</p>
        </div>

        <div style={{ padding: '1.5rem', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16 }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>Assiette Actuelle Taxable</span>
          <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round(calculs.valeurTaxableActuelle).toLocaleString()} €</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Basé sur la {isDemembre ? 'Nue-Propriété' : 'Pleine Propriété'}</p>
        </div>

        <div style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 16 }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '0.5rem' }}>Reliquat Net Taxable</span>
          <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2.8rem', fontWeight: 700, color: '#fff' }}>{Math.round(calculs.assietteFinale).toLocaleString()} €</p>
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>Montant sur lequel des droits seront calculés après utilisation des abattements restants.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
