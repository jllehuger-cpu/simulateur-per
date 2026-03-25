'use client';

import { useSectionAccessPassword } from '@/components/section-access-context';
import {
  formatDateHeureFr,
  postPerRowToSheetbest,
} from '@/lib/sheetbest-per';
import { logSimulationComplete } from '@/lib/simulation-tracking';
import { useCallback, useEffect, useMemo, useState } from 'react';

type TaxBracket = {
  lower: number;
  upper: number;
  rate: number;
  label: string;
};

type MaritalStatus = 'celibataire' | 'marie_pacse';

const TAX_BRACKETS_2026: TaxBracket[] = [
  // Seuils par part fiscale (quotient familial)
  { lower: 0, upper: 11600, rate: 0, label: '0%' },
  { lower: 11600, upper: 29579, rate: 0.11, label: '11%' },
  { lower: 29579, upper: 84577, rate: 0.30, label: '30%' },
  { lower: 84577, upper: 181917, rate: 0.41, label: '41%' },
  { lower: 181917, upper: Number.POSITIVE_INFINITY, rate: 0.45, label: '45%' },
];

function getMarginalRate(incomePerPart: number): number {
  const income = Math.max(0, incomePerPart);
  // On cherche la première tranche dont `upper` contient la valeur
  const bracket = TAX_BRACKETS_2026.find((b) => income <= b.upper) ?? TAX_BRACKETS_2026[TAX_BRACKETS_2026.length - 1];
  return bracket.rate;
}

function getRateLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatEuro(value: number): string {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`;
}

function computeIncomeTaxForIncomePerPart(incomePerPart: number): number {
  const income = Math.max(0, incomePerPart);
  return TAX_BRACKETS_2026.reduce((sum, bracket) => {
    const slice = Math.max(0, Math.min(income, bracket.upper) - bracket.lower);
    return sum + slice * bracket.rate;
  }, 0);
}

function computeIncomeTaxForIncome(incomeGlobal: number, parts: number): number {
  const ps = Math.max(1, parts);
  const rpp = Math.max(0, incomeGlobal) / ps;
  return computeIncomeTaxForIncomePerPart(rpp) * ps;
}

function getBasePartsForStatus(statut: MaritalStatus): number {
  return statut === 'marie_pacse' ? 2 : 1;
}

function computeIncomeTaxWithQFPlafonnement(params: {
  incomeGlobal: number;
  parts: number;
  baseParts: number; // 1 pour célibataire, 2 pour couple
  capPerDemiPart: number; // ~1 750 €
}): {
  impotsFinal: number;
  impotsQFNonPlafonne: number;
  impotsBaseParts: number;
  impotsAvecPlafonnement: number;
  advantageBrut: number;
  advantageCap: number;
} {
  const income = Math.max(0, params.incomeGlobal);
  const partsSecurisees = Math.max(1, params.parts);
  const baseParts = Math.max(1, params.baseParts);

  // 1) Impôt sur le revenu global divisé par le nombre de parts (quotient familial "non plafonné")
  const impotsQFNonPlafonne = computeIncomeTaxForIncome(income, partsSecurisees);

  // 2) Impôt pour 1 part / 2 parts, puis retrait d'un avantage fiscal plafonné
  const impotsBaseParts = computeIncomeTaxForIncome(income, baseParts);

  // Avantage brut = différence de l'impôt entre baseParts et parts réelles
  const advantageBrut = Math.max(0, impotsBaseParts - impotsQFNonPlafonne);

  // Plafond ≈ 1 750 € par demi-part supplémentaire
  const demiPartsSup =
    partsSecurisees > baseParts ? (partsSecurisees - baseParts) / 0.5 : 0;
  const advantageCap = Math.max(0, demiPartsSup * params.capPerDemiPart);

  const advantagePlafonnee = Math.min(advantageBrut, advantageCap);

  const impotsAvecPlafonnement = Math.max(0, impotsBaseParts - advantagePlafonnee);

  // Règle demandée : retenir le montant le plus élevé des deux
  const impotsFinal = Math.max(impotsQFNonPlafonne, impotsAvecPlafonnement);

  return {
    impotsFinal,
    impotsQFNonPlafonne,
    impotsBaseParts,
    impotsAvecPlafonnement,
    advantageBrut,
    advantageCap,
  };
}

function computeDeductionRepartitionByBracket(params: {
  deductionParPart: number;
  incomeParPartAvantPer: number;
  parts: number;
}): Array<{
  rate: number;
  label: string;
  eurosVerses: number;
  economie: number;
}> {
  const deductionParPart = Math.max(0, params.deductionParPart);
  const incomeParPartAvantPer = Math.max(0, params.incomeParPartAvantPer);
  const ps = Math.max(1, params.parts);

  let remaining = deductionParPart;
  const repart: Array<{ rate: number; label: string; eurosVerses: number; economie: number }> = [];

  // Allocation du haut vers le bas (effet "on déduit d'abord la tranche la plus élevée")
  const descending = [...TAX_BRACKETS_2026].slice().reverse();
  for (const bracket of descending) {
    if (remaining <= 0) break;

    const incomeSlicePerPart = Math.max(
      0,
      Math.min(incomeParPartAvantPer, bracket.upper) - bracket.lower
    );
    if (incomeSlicePerPart <= 0) continue;

    const deductionSliceParPart = Math.min(remaining, incomeSlicePerPart);
    if (deductionSliceParPart <= 0) continue;

    remaining -= deductionSliceParPart;
    const eurosVerses = deductionSliceParPart * ps;
    repart.push({
      rate: bracket.rate,
      label: bracket.label,
      eurosVerses,
      economie: eurosVerses * bracket.rate,
    });
  }

  return repart;
}

function computeIncomeInBrackets(incomeParPart: number, parts: number): Array<{
  rate: number;
  label: string;
  euros: number;
}> {
  const income = Math.max(0, incomeParPart);
  const ps = Math.max(1, parts);
  return TAX_BRACKETS_2026.map((bracket) => {
    const slicePerPart = Math.max(0, Math.min(income, bracket.upper) - bracket.lower);
    return {
      rate: bracket.rate,
      label: bracket.label,
      euros: slicePerPart * ps,
    };
  });
}

function computeCehr(revenuFiscalDeReference: number, statut: MaritalStatus): number {
  const rfr = Math.max(0, revenuFiscalDeReference);
  const isCouple = statut === 'marie_pacse';
  const low = isCouple ? 500000 : 250000;
  const high = isCouple ? 1000000 : 500000;

  if (rfr <= low) return 0;
  if (rfr <= high) return (rfr - low) * 0.03;
  return (high - low) * 0.03 + (rfr - high) * 0.04;
}

export function SimulateurPer() {
  const accessPassword = useSectionAccessPassword();
  const [statut, setStatut] = useState<MaritalStatus>('celibataire');
  const [revenuFiscalReference, setRevenuFiscalReference] = useState<number>(60000);
  const [partsFiscales, setPartsFiscales] = useState<number>(1);
  const [revenuBrutGlobal, setRevenuBrutGlobal] = useState<number>(60000);
  const [plafondDeductibilitePer2026, setPlafondDeductibilitePer2026] = useState<number>(20000);
  const [age, setAge] = useState<number>(35);
  const [versement, setVersement] = useState<number>(1000);
  const [archiveMessage, setArchiveMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);

  const plafondSecurise = Math.max(0, plafondDeductibilitePer2026);
  const versementStep = plafondSecurise <= 5000 ? 50 : 100;

  useEffect(() => {
    setVersement((v) => Math.min(v, plafondSecurise));
  }, [plafondSecurise]);

  const {
    revenuFiscalReferenceSecurise,
    revenuBrutGlobalSecurise,
    partsSecurisees,
    plafondDeductibiliteSecurise,
    revenuParPartAvantPER,
    revenuParPartApresPER,
    tmiAvant,
    tmiApres,
    deductionTotale,
    repartitionParTranche,
    impotsIRAvant,
    impotsIRApres,
    economieIR,
    qfCapAvant,
    qfCapApres,
    qfPlafonnementActifAvant,
    qfPlafonnementActifApres,
    cehrAvant,
    cehrApres,
    economieCEHR,
    economieTotale,
    coutReel,
    baisseDeTranche,
    revenusAuDessusDe30,
    deductionAuDessusDe30,
    impotsIRTotalAvant,
    impotsIRTotalApres,
  } = useMemo(() => {
    const rfr = Math.max(0, revenuFiscalReference);
    const rb = Math.max(0, revenuBrutGlobal);
    const ps = Math.max(1, partsFiscales);
    const plafond = Math.max(0, plafondSecurise);

    const rppAvant = rb / ps;
    const tAvant = getMarginalRate(rppAvant);

    const dedTot = Math.min(versement, rb, plafond);
    const dedParPart = dedTot / ps;

    const repart = computeDeductionRepartitionByBracket({
      deductionParPart: dedParPart,
      incomeParPartAvantPer: rppAvant,
      parts: ps,
    });

    // Estimation "marginale" : la répartition par tranche est basée sur le taux marginal.

    const rppApres = Math.max(0, (rb - dedTot) / ps);
    const tApres = getMarginalRate(rppApres);
    const baisse = tApres < tAvant;

    const baseParts = getBasePartsForStatus(statut);
    const capPerDemiPart = 1750;

    const taxAvant = computeIncomeTaxWithQFPlafonnement({
      incomeGlobal: rb,
      parts: ps,
      baseParts,
      capPerDemiPart,
    });
    const taxApres = computeIncomeTaxWithQFPlafonnement({
      incomeGlobal: rb - dedTot,
      parts: ps,
      baseParts,
      capPerDemiPart,
    });

    const impotIRAvant = taxAvant.impotsFinal;
    const impotIRApres = taxApres.impotsFinal;
    const economieIRReelle = impotIRAvant - impotIRApres;

    const qfCapAvant = taxAvant.advantageCap;
    const qfCapApres = taxApres.advantageCap;
    const qfPlafonnementActifAvant =
      taxAvant.impotsAvecPlafonnement > taxAvant.impotsQFNonPlafonne + 0.01;
    const qfPlafonnementActifApres =
      taxApres.impotsAvecPlafonnement > taxApres.impotsQFNonPlafonne + 0.01;

    const cehrAv = computeCehr(rfr, statut);
    const rfrApres = Math.max(0, rfr - dedTot);
    const cehrAp = computeCehr(rfrApres, statut);

    const ecoCEHR = cehrAv - cehrAp;
    const ecoTotale = economieIRReelle + ecoCEHR;
    const cr = versement - ecoTotale;

    const revenusBrackets = computeIncomeInBrackets(rppAvant, ps);
    const revenusAu30Plus = revenusBrackets.filter((b) => b.rate >= 0.30 && b.euros > 0);
    const deductionAu30Plus = repart
      .filter((r) => r.rate >= 0.30)
      .reduce((sum, r) => sum + r.eurosVerses, 0);

    return {
      revenuFiscalReferenceSecurise: rfr,
      revenuBrutGlobalSecurise: rb,
      partsSecurisees: ps,
      plafondDeductibiliteSecurise: plafond,
      revenuParPartAvantPER: rppAvant,
      revenuParPartApresPER: rppApres,
      tmiAvant: tAvant,
      tmiApres: tApres,
      deductionTotale: dedTot,
      repartitionParTranche: repart,
      impotsIRAvant: impotIRAvant,
      impotsIRApres: impotIRApres,
      economieIR: economieIRReelle,
      qfCapAvant,
      qfCapApres,
      qfPlafonnementActifAvant,
      qfPlafonnementActifApres,
      cehrAvant: cehrAv,
      cehrApres: cehrAp,
      economieCEHR: ecoCEHR,
      economieTotale: ecoTotale,
      coutReel: cr,
      revenuFiscalApresPER: rfrApres,
      baisseDeTranche: baisse,
      revenusAuDessusDe30: revenusAu30Plus,
      deductionAuDessusDe30: deductionAu30Plus,
      impotsIRTotalAvant: impotIRAvant + cehrAv,
      impotsIRTotalApres: impotIRApres + cehrAp,
    };
  }, [
    revenuFiscalReference,
    revenuBrutGlobal,
    partsFiscales,
    statut,
    plafondSecurise,
    versement,
  ]);

  const sendDataToSheet = useCallback(async () => {
    try {
      setIsSending(true);
      setArchiveMessage(null);
      await postPerRowToSheetbest({
        Date_Heure: formatDateHeureFr(),
        password: accessPassword,
        age: Math.max(0, Math.floor(age)),
        Statut_Fiscal: statut === 'celibataire' ? 'Célibataire' : 'Marié-Pacsé',
        Revenu_Annuel: revenuBrutGlobalSecurise,
        Revenu_Fiscal_de_Reference: revenuFiscalReferenceSecurise,
        Nombre_Parts_Fiscales: partsSecurisees,
        Revenu_Brut_Global: revenuBrutGlobalSecurise,
        Plafond_Deductibilite_PER_2026: plafondDeductibiliteSecurise,
        RFR: revenuFiscalReferenceSecurise,
        Nombre_Parts: partsSecurisees,
        Revenu_Brut: revenuBrutGlobalSecurise,
        Plafond_PER: plafondDeductibiliteSecurise,
        Versement_PER: versement,
        Plafonnement_QF_Cap_DemiPart_Supplementaire_EUR: 1750,
        Plafonnement_QF_Cap_Avant_EUR: qfCapAvant,
        Plafonnement_QF_Cap_Apres_EUR: qfCapApres,
        Plafonnement_QF_Actif_Avant: qfPlafonnementActifAvant ? 1 : 0,
        Plafonnement_QF_Actif_Apres: qfPlafonnementActifApres ? 1 : 0,
        Economie_Impot: Number(economieIR.toFixed(2)),
        CEHR_Avant: Number(cehrAvant.toFixed(2)),
        CEHR_Apres: Number(cehrApres.toFixed(2)),
        Economie_CEHR: Number(economieCEHR.toFixed(2)),
        Economie_Totale: Number(economieTotale.toFixed(2)),
        Impot_IR_Avant: Number(impotsIRAvant.toFixed(2)),
        Impot_IR_Apres: Number(impotsIRApres.toFixed(2)),
        Impot_Theorique_Total_Avant: Number(impotsIRTotalAvant.toFixed(2)),
        Impot_Theorique_Total_Apres: Number(impotsIRTotalApres.toFixed(2)),
      });
      setArchiveMessage({
        tone: 'success',
        text: '✅ Simulation archivée avec succès',
      });
    } catch {
      setArchiveMessage({
        tone: 'error',
        text: "Échec de l'archivage. Réessayez.",
      });
    } finally {
      setIsSending(false);
    }
  }, [
    accessPassword,
    age,
    statut,
    economieCEHR,
    economieIR,
    economieTotale,
    impotsIRApres,
    impotsIRAvant,
    impotsIRTotalApres,
    impotsIRTotalAvant,
    qfCapApres,
    qfCapAvant,
    qfPlafonnementActifApres,
    qfPlafonnementActifAvant,
    revenuBrutGlobalSecurise,
    revenuFiscalReferenceSecurise,
    partsSecurisees,
    plafondDeductibiliteSecurise,
    cehrApres,
    cehrAvant,
    versement,
  ]);

  useEffect(() => {
    if (!archiveMessage) return;
    const id = window.setTimeout(() => setArchiveMessage(null), 4000);
    return () => window.clearTimeout(id);
  }, [archiveMessage]);

  async function handleEnregistrerMesResultats() {
    logSimulationComplete({
      simulatorId: 'per',
      age: Math.max(0, Math.floor(age)),
      statut,
      revenuFiscalDeReference: revenuFiscalReferenceSecurise,
      partsFiscales: partsSecurisees,
      revenuBrutGlobal: revenuBrutGlobalSecurise,
      plafondDeductibilitePer2026: plafondDeductibiliteSecurise,
      versement,
      deductionTotale,
      economieImpots: Number(economieIR.toFixed(2)),
      economieCEHR: Number(economieCEHR.toFixed(2)),
      economieTotale: Number(economieTotale.toFixed(2)),
      cehrAvant: Number(cehrAvant.toFixed(2)),
      cehrApres: Number(cehrApres.toFixed(2)),
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
    await sendDataToSheet();
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Simulateur PER (Option B - Expert)
        </h1>

        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Configuration Fiscale</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Revenu Fiscal de Référence (RFR) (€)
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={revenuFiscalReference}
                  onChange={(e) => setRevenuFiscalReference(Number(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut
                </label>
                <select
                  value={statut}
                  onChange={(e) => setStatut(e.target.value as MaritalStatus)}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white text-black"
                >
                  <option value="celibataire">Célibataire</option>
                  <option value="marie_pacse">Marié - Pacsé</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de parts fiscales (ex: 2.5)
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Revenu Brut Global (€)
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={revenuBrutGlobal}
                  onChange={(e) => setRevenuBrutGlobal(Number(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plafond de déductibilité PER (cotisations 2026) (€)
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={plafondDeductibilitePer2026}
                  onChange={(e) => setPlafondDeductibilitePer2026(Number(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Slider Dynamique de versement PER (€)
              </label>
              <input
                type="range"
                min={0}
                max={plafondSecurise}
                step={versementStep}
                value={versement}
                onChange={(e) => setVersement(Math.min(Number(e.target.value), plafondSecurise))}
                disabled={plafondSecurise <= 0}
                className="w-full accent-blue-600 disabled:opacity-60"
              />
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>0 €</span>
                <span>{plafondSecurise.toLocaleString('fr-FR')} €</span>
              </div>
              <p className="mt-2 text-center text-sm font-semibold text-gray-800">
                Versement sélectionné : {versement.toLocaleString('fr-FR')} €
              </p>
              {plafondSecurise <= 0 ? (
                <p className="mt-2 text-xs text-red-600 text-center">
                  Plafond de déductibilité à 0 € : le versement est bloqué.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Âge
              </label>
              <input
                type="number"
                min={0}
                max={120}
                step={1}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full max-w-xs p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-slate-700">TMI marginale (barème 2026)</span>
              <span className="font-bold text-slate-900">{getRateLabel(tmiAvant)}</span>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              Revenu par part : {formatEuro(revenuParPartAvantPER)} → {formatEuro(revenuParPartApresPER)}.
              TMI après PER : <span className="font-semibold">{getRateLabel(tmiApres)}</span>.
            </div>
          </div>

          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
            <h2 className="text-sm font-bold text-emerald-900 mb-2">
              Revenus imposés à 30% et plus (donc PER plus efficace)
            </h2>
            {revenusAuDessusDe30.length > 0 ? (
              <div className="space-y-2">
                {revenusAuDessusDe30.map((b) => (
                  <div
                    key={b.label}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-emerald-800">{b.label}</span>
                    <span className="font-bold text-emerald-900">{formatEuro(b.euros)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-emerald-200 pt-2 text-sm">
                  <span className="font-semibold text-emerald-900">Total</span>
                  <span className="font-bold text-emerald-900">
                    {formatEuro(revenusAuDessusDe30.reduce((sum, b) => sum + b.euros, 0))}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-emerald-800">
                Aucun revenu dans les tranches 30% / 41% / 45% avec votre base saisie.
              </p>
            )}
            <p className="mt-2 text-xs text-emerald-800">
              Sur votre versement, {formatEuro(deductionAuDessusDe30)} seraient déduits dans les tranches à 30% et plus.
            </p>
          </div>

          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg bg-white/60 p-3 border border-blue-100">
                <h2 className="text-sm font-bold text-blue-900 mb-2">Impôt sur le revenu (IR)</h2>
                <div className="flex justify-between text-sm text-blue-800">
                  <span>Avant PER</span>
                  <span className="font-semibold">{formatEuro(impotsIRAvant)}</span>
                </div>
                <div className="flex justify-between text-sm text-blue-800 mt-1">
                  <span>Après PER</span>
                  <span className="font-semibold">{formatEuro(impotsIRApres)}</span>
                </div>
                <div className="flex justify-between text-sm text-blue-800 mt-2 border-t border-blue-100 pt-2">
                  <span className="font-semibold">Économie IR</span>
                  <span className="font-bold text-blue-900">{formatEuro(economieIR)}</span>
                </div>

                <div className="mt-3 border-t border-blue-100 pt-3">
                  <div className="flex justify-between text-sm text-blue-800">
                    <span>Total théorique (IR + CEHR) avant PER</span>
                    <span className="font-semibold">{formatEuro(impotsIRTotalAvant)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-blue-800 mt-1">
                    <span>Total théorique (IR + CEHR) après PER</span>
                    <span className="font-semibold">{formatEuro(impotsIRTotalApres)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white/60 p-3 border border-blue-100">
                <h2 className="text-sm font-bold text-blue-900 mb-2">CEHR (estimée)</h2>
                <div className="flex justify-between text-sm text-blue-800">
                  <span>Avant PER</span>
                  <span className="font-semibold">{formatEuro(cehrAvant)}</span>
                </div>
                <div className="flex justify-between text-sm text-blue-800 mt-1">
                  <span>Après PER</span>
                  <span className="font-semibold">{formatEuro(cehrApres)}</span>
                </div>
                <div className="flex justify-between text-sm text-blue-800 mt-2 border-t border-blue-100 pt-2">
                  <span className="font-semibold">Économie CEHR</span>
                  <span className="font-bold text-blue-900">{formatEuro(economieCEHR)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-between border-t border-blue-200 pt-3">
              <span className="text-blue-700 font-semibold">Économie totale (IR + CEHR)</span>
              <span className="font-bold text-blue-900">{formatEuro(economieTotale)}</span>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-gray-700 font-semibold">Coût réel de l&apos;effort</span>
              <span className="font-bold text-green-600">{formatEuro(coutReel)}</span>
            </div>
          </div>

          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
            <h2 className="text-sm font-bold text-indigo-900 mb-2">
              Dans quelle tranche se situe chaque euro versé ? (barème 2026)
            </h2>
            <div className="space-y-2">
              {repartitionParTranche.map((item) => (
                <div
                  key={`${item.label}-${item.eurosVerses}`}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="text-indigo-800">
                    {formatEuro(item.eurosVerses)} déduits au taux {item.label}
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
            {baisseDeTranche ? (
              <p className="text-xs text-gray-600 mt-1">
                Gain IR (plafonnement QF inclus) : {formatEuro(economieIR)}.
              </p>
            ) : null}
            {economieCEHR > 0 ? (
              <p className="text-xs text-gray-600 mt-1">
                En plus, votre CEHR baisse de {formatEuro(economieCEHR)} (hypothèse: baisse du RFR d&apos;autant que la déduction).
              </p>
            ) : null}
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <h2 className="text-sm font-bold text-amber-900 mb-1">
              Pourquoi le PER est plus avantageux avec une TMI élevée ?
            </h2>
            <p className="text-sm text-amber-800">
              Le versement PER est déductible du revenu imposable : plus votre TMI est haute
              (30%, 41%, 45%), plus chaque euro versé réduit votre impôt. Avec une TMI à
              {` ${getRateLabel(tmiAvant)}`}, vous récupérez environ {formatEuro(economieIR)}
              pour {versement.toLocaleString('fr-FR')} € versés.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleEnregistrerMesResultats}
              disabled={isSending}
              className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSending ? 'Validation...' : 'Valider'}
            </button>
            {archiveMessage ? (
              <p
                className={`text-center text-sm ${
                  archiveMessage.tone === 'success'
                    ? 'text-green-700'
                    : 'text-red-600'
                }`}
                role="status"
              >
                {archiveMessage.text}
              </p>
            ) : null}
          </div>

          <p className="text-xs text-gray-400 text-center italic">
            * Estimation pédagogique : barème progressif 2026 (0/11/30/41/45) + quotient familial plafonné (cap ≈ 1 750 € / demi-part supplémentaire) + CEHR (hypothèse : le PER réduit le RFR du montant déduit).
          </p>
        </div>
      </div>
    </main>
  );
}
