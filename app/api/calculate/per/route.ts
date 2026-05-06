import { NextRequest } from 'next/server';

/* ─────────────────────────────────────────────────────────────
   BARÈME IR 2026 — Art. 197 CGI
   Tranches sur le revenu net imposable par part de quotient familial.
   Chaque euro au-dessus du seuil inférieur est imposé au taux de la tranche.
───────────────────────────────────────────────────────────── */
type TaxBracket = { lower: number; upper: number; rate: number };

const TAX_BRACKETS_2026: TaxBracket[] = [
  { lower: 0,      upper: 11600,               rate: 0    },
  { lower: 11600,  upper: 29579,               rate: 0.11 },
  { lower: 29579,  upper: 84577,               rate: 0.30 },
  { lower: 84577,  upper: 181917,              rate: 0.41 },
  { lower: 181917, upper: Number.POSITIVE_INFINITY, rate: 0.45 },
];

// Taux réels du barème — utilisés pour "snapper" la TMI différentielle
const BAREME_SNAP: number[] = [0, 0.11, 0.30, 0.41, 0.45];

// Plafonnement du quotient familial : avantage max par demi-part supplémentaire
const CAP_PER_DEMI_PART = 1750;

type MaritalStatus = 'celibataire' | 'marie_pacse';

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */
export interface PerInput {
  statut: MaritalStatus;
  revenuFiscalReference: number;
  revenuBrutGlobal: number;
  partsFiscales: number;
  plafondDeductibilitePer: number;
  versement: number;
}

export interface TranchePart {
  rate: number;
  label: string;
  eurosVerses: number;
  economie: number;
}

export interface PerResult {
  // --- Inputs normalisés ---
  dedTot: number;
  rbApres: number;
  rfrApres: number;

  // --- Impôt IR ---
  impotIRAvant: number;
  impotIRApres: number;
  economieIR: number;

  // --- CEHR (Contribution Exceptionnelle sur les Hauts Revenus) ---
  cehrAvant: number;
  cehrApres: number;
  economieCEHR: number;

  // --- Synthèse ---
  economieTotale: number;
  coutReel: number;
  impotsIRCEHRAvant: number;
  impotsIRCEHRApres: number;

  // --- TMI ---
  tmiAvant: number;           // taux snap barème avant versement
  tmiApres: number;           // taux snap barème après versement
  tmiReelleAvant: number;     // TMI différentielle réelle en %
  tmiReelleApres: number;
  tmiBaisse: boolean;         // vrai si le versement fait descendre la tranche

  // --- Quotient familial ---
  qfPlafonnementActif: boolean;

  // --- Répartition différentielle par tranche ---
  repartitionParTranche: TranchePart[];

  // --- Revenus imposés à 30 %+ ---
  revenusAu30Plus: { rate: number; label: string; euros: number }[];
  deductionAu30Plus: number;
}

/* ─────────────────────────────────────────────────────────────
   FONCTIONS DE CALCUL PURES
───────────────────────────────────────────────────────────── */

/**
 * Impôt brut sur UNE part de quotient familial.
 * Application du barème progressif : chaque tranche s'applique sur la fraction
 * du revenu/part qui tombe dans son intervalle [lower, upper[.
 */
function impotParPart(revenuParPart: number): number {
  const r = Math.max(0, revenuParPart);
  return TAX_BRACKETS_2026.reduce((sum, b) => {
    const slice = Math.max(0, Math.min(r, b.upper) - b.lower);
    return sum + slice * b.rate;
  }, 0);
}

/**
 * Impôt brut pour un revenu global et un nombre de parts.
 * Formule : impôt = impotParPart(revenu / parts) × parts
 */
function impotBrut(revenuGlobal: number, parts: number): number {
  const ps = Math.max(1, parts);
  return impotParPart(Math.max(0, revenuGlobal) / ps) * ps;
}

/**
 * Nombre de parts de base selon le statut marital :
 * - Célibataire / divorcé / veuf : 1 part
 * - Marié / pacsé : 2 parts
 */
