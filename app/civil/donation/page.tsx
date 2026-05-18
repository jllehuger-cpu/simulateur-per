'use client';
import { AuthGate } from '@/components/auth-gate';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

export default function DonationPage() {
  const [prixPP, setPrixPP] = useState<number>(250000);
  const [lienParente, setLienParente] = useState<string>('ligne_directe');
  const [baremes, setBaremes] = useState<any>(null);

  useEffect(() => {
    fetch('/baremes.json')
      .then(res => res.json())
      .then(data => setBaremes(data))
      .catch(err => console.error("Erreur JSON:", err));
  }, []);

  const calculs = useMemo(() => {
    if (!baremes) return null;
    const cleAbattement = lienParente === 'ligne_directe' ? 'enfant' : lienParente;
    const abattement = baremes.abattements[cleAbattement] || 0;
    const assietteTaxable = Math.max(0, prixPP - abattement);
    const tranchesFiscales = baremes.baremes[lienParente] || [];
    let droitsTotaux = 0;
    let reste = assietteTaxable;
    let tranchePrecedente = 0;
    const detailTranches = [];
    for (const t of tranchesFiscales) {
      const limiteActuelle = t.limite === null ? Infinity : t.limite;
      const assietteDansTranche = Math.min(Math.max(0, reste), limiteActuelle - tranchePrecedente);
      if (assietteDansTranche > 0) {
        const montantTranche = assietteDansTranche * t.taux;
        droitsTotaux += montantTranche;
        detailTranches.push({
          label: t.limite === null ? `Plus de ${tranchePrecedente.toLocaleString()} €` : `Jusqu'à ${t.limite.toLocaleString()} €`,
          assiette: assietteDansTranche,
          taux: (t.taux * 100).toFixed(0),
          impot: montantTranche
        });
        reste -= assietteDansTranche;
      }
      tranchePrecedente = limiteActuelle;
      if (reste <= 0) break;
    }
    return { abattement, assietteTaxable, droitsTotaux, detailTranches };
  }, [prixPP, lienParente, baremes]);

  if (!baremes || !calculs) return (
    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
      Initialisation…
    </div>
  );

  return (
    <AuthGate>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem 3rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* COLONNE GAUCHE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Configuration</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="field-label">Lien de parenté</label>
                <select value={lienParente} onChange={e => setLienParente(e.target.value)} className="glass-select">
                  <option value="ligne_directe">Ligne directe (Enfant)</option>
                  <option value="conjoint">Époux / Partenaire PACS</option>
                  <option value="frere_soeur">Frère / Sœur</option>
                  <option value="neveu_niece">Neveu / Nièce</option>
                  <option value="tiers">Tiers (Non parent)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Montant du don (€)</label>
                <input type="number" value={prixPP} onChange={e => setPrixPP(Number(e.target.value))} className="glass-input" style={{ fontWeight: 700, fontSize: '1.4rem' }} />
              </div>
            </div>
          </div>

          {/* LIEN AUDIT EXPERT */}
          <div style={{ padding: '1.25rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 14 }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#93C5FD' }}>💡 Analyse avancée</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Donations passées ? Calculez votre reliquat d'abattement et simulez un démembrement.
            </p>
            <Link href="/civil/donation/audit" className="btn-primary" style={{ width: '100%', fontSize: '0.75rem' }}>
              Lancer l'audit expert
            </Link>
          </div>
        </div>

        {/* COLONNE DROITE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* RÉSULTAT FLASH */}
          <div className="glass-card-hi" style={{ padding: '1.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Abattement appliqué</span>
              <p style={{ margin: '0.25rem 0 0', fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>{calculs.abattement.toLocaleString()} €</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Droits de donation</span>
              <p style={{ margin: '0.25rem 0 0', fontFamily: 'var(--font-display)', fontSize: '2.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round(calculs.droitsTotaux).toLocaleString()} €</p>
            </div>
          </div>

          {/* TABLEAU DÉTAILLÉ */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-md)' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Décomposition du barème progressif</h3>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', padding: '0.2rem 0.6rem', borderRadius: 999, color: 'var(--text-muted)' }}>
                Assiette : {Math.round(calculs.assietteTaxable).toLocaleString()} €
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-md)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '0.7rem 1.25rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tranche</th>
                    <th style={{ padding: '0.7rem 1.25rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Part taxée</th>
                    <th style={{ padding: '0.7rem 1.25rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Taux</th>
                    <th style={{ padding: '0.7rem 1.25rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Impôt</th>
                  </tr>
                </thead>
                <tbody>
                  {calculs.detailTranches.map((tranche, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.7rem 1.25rem', color: 'var(--text-secondary)' }}>{tranche.label}</td>
                      <td style={{ padding: '0.7rem 1.25rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round(tranche.assiette).toLocaleString()} €</td>
                      <td style={{ padding: '0.7rem 1.25rem', textAlign: 'center' }}>
                        <span className="badge badge-amber">{tranche.taux}%</span>
                      </td>
                      <td style={{ padding: '0.7rem 1.25rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round(tranche.impot).toLocaleString()} €</td>
                    </tr>
                  ))}
                  {calculs.detailTranches.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '3rem', textAlign: 'center' }}>
                        <p style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>✓ Exonération totale</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>Le montant est couvert par l'abattement légal.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      </main>
    </AuthGate>
  );
}
