'use client';

import { useState, useEffect, useMemo } from 'react';

// --- LOGIQUE DE CALCUL EXPERTE ---

const calculerPartsDepuisListe = (situation: string, enfants: any[]): number => {
  let parts = situation === 'marie_pacs' ? 2 : 1;
  
  // On ne filtre que les enfants éligibles au rattachement
  const eligibles = enfants.filter(enf => {
    if (enf.age < 21) return true;
    if (enf.age < 25 && enf.estEtudiant) return true;
    return false;
  });

  // Tri pour prioriser les enfants en garde exclusive (qui valent plus cher au début)
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
  
  // Liste initiale d'enfants
  const [enfants, setEnfants] = useState([
    { id: 1, age: 10, estEtudiant: false, gardeAlternee: false }
  ]);

  // Chargement du JSON
  useEffect(() => {
    fetch('/baremes-ir.json')
      .then(res => res.json())
      .then(data => setDataFiscal(data))
      .catch(err => console.error("Erreur chargement JSON:", err));
  }, []);

  // Gestion de la liste d'enfants
  const ajouterEnfant = () => {
    setEnfants([...enfants, { id: Date.now(), age: 18, estEtudiant: true, gardeAlternee: false }]);
  };

  const supprimerEnfant = (id: number) => {
    setEnfants(enfants.filter(e => e.id !== id));
  };

  const updateEnfant = (id: number, field: string, value: any) => {
    setEnfants(enfants.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  // Moteur de calcul memoïsé
  const resultats = useMemo(() => {
    if (!dataFiscal || !dataFiscal.baremes[annee]) return null;

    const config = dataFiscal.baremes[annee];
    const metadata = dataFiscal.metadata;
    const params = config.configuration;

    // 1. Calcul des masses (Revenus et Charges)
    let totalBrut = 0;
    let totalCharges = 0;
    metadata.sections_avis.forEach((section: any) => {
      section.cases.forEach((c: any) => {
        const val = revenus[c.id] || 0;
        if (c.type === 'revenu') totalBrut += val;
        if (c.type === 'charge') totalCharges += val;
      });
    });

    const abattement = Math.min(
      Math.max(totalBrut * 0.10, 494), 
      params.abattement_10_max
    );

    const revenuNetGlobal = Math.max(0, totalBrut - abattement - totalCharges);

    // Option A : Rattachement de tous
    const partsA = calculerPartsDepuisListe(situation, enfants);
    const resA = calculerImpotDetails(revenuNetGlobal, partsA, config.tranches_ir);

    // Option B : On simule le détachement d'un enfant majeur pour verser la pension
    const enfantADetacher = enfants.find(e => e.age >= 18);
    let partsB = partsA;
    let revenuNetB = revenuNetGlobal;

    if (enfantADetacher) {
      const listeB = enfants.filter(e => e.id !== enfantADetacher.id);
      partsB = calculerPartsDepuisListe(situation, listeB);
      revenuNetB = Math.max(0, revenuNetGlobal - params.pension_max);
    }
    const resB = calculerImpotDetails(revenuNetB, partsB, config.tranches_ir);

    return {
      impotA: resA.total, tmiA: resA.tmi, partsA,
      impotB: resB.total, tmiB: resB.tmi, partsB,
      gain: resA.total - resB.total,
      revenuNetGlobal, abattement, totalBrut, totalCharges
    };
  }, [annee, dataFiscal, situation, enfants, revenus]);

  if (!dataFiscal) return <div className="p-20 text-center font-black animate-pulse text-slate-300 uppercase tracking-widest">Initialisation...</div>;

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-10 text-slate-900">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter italic leading-none">Simulateur IR Expert</h1>
          <p className="text-slate-400 font-bold text-xs uppercase mt-2 tracking-widest">Optimisation & Arbitrage Fiscal</p>
        </div>
        <select 
          value={annee} 
          onChange={(e) => setAnnee(e.target.value)} 
          className="bg-white border-2 border-slate-200 p-4 rounded-2xl font-black text-sm outline-none focus:border-blue-600 shadow-sm transition-all cursor-pointer"
        >
          {Object.keys(dataFiscal.baremes).map(a => <option key={a} value={a}>BARÈME FISCAL {a}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* COLONNE GAUCHE : SAISIE (4/12) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Foyer & Enfants */}
          <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Foyer & Enfants</h2>
              <button onClick={ajouterEnfant} className="bg-blue-600 text-white text-[9px] px-3 py-1 rounded-full font-black hover:bg-blue-700 transition-colors">+ ENFANT</button>
            </div>

            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
              <button onClick={() => setSituation('celibataire')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${situation === 'celibataire' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500'}`}>Célibataire</button>
              <button onClick={() => setSituation('marie_pacs')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${situation === 'marie_pacs' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500'}`}>Marié / PACS</button>
            </div>

            <div className="space-y-4">
              {enfants.map((enf) => (
                <div key={enf.id} className="p-4 bg-slate-50 rounded-3xl border border-slate-100 relative group">
                  <button onClick={() => supprimerEnfant(enf.id)} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Âge</label>
                      <input type="number" value={enf.age} onChange={e => updateEnfant(enf.id, 'age', Number(e.target.value))} className="w-full p-2 bg-white rounded-xl font-bold border-none outline-none shadow-sm" />
                    </div>
                    <div className="flex flex-col gap-1.5 pt-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={enf.estEtudiant} onChange={e => updateEnfant(enf.id, 'estEtudiant', e.target.checked)} className="rounded border-slate-300 text-blue-600" />
                        <span className="text-[9px] font-black text-slate-500 uppercase">Étudiant</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={enf.gardeAlternee} onChange={e => updateEnfant(enf.id, 'gardeAlternee', e.target.checked)} className="rounded border-slate-300 text-blue-600" />
                        <span className="text-[9px] font-black text-blue-500 uppercase italic">Alternée</span>
                      </label>
                    </div>
                  </div>
                  {(enf.age >= 25 || (enf.age >= 21 && !enf.estEtudiant)) && (
                    <p className="text-[8px] font-bold text-red-500 mt-2 uppercase">⚠️ Inéligible au rattachement</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Revenus Dynamiques */}
          {dataFiscal.metadata.sections_avis.map((section: any) => (
            <div key={section.categorie} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">{section.categorie}</h2>
              <div className="space-y-4">
                {section.cases.map((c: any) => (
                  <div key={c.id}>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">{c.label} ({c.id})</label>
                    <input 
                      type="number" 
                      value={revenus[c.id] || ''} 
                      onChange={e => setRevenus({...revenus, [c.id]: Number(e.target.value)})}
                      className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-black focus:bg-white focus:border-blue-100 outline-none transition-all" 
                      placeholder="0 €"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* COLONNE DROITE : RÉSULTATS (8/12) */}
        <div className="lg:col-span-8 space-y-8">
          {resultats && (
            <>
              {/* Cartes d'arbitrage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-10 rounded-[48px] border-2 transition-all ${resultats.gain <= 0 ? 'border-emerald-500 bg-emerald-50/50' : 'border-white bg-white shadow-sm'}`}>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Option A : Rattachement</span>
                  <p className="text-6xl font-black mt-2 tracking-tighter">{resultats.impotA.toLocaleString()} €</p>
                  <div className="flex gap-4 mt-6">
                    <span className="text-[10px] font-bold bg-white px-3 py-1 rounded-full border border-slate-100 uppercase text-slate-500">{resultats.partsA} parts</span>
                    <span className="text-[10px] font-bold bg-white px-3 py-1 rounded-full border border-slate-100 uppercase text-slate-500">TMI {resultats.tmiA}%</span>
                  </div>
                </div>

                <div className={`p-10 rounded-[48px] border-2 transition-all ${resultats.gain > 0 ? 'border-blue-600 bg-blue-50/50' : 'border-white bg-white shadow-sm'}`}>
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Option B : Pension (+ détachement)</span>
                  <p className="text-6xl font-black mt-2 text-blue-600 tracking-tighter">{resultats.impotB.toLocaleString()} €</p>
                  <div className="flex gap-4 mt-6">
                    <span className="text-[10px] font-bold bg-white px-3 py-1 rounded-full border border-blue-100 uppercase text-blue-600">{resultats.partsB} parts</span>
                    <span className="text-[10px] font-bold bg-white px-3 py-1 rounded-full border border-blue-100 uppercase text-blue-600">TMI {resultats.tmiB}%</span>
                  </div>
                </div>
              </div>

              {/* Tableau de décomposition */}
              <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm">
                <h3 className="text-xs font-black uppercase text-slate-400 mb-8 tracking-widest">Décomposition du Net Imposable</h3>
                <div className="space-y-5">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                    <span className="text-sm font-bold text-slate-600">Revenus bruts (Salaires)</span>
                    <span className="font-black">{(resultats.totalBrut).toLocaleString()} €</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                    <span className="text-sm font-bold text-slate-600">Abattement Forfaitaire (10%)</span>
                    <span className="font-black text-emerald-600">- {resultats.abattement.toLocaleString()} €</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                    <span className="text-sm font-bold text-slate-600">Charges déductibles (6DD, 6GU...)</span>
                    <span className="font-black text-emerald-600">- {resultats.totalCharges.toLocaleString()} €</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-black uppercase text-blue-600">Revenu Net Imposable Global</span>
                    <span className="text-3xl font-black text-blue-600">{resultats.revenuNetGlobal.toLocaleString()} €</span>
                  </div>
                </div>
              </div>

              {/* Verdict Final */}
              <div className={`p-10 rounded-[48px] shadow-2xl ${resultats.gain > 0 ? 'bg-blue-600 shadow-blue-200' : 'bg-slate-900 shadow-slate-200'} text-white`}>
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="flex-1">
                    <h3 className="text-4xl font-black tracking-tighter leading-none mb-2">
                      {resultats.gain > 0 
                        ? `Optimisation : +${resultats.gain.toLocaleString()} €` 
                        : "Le rattachement est gagnant"}
                    </h3>
                    <p className="text-xs font-bold uppercase opacity-60 tracking-widest">
                      {resultats.gain > 0 
                        ? "Détachez un enfant majeur et versez lui une pension pour maximiser vos économies." 
                        : "Conservez tous vos enfants au foyer pour bénéficier du maximum de parts."}
                    </p>
                  </div>
                  <div className="bg-white/10 p-6 rounded-[32px] border border-white/20 backdrop-blur-md text-center min-w-[180px]">
                    <span className="text-[10px] font-black uppercase block mb-1 opacity-70">Gain Réel Net</span>
                    <p className="text-4xl font-black">{Math.abs(resultats.gain).toLocaleString()} €</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}