import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

/* ─────────────────────────────────────────────────────────────
   BARÈMES — chargés depuis public/baremes-ir.json au démarrage
   Le fichier contient les tranches et paramètres pour chaque année.
───────────────────────────────────────────────────────────── */
interface TrancheIR {
  limite: number | null; // null = infini (dernière tranche)
  taux: number;
}

interface ConfigIR {
  pension_max: number;           // déduction max pour pension alimentaire à un enfant détaché
  abattement_10_max: number;     // plafond de l'abattement forfaitaire 10 % sur salaires
  plafond_quotient_familial: number; // (non utilisé ici, cf. simulateur-per pour QF plafonné)
  age_limite_rattachement: number;
  age_limite_etudiant: number;
}

interface BaremeAnnee {
  tranches_ir: TrancheIR[];
  configuration: ConfigIR;
}

interface BaremesIR {
  metadata: {
    sections_avis: Array<{
      categorie: string;
      cases: Array<{ id: string; label: string; type: 'revenu' | 'charge' }>;
    }>;
  };
  baremes: Record<string, BaremeAnnee>;
}

// Chargement statique à l'import (Server Component / Route Handler = Node.js)
const baremes: BaremesIR = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'baremes-ir.json'), 'utf-8')
);

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */
type Situation = 'celibataire' | 'marie_pacs';

export interface Enfant {
  age: number;
  estEtudiant: boolean;
  gardeAlternee: boolean;
}

export interface IRInput {
  annee: string;
  situation: Situation;
  revenus: Record<string, number>;  // clés = codes cases fiscales (1AJ, 1BJ, 6DD…)
  enfants: Enfant[];
  compareDetachement?: boolean;     // si true, calcule l'option B (pension + détachement)
}

export interface IRResultOption {
  impot: number;
  tmi: number;    // tranche marginale en %
  parts: number;
}

export interface IRResult {
  annee: string;
  totalBrut: number;
  totalCharges: number;
  abattement: number;
  revenuNetImposable: number;

  optionA: IRResultOption; // rattachement de tous les enfants
  optionB: IRResultOption | null; // pension + détachement d'un enfant majeur (si dispo)

  gainDetachement: number; // optionA.impot − optionB.impot (>0 = B plus avantageux)
  conseillerDetachement: boolean;
}

/* ─────────────────────────────────────────────────────────────
   FONCTIONS DE CALCUL
───────────────────────────────────────────────────────────── */

/**
 * Nombre de parts fiscales selon la situation et la liste d'enfants.
 *
 * Règles (Art. 194 CGI) :
 *  - Base : 1 part (célibataire) ou 2 parts (marié/pacsé)
 *  - Enfants éligibles au rattachement :
 *      < 21 ans, OU < 25 ans et étudiant
 *  - Tri : enfants en garde pleine avant garde alternée
 *  - Rang 1 et 2 : +0,5 part chacun (ou 0,25 en garde alternée)
 *  - Rang 3 et suivants : +1 part (ou 0,5 en garde alternée)
 */
function calculerParts(situation: Situation, enfants: Enfant[]): number {
  let parts = situation === 'marie_pacs' ? 2 : 1;

  const eligibles = enfants.filter(
    (e) => e.age < 21 || (e.age < 25 && e.estEtudiant)
  );
  // Garde pleine en premier (demi-part pleine avant demi-part alternée)
  const trie = [...eligibles].sort((a, b) =>
    a.gardeAlternee === b.gardeAlternee ? 0 : a.gardeAlternee ? 1 : -1
  );

  trie.forEach((enf, index) => {
    const rang = index + 1;
    const valeurPleine = rang >= 3 ? 1 : 0.5;
    parts += enf.gardeAlternee ? valeurPleine / 2 : valeurPleine;
  });

  return parts;
}

/**
 * Calcul de l'impôt avec barème progressif sur quotient familial.
 *
 * Formule :
 *  1. Quotient = revenuImposable / parts
 *  2. Appliquer le barème progressif sur le quotient → impôt_par_part
 *  3. Impôt total = impôt_par_part × parts
 *
 * Note : cette fonction n'applique pas le plafonnement du QF.
 * Pour le simulateur PER (avec plafonnement), voir app/api/calculate/per/route.ts.
 */
function calculerImpot(
  revenuImposable: number,
  parts: number,
  tranches: TrancheIR[]
): { total: number; tmi: number } {
  if (!tranches?.length || revenuImposable <= 0) return { total: 0, tmi: 0 };

  const quotient = revenuImposable / parts;
  let impotAccumule = 0;
  let seuilPrecedent = 0;
  let tmi = 0;

  for (const tranche of tranches) {
    const limite = tranche.limite ?? Infinity;
    if (quotient > seuilPrecedent) {
      const montantTranche = Math.min(quotient, limite) - seuilPrecedent;
      impotAccumule += montantTranche * tranche.taux;
      tmi = tranche.taux * 100;
      seuilPrecedent = limite;
    } else {
      break;
    }
  }

  return { total: Math.round(impotAccumule * parts), tmi };
}

