'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

/** Plafond abattement forfaitaire frais pro (ordre de grandeur IR, revenus récents) — à ajuster si tu suis une année précise. */
const PLAFOND_ABATTEMENT_10_PCT = 14_171;

type CvBand = '3' | '4' | '5' | '6plus';

/** Barème kilométrique type administration (tranches continues) — valeurs indicatives type 5 CV ; 3/4/6+ en approximation pédagogique. */
const BAREME_KM: Record<
  CvBand,
  { d1: number; r1: number; r2: number; fix2: number; r3: number; fix3: number }
> = {
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
    <>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/fiscal"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Retour à l&apos;espace fiscal
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Accueil
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-4">
        <h1 className="text-xl font-semibold text-slate-900">
          Déclaration de revenus — aide à la préparation
        </h1>
      </div>

      <main className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-white p-8 shadow-xl">
          <h2 className="text-center text-2xl font-bold text-gray-800">
            Frais réels vs forfait 10&nbsp;%
          </h2>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-4 text-sm font-bold text-slate-900">
                Données (pédagogique)
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Salaires nets à déclarer (assiette de l&apos;abattement forfaitaire) (€)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={salaires === '' ? '' : salaires}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSalaires(v === '' ? '' : Number(v));
                    }}
                    className="w-full rounded-lg border border-gray-300 p-3 text-base text-black outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Autres frais réels (hors véhicule) (€)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={autresFraisReels === '' ? '' : autresFraisReels}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAutresFraisReels(v === '' ? '' : Number(v));
                    }}
                    className="w-full rounded-lg border border-gray-300 p-3 text-base text-black outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Kilomètres professionnels (aller-retours cumulés / an)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={km === '' ? '' : km}
                    onChange={(e) => {
                      const v = e.target.value;
                      setKm(v === '' ? '' : Number(v));
                    }}
                    className="w-full rounded-lg border border-gray-300 p-3 text-base text-black outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Puissance fiscale (barème kilométrique simplifié)
                  </label>
                  <select
                    value={cv}
                    onChange={(e) => setCv(e.target.value as CvBand)}
                    className="w-full rounded-lg border border-gray-300 bg-white p-3 text-base text-black"
                  >
                    <option value="3">3 CV</option>
                    <option value="4">4 CV</option>
                    <option value="5">5 CV</option>
                    <option value="6plus">6 CV et +</option>
                  </select>
                  <p className="mt-2 text-xs text-slate-600">
                    Indemnité kilométrique estimée (tranches type barème administratif)&nbsp;:{' '}
                    <span className="font-semibold">{formatEuro(partKm)}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <h3 className="text-sm font-bold text-blue-900">Forfait 10&nbsp;%</h3>
                <p className="mt-2 text-2xl font-bold text-blue-900">
                  {formatEuro(forfait10)}
                </p>
                <p className="mt-1 text-xs text-blue-800/90">
                  min(10&nbsp;% des salaires, plafond {formatEuro(PLAFOND_ABATTEMENT_10_PCT)})
                </p>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                <h3 className="text-sm font-bold text-indigo-900">Frais réels (estimés)</h3>
                <p className="mt-2 text-2xl font-bold text-indigo-900">
                  {formatEuro(fraisReelsTotal)}
                </p>
                <p className="mt-1 text-xs text-indigo-800/90">
                  autres frais + indemnité km ({typeof km === 'number' ? km.toLocaleString('fr-FR') : 0}{' '}
                  km, {cv} CV)
                </p>
              </div>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                meilleur === 'forfait'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-emerald-200 bg-emerald-50'
              }`}
            >
              <h3
                className={`text-sm font-bold ${
                  meilleur === 'forfait' ? 'text-amber-900' : 'text-emerald-900'
                }`}
              >
                Comparaison
              </h3>
              <p
                className={`mt-2 text-sm ${
                  meilleur === 'forfait' ? 'text-amber-900' : 'text-emerald-900'
                }`}
              >
                {meilleur === 'forfait' ? (
                  <>
                    Le <strong>forfait 10&nbsp;%</strong> est plus favorable d&apos;environ{' '}
                    <strong>{formatEuro(ecart)}</strong> par rapport à vos frais réels déclarés
                    (hors cas particuliers).
                  </>
                ) : (
                  <>
                    Les <strong>frais réels</strong> (avec barème km) sont plus favorables d&apos;environ{' '}
                    <strong>{formatEuro(ecart)}</strong> par rapport au forfait.
                  </>
                )}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                En pratique, vous retenez la déduction la plus avantageuse si vous optez pour les frais réels
                (et que vous pouvez les justifier). Ceci ne remplace pas le calcul officiel de l&apos;impôt.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-900">
                Réductions / crédits d&apos;impôt courants — checklist
              </h3>
              <ul className="space-y-3 text-sm text-slate-800">
                <li className="flex gap-3 rounded-lg border border-white bg-white/80 p-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-blue-600"
                    readOnly
                    tabIndex={-1}
                    aria-hidden
                  />
                  <span>
                    <strong>Garde d&apos;enfants de moins de 6 ans</strong> (crèche, assistante maternelle
                    agréée, garde à domicile déclarée)&nbsp;: pensez aux cases et plafonds (crédit d&apos;impôt /
                    avance selon situation).
                  </span>
                </li>
                <li className="flex gap-3 rounded-lg border border-white bg-white/80 p-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-blue-600"
                    readOnly
                    tabIndex={-1}
                    aria-hidden
                  />
                  <span>
                    <strong>Emploi à domicile</strong> (ménage, jardinage, garde à domicile dans le cadre
                    services à la personne)&nbsp;: crédit d&apos;impôt dans des limites — conservez les
                    attestations fiscales.
                  </span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                Les cases cochées ici sont des <strong>rappels visuels</strong> (non enregistrés). Pour une vraie
                checklist interactive, remplace les <code className="rounded bg-slate-100 px-1">readOnly</code> par
                un <code className="rounded bg-slate-100 px-1">useState</code> par ligne.
              </p>
            </div>

            <p className="text-center text-xs italic text-gray-400">
              * Outil pédagogique simplifié. Plafonds, barème kilométrique exact et règles détaillées&nbsp;: voir
              impots.gouv.fr et le formulaire de l&apos;année concernée.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
