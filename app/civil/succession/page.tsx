'use client';

import { useState, useEffect, useMemo } from 'react';

export default function SuccessionPage() {
  const [patrimoineTaxable, setPatrimoineTaxable] = useState<number>(500000);
  const [lienParente, setLienParente] = useState<string>('ligne_directe');
  const [baremes, setBaremes] = useState<any>(null);

  useEffect(() => {
    fetch('/baremes.json')
      .then(res => res.json())
      .then(data => setBaremes(data))
      .catch(err => console.error("Erreur chargement JSON:", err));
  }, []);

  const calculs = useMemo(() => {
    if (!baremes) return null;

    // Cas spécifique : Exonération totale du conjoint/PACS en succession (Loi TEPA)
    if (lienParente === 'conjoint') {
      return { 
        exonere: true, 
        abattement: 0, 
        assietteTaxable: 0, 
        droitsTotaux: 0, 
        detailTranches: [] 
      };
    }

    // Calcul standard pour les autres liens
    const cleAbattement = lienParente === 'ligne_directe' ? 'enfant' : lienParente;
    const abattement = baremes.abattements[cleAbattement] || 0;
    const assietteTaxable = Math.max(0, patrimoineTaxable - abattement);
    const tranchesAUtiliser = baremes.baremes[lienParente] || [];

    let droitsTotaux = 0;
    let reste = assietteTaxable;
    let tranchePrecedente = 0;
    const detailTranches = [];

    for (const t of tranchesAUtiliser) {
      const limiteActuelle = t.limite === null ? Infinity : t.limite;
      const assietteTranche = Math.min(Math.max(0, reste), limiteActuelle - tranchePrecedente);
      
      if (assietteTranche > 0) {
        const impot = assietteTranche * t.taux;
        droitsTotaux += impot;
        detailTranches.push({
          label: t.limite === null ? `Plus de ${tranchePrecedente.toLocaleString()} €` : `Jusqu'à ${t.limite.toLocaleString()} €`,
          assiette: assietteTranche,
          taux: (t.taux * 100).toFixed(0),
          impot
        });
        reste -= assietteTranche;
      }
      tranchePrecedente = limiteActuelle;
      if (reste <= 0) break;
    }

    return { 
      exonere: false, 
      abattement, 
      assietteTaxable, 
      droitsTotaux, 
      detailTranches 
    };
  }, [patrimoineTaxable, lienParente, baremes]);

  if (!baremes || !calculs) {
    return (
      <div className="p-10 text-center font-bold text-slate-400 uppercase tracking-widest">
        Chargement du moteur fiscal...
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLONNE PARAMÈTRES */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
          <h2 className="text-lg font-bold mb-6 text-slate-800">Paramètres Succession</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 text-slate-400">
                Lien de parenté
              </label>
              <select 
                value={lienParente} 
                onChange={(e) => setLienParente(e.target.value)}
                className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-slate-900 transition-all"
              >
                <option value="ligne_directe">Enfant (Ligne Directe)</option>
                <option value="conjoint">Conjoint / Partenaire PACS</option>
                <option value="frere_soeur">Frère / Sœur</option>
                <option value="neveu_niece">Neveu / Nièce</option>
                <option value="tiers">Tiers (Non parent)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 text-slate-400">
                Actif net taxable (€)
              </label>
              <input 
                type="number" 
                value={patrimoineTaxable} 
                onChange={e => setPatrimoineTaxable(Number(e.target.value))} 
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-2xl outline-none focus:border-slate-900 transition-all" 
              />
            </div>
          </div>
        </div>

        {/* COLONNE RÉSULTATS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* BANDEAU RÉCAPITULATIF */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abattement Succession</span>
              <p className="text-3xl font-black text-emerald-500">
                {calculs.exonere ? "ILLIMITÉ" : `${calculs.abattement.toLocaleString()} €`}
              </p>
            </div>
            <div className="text-center md:text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Droits de succession</span>
              <p className="text-5xl font-black text-slate-900">
                {Math.round(calculs.droitsTotaux).toLocaleString()} €
              </p>
            </div>
          </div>

          {/* DÉTAIL OU MESSAGE EXONÉRATION */}
          {calculs.exonere ? (
            <div className="bg-emerald-50 border-2 border-emerald-100 p-8 rounded-3xl text-center">
              <p className="text-emerald-700 font-bold italic text-sm">
                "Le conjoint survivant et le partenaire lié par un PACS sont totalement exonérés de droits de succession." 
                <br />
                <span className="text-[10px] font-normal uppercase mt-2 block">(Art. 796-0 bis du CGI)</span>
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Barème d'imposition</h3>
                <span className="text-[10px] font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-500 uppercase">
                  Part taxable : {Math.round(calculs?.assietteTaxable || 0).toLocaleString()} €
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Tranche</th>
                      <th className="px-6 py-4 text-center">Assiette</th>
                      <th className="px-6 py-4 text-center">Taux</th>
                      <th className="px-6 py-4 text-right">Impôt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {calculs.detailTranches.map((tranche, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
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
                          <p className="text-emerald-500 font-black text-sm uppercase tracking-widest">Aucun droit à payer</p>
                          <p className="text-slate-400 text-[10px] mt-1">L'abattement couvre l'intégralité de l'actif.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}