/* ─────────────────────────────────────────────────────────────
   VALIDATION
───────────────────────────────────────────────────────────── */
function validateInput(body: unknown): { data: IRInput; error?: never } | { data?: never; error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Corps JSON invalide.' };
  const b = body as Record<string, unknown>;

  const annee = b.annee;
  if (typeof annee !== 'string' || !baremes.baremes[annee])
    return { error: `annee invalide. Années disponibles : ${Object.keys(baremes.baremes).join(', ')}.` };

  const situation = b.situation;
  if (situation !== 'celibataire' && situation !== 'marie_pacs')
    return { error: "situation doit être 'celibataire' ou 'marie_pacs'." };

  if (typeof b.revenus !== 'object' || b.revenus === null || Array.isArray(b.revenus))
    return { error: 'revenus doit être un objet { caseId: montant }.' };

  const revenus = b.revenus as Record<string, unknown>;
  for (const [k, v] of Object.entries(revenus)) {
    if (typeof v !== 'number' || !isFinite(v) || v < 0)
      return { error: `revenus.${k} doit être un nombre fini ≥ 0.` };
  }

  if (!Array.isArray(b.enfants)) return { error: 'enfants doit être un tableau.' };
  for (let i = 0; i < (b.enfants as unknown[]).length; i++) {
    const e = (b.enfants as unknown[])[i];
    if (typeof e !== 'object' || e === null) return { error: `enfants[${i}] invalide.` };
    const ec = e as Record<string, unknown>;
    if (typeof ec.age !== 'number' || ec.age < 0)
      return { error: `enfants[${i}].age doit être un entier ≥ 0.` };
    if (typeof ec.estEtudiant !== 'boolean')
      return { error: `enfants[${i}].estEtudiant doit être un booléen.` };
    if (typeof ec.gardeAlternee !== 'boolean')
      return { error: `enfants[${i}].gardeAlternee doit être un booléen.` };
  }

  return {
    data: {
      annee,
      situation,
      revenus:              revenus as Record<string, number>,
      enfants:              b.enfants as Enfant[],
      compareDetachement:   b.compareDetachement === true,
    },
  };
}

/* ─────────────────────────────────────────────────────────────
   CALCUL PRINCIPAL
───────────────────────────────────────────────────────────── */
function computeIR(input: IRInput): IRResult {
  const { annee, situation, revenus, enfants, compareDetachement } = input;
  const config  = baremes.baremes[annee];
  const params  = config.configuration;
  const meta    = baremes.metadata;

  // --- Agrégation des revenus et charges selon les cases du barème ---
  let totalBrut    = 0;
  let totalCharges = 0;
  meta.sections_avis.forEach((section) => {
    section.cases.forEach((c) => {
      const val = revenus[c.id] ?? 0;
      if (c.type === 'revenu')  totalBrut    += val;
      if (c.type === 'charge') totalCharges += val;
    });
  });

  /**
   * Abattement forfaitaire 10 % sur traitements et salaires (Art. 83 CGI)
   * Plancher : 494 €, plafond : params.abattement_10_max (ex. 14 176 € en 2024)
   */
  const abattement      = Math.min(Math.max(totalBrut * 0.10, 494), params.abattement_10_max);
  const revenuNetImposable = Math.max(0, totalBrut - abattement - totalCharges);

  // --- Option A : tous les enfants rattachés ---
  const partsA = calculerParts(situation, enfants);
  const resA   = calculerImpot(revenuNetImposable, partsA, config.tranches_ir);

  // --- Option B : pension + détachement d'un enfant majeur (≥ 18 ans) ---
  let optionB: IRResultOption | null = null;
  let gainDetachement = 0;

  if (compareDetachement) {
    const enfantADetacher = enfants.find((e) => e.age >= 18);
    if (enfantADetacher) {
      const listeB   = enfants.filter((e) => e !== enfantADetacher);
      const partsB   = calculerParts(situation, listeB);

      /**
       * En détachant l'enfant, le parent peut déduire une pension alimentaire
       * plafonnée à params.pension_max (Art. 156-II CGI).
       * On réduit le revenu net imposable de ce montant.
       */
      const revenuNetB = Math.max(0, revenuNetImposable - params.pension_max);
      const resB = calculerImpot(revenuNetB, partsB, config.tranches_ir);

      optionB = { impot: resB.total, tmi: resB.tmi, parts: partsB };
      gainDetachement = resA.total - resB.total;
    }
  }

  return {
    annee,
    totalBrut,
    totalCharges,
    abattement,
    revenuNetImposable,
    optionA:              { impot: resA.total, tmi: resA.tmi, parts: partsA },
    optionB,
    gainDetachement,
    conseillerDetachement: gainDetachement > 0,
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

  const result = computeIR(validation.data);
  return Response.json(result);
}

/**
 * GET /api/calculate/ir/years — liste les années disponibles dans le barème
 */
export async function GET() {
  return Response.json({ years: Object.keys(baremes.baremes) });
}
