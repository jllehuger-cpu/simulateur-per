'use client';

import { useMemo, useState } from 'react';
import { logSimulationComplete } from '@/lib/simulation-tracking';

type TaxBracket = {
  lower: number;
  upper: number;
  rate: number;
  label: string;
};

const TAX_BRACKETS_2024_2025: TaxBracket[] = [
  { lower: 0, upper: 11294, rate: 0, label: '0%' },
  { lower: 11294, upper: 28797, rate: 0.11, label: '11%' },
  { lower: 28797, upper: 82341, rate: 0.3, label: '30%' },
  { lower: 82341, upper: 177106, rate: 0.41, label: '41%' },
  { lower: 177106, upper: Number.POSITIVE_INFINITY, rate: 0.45, label: '45%' },
];

function getMarginalRate(incomePerPart: number): number {
  const bracket =
    [...TAX_BRACKETS_2024_2025]
      .reverse()
      .find((item) => incomePerPart > item.lower) ?? TAX_BRACKETS_2024_2025[0];
  return bracket.rate;
}

function getRateLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatEuro(value: number): string {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`;
}

export function SimulateurPer() {
  const [revenuNetGlobal, setRevenuNetGlobal] = useState<number>(60000);
  const [partsFiscales, setPartsFiscales] = useState<number>(1);
  const [versement, setVersement] = useState<number>(1000);
  const [trackMessage, setTrackMessage] = useState<string | null>(null);

  const {
    revenuSecurise,
    partsSecurisees,
    revenuParPartAvantPER,
    tmiAvant,
    deductionTotale,
    repartitionParTranche,
    economieImpots,
    coutReel,
    revenuParPartApresPER,
    tmiApres,
    baisseDeTranche,
  } = useMemo(() => {
    const rs = Math.max(0, revenuNetGlobal);
    const ps = Math.max(1, partsFiscales);
    const rppAvant = rs / ps;
    const tAvant = getMarginalRate(rppAvant);

    const dedTot = Math.min(versement, rs);
    const dedParPart = dedTot / ps;
    let deductionRestanteParPart = dedParPart;
    const repart = [...TAX_BRACKETS_2024_2025]
      .reverse()
      .map((bracket) => {
        const montantDansLaTrancheParPart = Math.max(
          0,
          Math.min(rppAvant, bracket.upper) - bracket.lower
        );
        const deductionParPartDansTranche = Math.min(
          deductionRestanteParPart,
          montantDansLaTrancheParPart
        );
        deductionRestanteParPart -= deductionParPartDansTranche;

        const eurosVersesDansTranche = deductionParPartDansTranche * ps;
        return {
          rate: bracket.rate,
          label: bracket.label,
          eurosVerses: eurosVersesDansTranche,
          economie: eurosVersesDansTranche * bracket.rate,
        };
      })
      .filter((item) => item.eurosVerses > 0);

    const eco = repart.reduce((sum, item) => sum + item.economie, 0);
    const cr = versement - eco;
    const rppApres = Math.max(0, (rs - dedTot) / ps);
    const tApres = getMarginalRate(rppApres);
    const baisse = tApres < tAvant;

    return {
      revenuSecurise: rs,
      partsSecurisees: ps,
      revenuParPartAvantPER: rppAvant,
      tmiAvant: tAvant,
      deductionTotale: dedTot,
      repartitionParTranche: repart,
      economieImpots: eco,
      coutReel: cr,
      revenuParPartApresPER: rppApres,
      tmiApres: tApres,
      baisseDeTranche: baisse,
    };
  }, [revenuNetGlobal, partsFiscales, versement]);

  function handleTerminerSimulation() {
    logSimulationComplete({
      simulatorId: 'per',
      revenuNetGlobal: revenuSecurise,
      partsFiscales: partsSecurisees,
      versement,
      deductionTotale,
      economieImpots: Number(economieImpots.toFixed(2)),
      coutReel: Number(coutReel.toFixed(2)),
      tmiAvant: getRateLabel(tmiAvant),
      tmiApres: getRateLabel(tmiApres),
      baisseDeTranche,
      repartitionParTranche: repartitionParTranche.map((r) => ({
        label: r.label,
        eurosVerses: Number(r.eurosVerses.toFixed(2)),
        economie: Number(r.economie.toFixed(2)),
      })),
    });
    setTrackMessage('Simulation enregistrée (voir la console développeur).');
    setTimeout(() => setTrackMessage(null), 4000);
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Simulateur PER
        </h1>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Revenu Net Global (€)
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={revenuNetGlobal}
                onChange={(e) => setRevenuNetGlobal(Number(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de parts fiscales
              </label>
              <input
                type="number"
                min={1}
                step={0.5}
                value={partsFiscales}
                onChange={(e) => setPartsFiscales(Number(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Montant du versement (€)
            </label>
            <input
              type="range"
              min={0}
              max={20000}
              step={100}
              value={versement}
              onChange={(e) => setVersement(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>0 €</span>
              <span>20 000 €</span>
            </div>
            <p className="mt-2 text-center text-sm font-semibold text-gray-800">
              Versement sélectionné : {versement.toLocaleString('fr-FR')} €
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-slate-700">TMI estimée (barème 2024/2025)</span>
              <span className="font-bold text-slate-900">{getRateLabel(tmiAvant)}</span>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              Revenu par part avant PER : {formatEuro(revenuParPartAvantPER)}
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
            <div className="flex justify-between mb-2">
              <span className="text-blue-700">Économie d&apos;impôt :</span>
              <span className="font-bold text-blue-900">{formatEuro(economieImpots)}</span>
            </div>
            <div className="flex justify-between border-t border-blue-200 pt-2 mt-2">
              <span className="text-gray-700 font-semibold">Coût réel de l&apos;effort :</span>
              <span className="font-bold text-green-600">{formatEuro(coutReel)}</span>
            </div>
          </div>

          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
            <h2 className="text-sm font-bold text-indigo-900 mb-2">
              Dans quelle tranche se situe chaque euro versé ?
            </h2>
            <div className="space-y-2">
              {repartitionParTranche.map((item) => (
                <div
                  key={`${item.label}-${item.eurosVerses}`}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="text-indigo-800">
                    {formatEuro(item.eurosVerses)} déduits à {item.label}
                  </span>
                  <span className="font-semibold text-indigo-900">
                    Gain: {formatEuro(item.economie)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              baisseDeTranche
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <h2
              className={`text-sm font-bold mb-1 ${
                baisseDeTranche ? 'text-emerald-900' : 'text-gray-800'
              }`}
            >
              Effet de seuil
            </h2>
            <p className={`text-sm ${baisseDeTranche ? 'text-emerald-800' : 'text-gray-700'}`}>
              {baisseDeTranche
                ? `Le versement PER vous fait passer d'une TMI de ${getRateLabel(tmiAvant)} à ${getRateLabel(tmiApres)}.`
                : `Votre TMI reste à ${getRateLabel(tmiAvant)} après ce versement.`}
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Revenu par part après PER : {formatEuro(revenuParPartApresPER)}
            </p>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <h2 className="text-sm font-bold text-amber-900 mb-1">
              Pourquoi le PER est plus avantageux avec une TMI élevée ?
            </h2>
            <p className="text-sm text-amber-800">
              Le versement PER est déductible du revenu imposable : plus votre TMI est haute
              (30%, 41%, 45%), plus chaque euro versé réduit votre impôt. Avec une TMI à
              {` ${getRateLabel(tmiAvant)}`}, vous récupérez environ {formatEuro(economieImpots)}
              pour {versement.toLocaleString('fr-FR')} € versés.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleTerminerSimulation}
              className="w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Terminer la simulation
            </button>
            {trackMessage ? (
              <p className="text-center text-sm text-green-700" role="status">
                {trackMessage}
              </p>
            ) : null}
          </div>

          <p className="text-xs text-gray-400 text-center italic">
            * Estimation pédagogique avec barème progressif 2024/2025 (quotient familial).
          </p>
        </div>
      </div>
    </main>
  );
}