function partsBase(statut: MaritalStatus): number {
  return statut === 'marie_pacse' ? 2 : 1;
}

/**
 * Impôt final avec plafonnement du quotient familial.
 *
 * Le QF réduit l'impôt en divisant le revenu par plus de parts.
 * Mais l'avantage fiscal par demi-part supplémentaire est plafonné à CAP_PER_DEMI_PART.
 *
 * Algorithme :
 *   1. Calculer l'impôt avec QF complet (non plafonné) → impotQF
 *   2. Calculer l'impôt avec parts de base seules → impotBase
 *   3. Avantage brut QF = impotBase − impotQF
 *   4. Avantage plafonné = nbDemiPartsSup × CAP_PER_DEMI_PART
 *   5. Si avantage brut > avantage plafonné : on plafonne
 *      → impot final = max(impotQF, impotBase − avantage plafonné)
 */
function impotAvecPlafonnementQF(params: {
  revenuGlobal: number;
  parts: number;
  baseParts: number;
}): { impotFinal: number; advantageCap: number; plafonnementActif: boolean } {
  const r = Math.max(0, params.revenuGlobal);
  const ps = Math.max(1, params.parts);
  const base = Math.max(1, params.baseParts);

  const impotQF    = impotBrut(r, ps);
  const impotBase  = impotBrut(r, base);
  const avBrut     = Math.max(0, impotBase - impotQF);
  const demiPartsS = ps > base ? (ps - base) / 0.5 : 0;
  const avCap      = Math.max(0, demiPartsS * CAP_PER_DEMI_PART);
  const impotPlaf  = Math.max(0, impotBase - avCap);
  const impotFinal = Math.max(impotQF, impotPlaf);

  return {
    impotFinal,
    advantageCap:      avCap,
    plafonnementActif: impotPlaf > impotQF + 0.01,
  };
}

/**
 * TMI marginale réelle (approche différentielle) :
 * τ = impôt(R) − impôt(R − 1 €)
 * Tient compte du QF et de son plafonnement.
 */
function tmiMarginaleReelle(params: {
  revenuGlobal: number;
  parts: number;
  baseParts: number;
}): number {
  const r = Math.max(0, Math.floor(params.revenuGlobal));
  if (r < 1) return 0;
  const taxAt = (x: number) =>
    impotAvecPlafonnementQF({ ...params, revenuGlobal: Math.max(0, x) }).impotFinal;
  return Math.max(0, taxAt(r) - taxAt(r - 1));
}

/** Snap vers le taux de barème réel le plus proche (évite les flottants ~0.2999) */
function snapTaux(raw: number): number {
  return BAREME_SNAP.reduce((best, t) =>
    Math.abs(raw - t) < Math.abs(raw - best) ? t : best
  , BAREME_SNAP[0]);
}

