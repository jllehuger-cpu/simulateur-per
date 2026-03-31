'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

// Table d'espérance de vie INSEE 2019
const TABLE_INSEE: Record<'H' | 'F', Record<number, number>> = {
  'H': { 0:79.45, 10:69.85, 20:59.98, 30:50.33, 40:40.78, 50:31.59, 60:23.19, 61:22.41, 62:21.64, 63:20.89, 64:20.14, 65:19.39, 66:18.65, 67:17.91, 68:17.17, 69:16.45, 70:15.73, 75:12.24, 80:9.02, 85:6.28, 90:4.23, 95:2.92, 100:2.61 },
  'F': { 0:85.40, 10:75.76, 20:65.83, 30:55.97, 40:46.20, 50:36.68, 60:27.63, 61:26.75, 62:25.88, 63:25.01, 64:24.14, 65:23.28, 66:22.42, 67:21.57, 68:20.72, 69:19.87, 70:19.02, 75:14.93, 80:11.10, 85:7.76, 90:5.16, 95:3.40, 100:2.34 }
};

const getEsperance = (age: number, sexe: 'H' | 'F') => {
  const ages = Object.keys(TABLE_INSEE[sexe]).map(Number).sort((a,b) => b-a);
  const findAge = ages.find(a => a <= age) || 0;
  return TABLE_INSEE[sexe][findAge as keyof typeof TABLE_INSEE['H']] || 2;
};

