'use client';

import { useState, useEffect, useMemo } from 'react';

// Type pour l'historique des donations
interface DonationPassee {
  id: number;
  montant: number;
  type: 'droit_commun' | 'sarkozy';
}

// Fonction pour le barème 669 du CGI (Usufruit)
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

  // Gestion de l'historique
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

    // 1. Valeur de la donation actuelle (PP ou NP)
    const valeurTaxableActuelle = isDemembre 
      ? getValeurNuePropriete(valeurBien, ageUsufruitier) 
      : valeurBien;

    // 2. Calcul du reliquat des abattements (Rappel fiscal 15 ans)
    let abattementCommunRestant = baremes.abattements.enfant || 100000;
    let abattementSarkozyRestant = baremes.abattements.sarkozy || 31865;

    donationsPassees.forEach(d => {
      if (d.type === 'sarkozy') abattementSarkozyRestant -= d.montant;
      else abattementCommunRestant -= d.montant;
    });

    abattementCommunRestant = Math.max(0, abattementCommunRestant);
    abattementSarkozyRestant = Math.max(0, abattementSarkozyRestant);

    // 3. Assiette finale taxable
    const assietteFinale = Math.max(0, valeurTaxableActuelle - abattementCommunRestant);

    return {
      valeurTaxableActuelle,
      abattementCommunRestant,
      abattementSarkozyRestant,
      assietteFinale,
      tauxNP: Math.round((valeurTaxableActuelle / valeurBien) * 100)
    };
  }, [valeurBien, isDemembre, ageUsufruitier, donationsPassees, baremes]);

  if (!baremes || !calculs) return <div className="p-10 text-center font-bold text-slate-400">CHARGEMENT DE L'AUDIT...</div>;

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-black text-slate-900 mb-8 uppercase tracking-tight">Audit de Donation Expert</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* BLOC 1 : PROJET ACTUEL */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="font-bold mb-6 flex items-center gap-2 text-slate-800">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center text-[10px]">1</span> 
            Projet Immobilier / Titres
          </h2>
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Valeur en Pleine Propriété (€)</label>
              <input 
                type="number" 
                value={valeurBien} 
                onChange={e => setValeurBien(Number(e.target.value))} 
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xl outline-none focus:border-blue-600 transition-all" 
              />
            </div>
            <div className={`p-4 rounded-2xl border-2 transition-all ${isDemembre ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-slate-700">Démembrement (Réserve d'usufruit)</span>
                <button 
                  onClick={() => setIsDemembre(!isDemembre)}
                  className={`w-12 h-6 rounded-full transition-all ${isDemembre ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-all ${isDemembre ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
              {isDemembre && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-[10px] font-black text-blue-400 uppercase mb-2">Âge du donateur</label>
                  <input 
                    type="number" 
                    value={ageUsufruitier} 
                    onChange={e => setAgeUsufruitier(Number(e.target.value))} 
                    className="w-full p-3 bg-white border-2 border-blue-100 rounded-xl font-bold text-blue-900" 
                  />
                  <p className="text-[9px] text-blue-400 mt-2 italic font-medium">Valeur fiscale de la Nue-Propriété : {calculs.tauxNP}%</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BLOC 2 : HISTORIQUE */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold flex items-center gap-2 text-slate-800">
              <span className="w-6 h-6 bg-amber-500 text-white rounded-lg flex items-center justify-center text-[10px]">2</span> 
              Passé Fiscal (15 ans)
            </h2>
            <button onClick={ajouterDonation} className="text-[10px] font-black uppercase bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-all shadow-lg shadow-slate-200">+ Ajouter un don</button>
          </div>
          <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
            {donationsPassees.map(d => (
              <div key={d.id} className="flex gap-3 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 transition-all hover:bg-slate-100">
                <div className="flex-1">
                  <select 
                    value={d.type} 
                    onChange={e => modifierDonation(d.id, 'type', e.target.value)} 
                    className="w-full text-[10px] font-black uppercase bg-transparent text-slate-500 mb-1 outline-none"
                  >
                    <option value="droit_commun">Donation Classique</option>
                    <option value="sarkozy">Don Argent (Sarkozy)</option>
                  </select>
                  <input 
                    type="number" 
                    value={d.montant} 
                    onChange={e => modifierDonation(d.id, 'montant', Number(e.target.value))} 
                    className="w-full bg-white border border-slate-200 p-2 rounded-lg font-bold text-sm outline-none focus:border-slate-400" 
                    placeholder="Montant"
                  />
                </div>
                <button onClick={() => supprimerDonation(d.id)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors text-xl">×</button>
              </div>
            ))}
            {donationsPassees.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl text-slate-400 text-[10px] font-bold uppercase tracking-widest">Aucun antécédent fiscal</div>
            )}
          </div>
        </div>
      </div>

      {/* RÉSULTATS DE SYNTHÈSE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Abattement Enfant Restant</span>
          <p className="text-3xl font-black text-emerald-500">{calculs.abattementCommunRestant.toLocaleString()} €</p>
          <div className="mt-4 pt-4 border-t border-slate-50">
            <span className="text-[9px] font-bold text-slate-300 uppercase">Don Sarkozy restant</span>
            <p className="text-sm font-bold text-slate-500">{calculs.abattementSarkozyRestant.toLocaleString()} €</p>
          </div>
        </div>

        <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl shadow-slate-200">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Assiette Actuelle Taxable</span>
          <p className="text-3xl font-black">{Math.round(calculs.valeurTaxableActuelle).toLocaleString()} €</p>
          <p className="text-[10px] text-slate-400 mt-2 italic font-medium">Basé sur la {isDemembre ? 'Nue-Propriété' : 'Pleine Propriété'}</p>
        </div>

        <div className="bg-blue-600 text-white p-8 rounded-3xl shadow-2xl shadow-blue-200">
          <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest block mb-2">Reliquat Net Taxable</span>
          <p className="text-5xl font-black">{Math.round(calculs.assietteFinale).toLocaleString()} €</p>
          <div className="mt-4 p-2 bg-blue-500/30 rounded-xl">
             <p className="text-[9px] leading-tight font-medium opacity-90">C'est le montant sur lequel vous allez payer des impôts après avoir utilisé vos abattements restants.</p>
          </div>
        </div>
      </div>
    </main>
  );
}