/** Label lisible pour un taux (ex. 0.30 → "30%") */
function labelTaux(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * Répartition différentielle du versement par tranche IR.
 *
 * Principe : on retire la déduction euro par euro depuis le sommet du revenu.
 * Pour chaque euro k (de 1 à dedTot) :
 *   gain_k = impôt(R − k + 1) − impôt(R − k)    [taux marginal sur cet euro]
 * On groupe les euros ayant le même taux snap et on cumule les gains.
 *
 * Complexité O(dedTot) — limité à 200 000 itérations max pour la perf serveur.
 */
function repartitionDifferentielle(params: {
  revenuGlobal: number;
  dedTot: number;
  parts: number;
  baseParts: number;
}): TranchePart[] {
  const rb  = Math.floor(Math.max(0, params.revenuGlobal));
  const ded = Math.min(Math.max(0, Math.floor(params.dedTot)), rb, 200_000);
  const taxAt = (g: number) =>
    impotAvecPlafonnementQF({ revenuGlobal: Math.max(0, g), parts: params.parts, baseParts: params.baseParts }).impotFinal;

  const bySnap = new Map<number, { eurosVerses: number; economie: number }>();
  for (let k = 1; k <= ded; k++) {
    const delta = taxAt(rb - k + 1) - taxAt(rb - k);
    const snap  = snapTaux(delta);
    const cur   = bySnap.get(snap) ?? { eurosVerses: 0, economie: 0 };
    cur.eurosVerses += 1;
    cur.economie    += delta;
    bySnap.set(snap, cur);
  }

  return Array.from(bySnap.entries())
    .sort(([a], [b]) => b - a)
    .map(([rate, v]) => ({ rate, label: labelTaux(rate), ...v }));
}

/**
 * Revenus imposés à 30 %+ et fraction de la déduction dans ces tranches.
 * Parcourt l'assiette de 0 à revenuGlobal et tag chaque euro par sa tranche.
 * Complexité O(revenuGlobal) — limité à 200 000 € max pour la perf serveur.
 */
function revenusParTranche30Plus(params: {
  revenuGlobal: number;
  dedTot: number;
  parts: number;
  baseParts: number;
}): { parTranche: { rate: number; label: string; euros: number }[]; deductionAu30Plus: number } {
  const rbInt = Math.floor(Math.max(0, params.revenuGlobal));
  const limit = Math.min(rbInt, 200_000);
  const ded   = Math.min(Math.max(0, params.dedTot), rbInt);
  const taxAt = (g: number) =>
    impotAvecPlafonnementQF({ revenuGlobal: g, parts: params.parts, baseParts: params.baseParts }).impotFinal;

  const countByRate = new Map<number, number>();
  let deductionAu30Plus = 0;
  let tPrev = taxAt(0);

  for (let k = 1; k <= limit; k++) {
    const tCurr = taxAt(k);
    const m = snapTaux(tCurr - tPrev);
    countByRate.set(m, (countByRate.get(m) ?? 0) + 1);
    if (k > rbInt - ded && m >= 0.3) deductionAu30Plus += 1;
    tPrev = tCurr;
  }

  const parTranche = [0.45, 0.41, 0.30]
    .map((rate) => ({ rate, label: labelTaux(rate), euros: countByRate.get(rate) ?? 0 }))
    .filter((r) => r.euros > 0);

  return { parTranche, deductionAu30Plus };
}

/**
 * CEHR — Contribution Exceptionnelle sur les Hauts Revenus (Art. 223 sexies CGI)
 *
 * Seuils pour un célibataire :
 *   RFR ≤ 250 000 € → 0 %
 *   250 000 < RFR ≤ 500 000 € → 3 % sur la fraction > 250 000 €
 *   RFR > 500 000 € → 3 % × 250 000 + 4 % × (RFR − 500 000 €)
 *
 * Pour un couple marié/pacsé les seuils sont doublés (500 000 / 1 000 000 €).
 */
function computeCehr(rfr: number, statut: MaritalStatus): number {
  const r = Math.max(0, rfr);
  const couple = statut === 'marie_pacse';
  const low    = couple ? 500_000 : 250_000;
  const high   = couple ? 1_000_000 : 500_000;
  if (r <= low)  return 0;
  if (r <= high) return (r - low) * 0.03;
  return (high - low) * 0.03 + (r - high) * 0.04;
}

/* ─────────────────────────────────────────────────────────────
   VALIDATION
───────────────────────────────────────────────────────────── */
function validateInput(body: unknown): { data: PerInput; error?: never } | { data?: never; error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Corps JSON invalide.' };
  const b = body as Record<string, unknown>;

  const statut = b.statut;
  if (statut !== 'celibataire' && statut !== 'marie_pacse')
    return { error: "statut doit être 'celibataire' ou 'marie_pacse'." };

  for (const field of ['revenuFiscalReference', 'revenuBrutGlobal', 'partsFiscales', 'plafondDeductibilitePer', 'versement'] as const) {
    if (typeof b[field] !== 'number' || !isFinite(b[field] as number) || (b[field] as number) < 0)
      return { error: `${field} doit être un nombre fini ≥ 0.` };
  }

  const minParts = statut === 'marie_pacse' ? 2 : 1;
  if ((b.partsFiscales as number) < minParts)
    return { error: `partsFiscales doit être ≥ ${minParts} pour le statut '${statut}'.` };

  return {
    data: {
      statut,
      revenuFiscalReference:   b.revenuFiscalReference   as number,
      revenuBrutGlobal:        b.revenuBrutGlobal        as number,
      partsFiscales:           b.partsFiscales           as number,
      plafondDeductibilitePer: b.plafondDeductibilitePer as number,
      versement:               b.versement               as number,
    },
  };
}

/* ─────────────────────────────────────────────────────────────
   CALCUL PRINCIPAL
───────────────────────────────────────────────────────────── */
function computePer(input: PerInput): PerResult {
  const { statut, revenuFiscalReference, revenuBrutGlobal, partsFiscales, plafondDeductibilitePer, versement } = input;

  const rfr      = Math.max(0, revenuFiscalReference);
  const rb       = Math.max(0, revenuBrutGlobal);
  const ps       = Math.max(partsBase(statut), partsFiscales);
  const plafond  = Math.max(0, plafondDeductibilitePer);
  const base     = partsBase(statut);

  // Déduction effective = min(versement, revenu brut, plafond)
  const dedTot   = Math.min(versement, rb, plafond);
  const rbApres  = Math.max(0, rb - dedTot);
  const rfrApres = Math.max(0, rfr - dedTot);

  // --- IR avant et après ---
  const taxAv = impotAvecPlafonnementQF({ revenuGlobal: rb,      parts: ps, baseParts: base });
  const taxAp = impotAvecPlafonnementQF({ revenuGlobal: rbApres, parts: ps, baseParts: base });

  const impotIRAvant = taxAv.impotFinal;
  const impotIRApres = taxAp.impotFinal;
  const economieIR   = impotIRAvant - impotIRApres;

  // --- TMI ---
  const tmiRawAv = tmiMarginaleReelle({ revenuGlobal: rb,      parts: ps, baseParts: base });
  const tmiRawAp = tmiMarginaleReelle({ revenuGlobal: rbApres, parts: ps, baseParts: base });
  const tmiAvant = snapTaux(tmiRawAv);
  const tmiApres = snapTaux(tmiRawAp);

  // --- CEHR ---
  const cehrAvant   = computeCehr(rfr,      statut);
  const cehrApres   = computeCehr(rfrApres, statut);
  const economieCEHR = cehrAvant - cehrApres;

  // --- Synthèse ---
  const economieTotale = economieIR + economieCEHR;
  const coutReel       = versement - economieTotale;

  // --- Répartition différentielle ---
  const repartitionParTranche = repartitionDifferentielle({ revenuGlobal: rb, dedTot, parts: ps, baseParts: base });

  // --- Revenus 30 %+ ---
  const { parTranche: revenusAu30Plus, deductionAu30Plus } =
    revenusParTranche30Plus({ revenuGlobal: rb, dedTot, parts: ps, baseParts: base });

  return {
    dedTot, rbApres, rfrApres,
    impotIRAvant, impotIRApres, economieIR,
    cehrAvant, cehrApres, economieCEHR,
    economieTotale, coutReel,
    impotsIRCEHRAvant: impotIRAvant + cehrAvant,
    impotsIRCEHRApres: impotIRApres + cehrApres,
    tmiAvant, tmiApres,
    tmiReelleAvant: tmiRawAv * 100,
    tmiReelleApres: tmiRawAp * 100,
    tmiBaisse: tmiApres < tmiAvant,
    qfPlafonnementActif: taxAv.plafonnementActif,
    repartitionParTranche,
    revenusAu30Plus,
    deductionAu30Plus,
  };
}

/* ─────────────────────────────────────────────────────────────
   ROUTE HANDLER
───────────────────────────────────────────────────────────── */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON malformé.' }, { status: 400 });
  }

  const validation = validateInput(body);
  if ('error' in validation) return Response.json({ error: validation.error }, { status: 422 });

  const result = computePer(validation.data);
  return Response.json(result);
}