// Application du barème progressif des droits de donation
const calculerDroitsLigneDirecte = (baseTaxable: number) => {
  if (baseTaxable <= 0) return 0;
  let droits = 0;
  let reste = baseTaxable;

  const tranches = [
    { limite: 1805677, taux: 0.45 },
    { limite: 902838, taux: 0.40 },
    { limite: 552324, taux: 0.30 },
    { limite: 15932, taux: 0.20 },
    { limite: 12109, taux: 0.15 },
    { limite: 8072, taux: 0.10 },
    { limite: 0, taux: 0.05 },
  ];

  for (const t of tranches) {
    if (reste > t.limite) {
      droits += (reste - t.limite) * t.taux;
      reste = t.limite;
    }
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
  }, [methode, typeDossier, prixPP, repartitionH, ageH, ageF, ageSolo, sexeSolo, rendement, tauxActualisation]);

  const abattementTotal = (typeDossier === 'couple' ? 200000 : 100000) * nbEnfants;
  const resteTaxableTotal = Math.max(0, calculs.total.np - abattementTotal);
  const partTaxableParEnfant = resteTaxableTotal / nbEnfants;
  const droitsParEnfant = calculerDroitsLigneDirecte(partTaxableParEnfant);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
      <div className="max-w-6xl mx-auto">
        
        {/* BARRE DE NAVIGATION ET TOGGLES PRINCIPAUX */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <Link href="/civil" className="text-blue-600 font-medium">← Accueil</Link>
          <div className="flex gap-4">
            <div className="bg-slate-200 p-1 rounded-xl flex shadow-inner">
              <button onClick={() => setMethode('fiscal')} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${methode === 'fiscal' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>FISCAL</button>
              <button onClick={() => setMethode('economique')} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${methode === 'economique' ? 'bg-blue-600 text-white shadow' : 'text-slate-500'}`}>ÉCONOMIQUE</button>
            </div>
            <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex gap-2">
              <button onClick={() => setTypeDossier('solo')} className={`px-4 py-2 rounded-lg text-xs font-bold ${typeDossier === 'solo' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>INDIVIDUEL</button>
              <button onClick={() => setTypeDossier('couple')} className={`px-4 py-2 rounded-lg text-xs font-bold ${typeDossier === 'couple' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>COUPLE</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLONNE GAUCHE : PARAMÈTRES */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <h2 className="text-lg font-bold border-b pb-2">Patrimoine & Famille</h2>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-tighter">Valeur Pleine Propriété (€)</label>
              <input type="number" value={prixPP} onChange={e => setPrixPP(Number(e.target.value))} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xl outline-none" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-tighter">Nombre d'enfants</label>
              <input type="number" value={nbEnfants} onChange={e => setNbEnfants(Number(e.target.value))} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-lg outline-none" min="1" />
            </div>

            {typeDossier === 'couple' && (
              <div className="pt-2">
                <label className="block text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">Répartition (H: {repartitionH}% / F: {100 - repartitionH}%)</label>
                <input type="range" min="0" max="100" value={repartitionH} onChange={e => setRepartitionH(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
              </div>
            )}

            {methode === 'economique' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div>
                  <label className="block text-[10px] font-bold text-blue-600 uppercase">Rendement %</label>
                  <input type="number" step="0.1" value={rendement} onChange={e => setRendement(Number(e.target.value))} className="w-full p-2 bg-white border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-blue-600 uppercase">Actualisation %</label>
                  <input type="number" step="0.1" value={tauxActualisation} onChange={e => setTauxActualisation(Number(e.target.value))} className="w-full p-2 bg-white border rounded-lg text-sm" />
                </div>
              </div>
            )}

            <h2 className="text-lg font-bold border-b pb-2 pt-2 text-slate-700 uppercase text-xs tracking-widest">Âges des Usufruitiers</h2>
            {typeDossier === 'couple' ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                  <label className="block text-[10px] font-bold text-blue-600 mb-2 uppercase">Monsieur : {ageH} ans</label>
                  <input type="range" min="0" max="100" value={ageH} onChange={e => setAgeH(Number(e.target.value))} className="w-full accent-blue-600" />
                </div>
                <div className="p-4 bg-pink-50/50 rounded-xl border border-pink-100">
                  <label className="block text-[10px] font-bold text-pink-600 mb-2 uppercase">Madame : {ageF} ans</label>
                  <input type="range" min="0" max="100" value={ageF} onChange={e => setAgeF(Number(e.target.value))} className="w-full accent-pink-600" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button onClick={() => setSexeSolo('H')} className={`flex-1 p-2 rounded border text-xs font-bold ${sexeSolo === 'H' ? 'bg-slate-800 text-white' : 'bg-white text-slate-400'}`}>HOMME</button>
                  <button onClick={() => setSexeSolo('F')} className={`flex-1 p-2 rounded border text-xs font-bold ${sexeSolo === 'F' ? 'bg-slate-800 text-white' : 'bg-white text-slate-400'}`}>FEMME</button>
                </div>
                <input type="range" min="0" max="100" value={ageSolo} onChange={e => setAgeSolo(Number(e.target.value))} className="w-full accent-slate-800" />
                <p className="text-center font-bold text-slate-800">{ageSolo} ans</p>
              </div>
            )}
          </div>

          {/* COLONNE DROITE : RÉSULTATS DÉTAILLÉS */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* TABLEAU RÉCAPITULATIF */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                  <tr>
                    <th className="p-4">Origine</th>
                    <th className="p-4 text-center">Nue-Propriété (NP)</th>
                    <th className="p-4 text-center">Usufruit (U)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {typeDossier === 'couple' ? (
                    <>
                      <tr>
                        <td className="p-4 font-bold text-blue-600">Monsieur</td>
                        <td className="p-4 text-center font-bold text-lg">{Math.round(calculs.h.np).toLocaleString()} €</td>
                        <td className="p-4 text-center text-slate-500">{Math.round(calculs.h.u).toLocaleString()} € ({Math.round(calculs.h.pct)}%)</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-bold text-pink-600">Madame</td>
                        <td className="p-4 text-center font-bold text-lg">{Math.round(calculs.f.np).toLocaleString()} €</td>
                        <td className="p-4 text-center text-slate-500">{Math.round(calculs.f.u).toLocaleString()} € ({Math.round(calculs.f.pct)}%)</td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td className="p-4 font-bold uppercase text-[10px]">Titulaire Unique</td>
                      <td className="p-4 text-center font-bold text-lg">{Math.round(calculs.h.np).toLocaleString()} €</td>
                      <td className="p-4 text-center text-slate-500">{Math.round(calculs.h.u).toLocaleString()} € ({Math.round(calculs.h.pct)}%)</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className={`font-bold text-white ${methode === 'fiscal' ? 'bg-slate-900' : 'bg-blue-900'} shadow-lg`}>
                  <tr>
                    <td className="p-4 uppercase tracking-tighter">Total à transmettre (NP)</td>
                    <td className="p-4 text-center text-2xl font-black text-emerald-400">{Math.round(calculs.total.np).toLocaleString()} €</td>
                    <td className="p-4 text-center text-slate-400 font-normal">{Math.round(calculs.total.u).toLocaleString()} €</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* SYNTHÈSE FISCALE ET DROITS DE DONATION */}
            <div className={`p-6 rounded-2xl border-2 transition-all ${resteTaxableTotal === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 text-lg">Simulation des Droits de Mutation</h3>
                <span className="text-[10px] font-black bg-white px-3 py-1.5 rounded-full border shadow-sm tracking-widest text-slate-600 uppercase">Art. 779-I et 777 du CGI</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 italic">Abattement (100k€ x {typeDossier === 'couple' ? '2 parents' : '1 parent'} x {nbEnfants} {nbEnfants > 1 ? 'enfants' : 'enfant'})</span>
                    <span className="font-bold text-slate-900">-{abattementTotal.toLocaleString()} €</span>
                  </div>
                  <div className="flex justify-between text-xs border-t pt-2">
                    <span className="text-slate-500 font-medium">Assiette taxable totale</span>
                    <span className="font-bold text-slate-900">{Math.round(resteTaxableTotal).toLocaleString()} €</span>
                  </div>
                  <div className="p-3 bg-white/60 rounded-lg border border-white/80">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Part taxable par enfant :</span>
                      <span className="font-bold text-slate-800">{Math.round(partTaxableParEnfant).toLocaleString()} €</span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1 italic">Calculée après déduction de l'abattement sur la part brute de chaque enfant.</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl flex flex-col justify-center items-center shadow-sm border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Droits à payer par enfant</span>
                  <span className={`text-4xl font-black ${droitsParEnfant === 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {droitsParEnfant === 0 ? "0 €" : `${Math.round(droitsParEnfant).toLocaleString()} €`}
                  </span>
                  {droitsParEnfant > 0 ? (
                    <div className="mt-2 text-center">
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">Barème progressif appliqué</p>
                      <p className="text-[10px] text-slate-400 italic">Soit {Math.round(droitsParEnfant * nbEnfants).toLocaleString()} € au total pour la fratrie.</p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-emerald-600 mt-2 font-bold uppercase tracking-widest italic">Transmission en franchise de droits</p>
                  )}
                </div>
              </div>
            </div>

            {/* NOTE MÉTHODOLOGIQUE */}
            <div className="p-4 bg-white rounded-xl border border-dashed border-slate-300 text-[11px] text-slate-500 leading-relaxed italic">
              {methode === 'fiscal' 
                ? "L'évaluation fiscale (Art. 669 CGI) est utilisée pour le calcul officiel des droits de mutation. Elle suit un barème fixe par tranches d'âge de 10 ans." 
                : "L'évaluation économique (actuarielle) utilise l'espérance de vie réelle (INSEE 2019) et les flux financiers futurs pour estimer la valeur de marché du bien démembré."
              }
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}