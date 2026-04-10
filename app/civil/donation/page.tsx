'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

export default function DonationPage() {
  const [prixPP, setPrixPP] = useState<number>(250000);
  const [lienParente, setLienParente] = useState<string>('ligne_directe');
  const [baremes, setBaremes] = useState<any>(null);

  // Chargement des données fiscales
  useEffect(() => {
    fetch('/baremes.json')
      .then(res => res.json())
      .then(data => setBaremes(data))
      .catch(err => console.error("Erreur JSON:", err));
  }, []);

  const calculs = useMemo(() => {
    if (!baremes) return null;

    // 1. Détermination de l'abattement selon le lien
    const cleAbattement = lienParente === 'ligne_directe' ? 'enfant' : lienParente;
    const abattement = baremes.abattements[cleAbattement] || 0;
    
    // 2. Assiette taxable
    const assietteTaxable = Math.max(0, prixPP - abattement);

    // 3. Calcul par tranches
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

    return {
      abattement,
      assietteTaxable,
      droitsTotaux,
      detailTranches
    };
  }, [prixPP, lienParente, baremes]);

  if (!baremes || !calculs) return <div className="p-10 text-center font-bold text-slate-400 uppercase tracking-widest">Initialisation...</div>;

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLONNE GAUCHE : CONFIGURATION */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold mb-6 text-slate-800 tracking-tight">Configuration</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Lien de parenté</label>
                <select 
                  value={lienParente} 
                  onChange={(e) => setLienParente(e.target.value)}
                  className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-slate-900 transition-all"
                >
                  <option value="ligne_directe">Ligne directe (Enfant)</option>
                  <option value="conjoint">Époux / Partenaire PACS</option>
                  <option value="frere_soeur">Frère / Sœur</option>
                  <option value="neveu_niece">Neveu / Nièce</option>
                  <option value="tiers">Tiers (Non parent)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Montant du don (€)</label>
                <input 
                  type="number" 
                  value={prixPP} 
                  onChange={e => setPrixPP(Number(e.target.value))} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-2xl outline-none focus:border-slate-900 transition-all" 
                />
              </div>
            </div>
          </div>

          {/* LE PONT VERS L'AUDIT EXPERT */}
          <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-3xl group hover:border-blue-300 transition-all shadow-sm">
            <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
              💡 Analyse avancée
            </h3>
            <p className="text-[10px] text-blue-700 leading-relaxed mb-4">
              Vous avez déjà effectué des donations par le passé ? Calculez votre reliquat d'abattement et simulez un démembrement.
            </p>
            <Link 
              href="/civil/donation/audit" 
              className="inline-flex items-center justify-center w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              Lancer l'audit expert
            </Link>
          </div>
        </div>

        {/* COLONNE DROITE : RÉSULTATS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* BANDEAU RÉSULTAT FLASH */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abattement appliqué</span>
              <p className="text-3xl font-black text-emerald-500">{calculs.abattement.toLocaleString()} €</p>
            </div>
            <div className="text-center md:text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Droits de donation</span>
              <p className="text-5xl font-black text-slate-900">{Math.round(calculs.droitsTotaux).toLocaleString()} €</p>
            </div>
          </div>

          {/* TABLEAU DÉTAILLÉ */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm">Décomposition du barème progressif</h3>
              <span className="text-[10px] font-bold bg-white border border-slate-200 px-3 py-1 rounded-full text-slate-500 uppercase">
                Assiette taxable : {Math.round(calculs.assietteTaxable).toLocaleString()} €
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Tranche</th>
                    <th className="px-6 py-4 text-center">Part taxée</th>
                    <th className="px-6 py-4 text-center">Taux</th>
                    <th className="px-6 py-4 text-right">Impôt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculs.detailTranches.map((tranche, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-600">{tranche.label}</td>
                      <td className="px-6 py-4 text-center text-sm font-bold">{Math.round(tranche.assiette).toLocaleString()} €</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-600">{tranche.taux}%</span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900">{Math.round(tranche.impot).toLocaleString()} €</td>
                    </tr>
                  ))}
                  {calculs.detailTranches.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center">
                        <div className="inline-block p-4 rounded-full bg-emerald-50 mb-3">
                            <span className="text-emerald-500 font-black text-xl">✓</span>
                        </div>
                        <p className="text-emerald-600 font-bold text-sm uppercase tracking-widest">Exonération Totale</p>
                        <p className="text-slate-400 text-[10px] italic mt-1">Le montant est couvert par l'abattement légal.</p>
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
  );
}