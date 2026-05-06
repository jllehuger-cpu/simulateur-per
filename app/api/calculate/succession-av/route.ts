import { NextRequest } from 'next/server';

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */
export type LienParente = 'conjoint_pacs' | 'enfant' | 'frere_soeur' | 'neveu_niece' | 'tiers';

export interface ContratInput {
  id: string;
  nom: string;
  capitalDeces: number;
  primesAvant70: number;
  primesApres70: number;
}

export interface BeneficiaireInput {
  id: string;
  nom: string;
  lienParente: LienParente;
  repartition: Record<string, number>; // contratId → % (0–100)
}

export interface SuccessionAVInput {
  contrats: ContratInput[];
  beneficiaires: BeneficiaireInput[];
}

export interface BeneficiaireResult {
  id: string;
  nom: string;
  lienParente: LienParente;
  exonere: boolean;

  // 990i
  capital990i: number;
  abattement990i: number;
  taxable990i: number;
  droits990i: number;

  // 757B
  primes757B: number;
  abattement757B_global: number;
  apres30500: number;
  abattementPersonnel757B: number;
  taxable757B: number;
  droits757B: number;

  // Synthèse
  capitalTotalRecu: number;
  droitsTotal: number;
  netRecu: number;
}

export interface SuccessionAVResult {
  totalDroits990i: number;
  totalDroits757B: number;
  totalDroitsGlobal: number;
  totalCapital: number;
  beneficiaires: BeneficiaireResult[];
}

/* ─────────────────────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────────────────────── */

// Abattements personnels 757B (Art. 779 CGI) — appliqués après l'abattement global 30 500 €
const ABATTEMENTS_PERSONNELS: Record<LienParente, number> = {
  conjoint_pacs: 0,      // exonéré de toute façon
  enfant:        100_000,
  frere_soeur:   15_932,
  neveu_niece:   7_967,
  tiers:         1_594,
};

/* ─────────────────────────────────────────────────────────────
   BARÈMES
───────────────────────────────────────────────────────────── */

/**
 * Article 990 I CGI — Prélèvement sur le capital décès (primes avant 70 ans).
 *
 * Assiette = capital décès attribué au bénéficiaire (brut).
 * Abattement : 152 500 € par bénéficiaire (partagé tous contrats confondus).
 * Barème :
 *   – Fraction jusqu'à 152 500 €        → 0 % (abattement)
 *   – Fraction 152 500 € à 852 500 €    → 20 %  (700 000 € de tranche)
 *   – Fraction au-delà de 852 500 €     → 31,25 %
 */
function compute990i(capital: number): { abattement: number; taxable: number; droits: number } {
  const abattement = Math.min(152_500, capital);
  const taxable    = Math.max(0, capital - 152_500);
  const tranche1   = Math.min(taxable, 700_000);          // jusqu'à 852 500 €
  const tranche2   = Math.max(0, taxable - 700_000);      // au-delà
  return { abattement, taxable, droits: tranche1 * 0.20 + tranche2 * 0.3125 };
}

/**
 * Barème ligne directe (enfant) — Art. 777 CGI.
 * S'applique sur la base taxable APRÈS abattement personnel (100 000 €).
 */
function baremeEnfant(base: number): number {
  const tranches = [
    { upper: 8_072,       rate: 0.05 },
    { upper: 12_109,      rate: 0.10 },
    { upper: 15_932,      rate: 0.15 },
    { upper: 552_324,     rate: 0.20 },
    { upper: 902_838,     rate: 0.30 },
    { upper: 1_805_677,   rate: 0.40 },
    { upper: Infinity,    rate: 0.45 },
  ];
  let droits = 0;
  let prev   = 0;
  for (const { upper, rate } of tranches) {
    const slice = Math.max(0, Math.min(base, upper) - prev);
    droits += slice * rate;
    prev    = upper;
    if (base <= upper) break;
  }
  return droits;
}

/**
 * Droits de succession 757B selon le lien de parenté.
 * Reçoit la base APRÈS l'abattement global 30 500 €.
 * Applique l'abattement personnel puis le barème.
 *
 * Barèmes (Art. 777–779 CGI) :
 *  – Enfant       : abattement 100 000 €, puis barème ligne directe (5–45 %)
 *  – Frère/sœur   : abattement 15 932 €, puis 35 % / 45 % (seuil 24 430 €)
 *  – Neveu/nièce  : abattement 7 967 €, taux unique 55 %
 *  – Tiers        : abattement 1 594 €, taux unique 60 %
 *  – Conjoint/PACS: exonéré (loi TEPA 2007)
 */
function compute757B(apres30500: number, lienParente: LienParente): {
  abattementPersonnel: number; taxable: number; droits: number;
} {
  if (lienParente === 'conjoint_pacs') return { abattementPersonnel: 0, taxable: 0, droits: 0 };

  const abattementPersonnel = ABATTEMENTS_PERSONNELS[lienParente];
  const taxable = Math.max(0, apres30500 - abattementPersonnel);
  let droits = 0;

  switch (lienParente) {
    case 'enfant':
      droits = baremeEnfant(taxable);
      break;
    case 'frere_soeur': {
      const t1 = Math.min(taxable, 24_430);
      const t2 = Math.max(0, taxable - 24_430);
      droits   = t1 * 0.35 + t2 * 0.45;
      break;
    }
    case 'neveu_niece':
      droits = taxable * 0.55;
      break;
    case 'tiers':
      droits = taxable * 0.60;
      break;
  }

  return { abattementPersonnel, taxable, droits };
}

/* ─────────────────────────────────────────────────────────────
   CALCUL PRINCIPAL
───────────────────────────────────────────────────────────── */
function computeSuccessionAV(input: SuccessionAVInput): SuccessionAVResult {
  const { contrats, beneficiaires } = input;

  /**
   * Étape 1 : Pour chaque contrat, calculer la base 990i et la base 757B.
   *
   * Le capital décès est scindé en deux parts proportionnelles aux primes :
   *   – Part 990i = capitalDeces × (primesAvant70 / totalPrimes)
   *   – Part 757B : l'assiette n'est pas le capital mais les primes après 70
   *     (les intérêts produits après 70 ans sont totalement exonérés — Art. 757 B CGI)
   *
   * Si aucune prime n'est renseignée, tout le capital est rattaché à 990i.
   */
  const contratData = contrats.map((c) => {
    const totalPrimes  = c.primesAvant70 + c.primesApres70;
    const ratioAvant70 = totalPrimes > 0 ? c.primesAvant70 / totalPrimes : 1;
    return {
      ...c,
      capital990i: c.capitalDeces * ratioAvant70,
      primes757B:  c.primesApres70,
    };
  });

  /**
   * Étape 2 : Agréger par bénéficiaire (tous contrats confondus).
   */
  const aggBenef = beneficiaires.map((b) => {
    const exonere = b.lienParente === 'conjoint_pacs';

    const capital990i      = contratData.reduce((s, c) => s + (b.repartition[c.id] ?? 0) / 100 * c.capital990i,     0);
    const primes757B       = contratData.reduce((s, c) => s + (b.repartition[c.id] ?? 0) / 100 * c.primes757B,      0);
    const capitalTotalRecu = contratData.reduce((s, c) => s + (b.repartition[c.id] ?? 0) / 100 * c.capitalDeces,    0);

    return { b, exonere, capital990i, primes757B, capitalTotalRecu };
  });

  /**
   * Étape 3 : 990i
   * L'abattement de 152 500 € est appliqué par bénéficiaire
   * (il est partagé tous contrats confondus pour ce même bénéficiaire).
   */
  const res990i = aggBenef.map(({ exonere, capital990i }) => {
    if (exonere) return { abattement990i: 0, taxable990i: 0, droits990i: 0 };
    const { abattement, taxable, droits } = compute990i(capital990i);
    return { abattement990i: abattement, taxable990i: taxable, droits990i: droits };
  });

  /**
   * Étape 4 : 757B — partage de l'abattement global 30 500 €.
   *
   * L'abattement de 30 500 € est partagé proportionnellement entre TOUS
   * les bénéficiaires recevant des primes après 70 ans, y compris le conjoint
   * (dont la quote-part est ensuite sans objet puisqu'il est exonéré).
   */
  const total757B = aggBenef.reduce((s, { primes757B }) => s + primes757B, 0);

  const res757B = aggBenef.map(({ b, exonere, primes757B }) => {
    const abattement757B_global =
      total757B > 0 ? Math.min(30_500 * (primes757B / total757B), primes757B) : 0;
    const apres30500 = Math.max(0, primes757B - abattement757B_global);

    if (exonere) {
      return { abattement757B_global, apres30500, abattementPersonnel757B: 0, taxable757B: 0, droits757B: 0 };
    }

    const { abattementPersonnel, taxable, droits } = compute757B(apres30500, b.lienParente);
    return {
      abattement757B_global,
      apres30500,
      abattementPersonnel757B: abattementPersonnel,
      taxable757B:  taxable,
      droits757B:   droits,
    };
  });

  /**
   * Étape 5 : Synthèse par bénéficiaire.
   */
  const beneficiairesResult: BeneficiaireResult[] = aggBenef.map(
    ({ b, exonere, capital990i, primes757B, capitalTotalRecu }, i) => {
      const droitsTotal = res990i[i].droits990i + res757B[i].droits757B;
      return {
        id: b.id, nom: b.nom, lienParente: b.lienParente, exonere,
        capital990i,
        ...res990i[i],
        primes757B,
        ...res757B[i],
        capitalTotalRecu,
        droitsTotal,
        netRecu: capitalTotalRecu - droitsTotal,
      };
    },
  );

  const totalDroits990i   = beneficiairesResult.reduce((s, b) => s + b.droits990i,   0);
  const totalDroits757B   = beneficiairesResult.reduce((s, b) => s + b.droits757B,   0);
  const totalDroitsGlobal = totalDroits990i + totalDroits757B;
  const totalCapital      = beneficiairesResult.reduce((s, b) => s + b.capitalTotalRecu, 0);

  return { totalDroits990i, totalDroits757B, totalDroitsGlobal, totalCapital, beneficiaires: beneficiairesResult };
}

/* ─────────────────────────────────────────────────────────────
   VALIDATION
───────────────────────────────────────────────────────────── */
const LIENS_VALIDES = new Set<LienParente>(['conjoint_pacs', 'enfant', 'frere_soeur', 'neveu_niece', 'tiers']);

function validateInput(body: unknown): { data: SuccessionAVInput; error?: never } | { data?: never; error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Corps JSON invalide.' };
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.contrats) || b.contrats.length === 0)
    return { error: 'Au moins un contrat est requis.' };
  if (!Array.isArray(b.beneficiaires) || b.beneficiaires.length === 0)
    return { error: 'Au moins un bénéficiaire est requis.' };

  for (let i = 0; i < (b.contrats as unknown[]).length; i++) {
    const c = (b.contrats as unknown[])[i] as Record<string, unknown>;
    if (typeof c.id !== 'string' || typeof c.nom !== 'string')
      return { error: `contrats[${i}] : id et nom requis.` };
    for (const field of ['capitalDeces', 'primesAvant70', 'primesApres70'] as const) {
      if (typeof c[field] !== 'number' || !isFinite(c[field] as number) || (c[field] as number) < 0)
        return { error: `contrats[${i}].${field} doit être un nombre fini ≥ 0.` };
    }
    if ((c.primesAvant70 as number) + (c.primesApres70 as number) > (c.capitalDeces as number) + 0.01)
      return { error: `contrats[${i}] : primesAvant70 + primesApres70 ne peut pas dépasser capitalDeces.` };
  }

  for (let i = 0; i < (b.beneficiaires as unknown[]).length; i++) {
    const ben = (b.beneficiaires as unknown[])[i] as Record<string, unknown>;
    if (typeof ben.id !== 'string' || typeof ben.nom !== 'string')
      return { error: `beneficiaires[${i}] : id et nom requis.` };
    if (!LIENS_VALIDES.has(ben.lienParente as LienParente))
      return { error: `beneficiaires[${i}].lienParente invalide.` };
    if (typeof ben.repartition !== 'object' || ben.repartition === null)
      return { error: `beneficiaires[${i}].repartition doit être un objet.` };
  }

  // Vérification : somme des répartitions = 100 % par contrat (tolérance 1 %)
  const contrats   = b.contrats as Array<Record<string, unknown>>;
  const benefList  = b.beneficiaires as Array<Record<string, unknown>>;
  for (const c of contrats) {
    const sum = benefList.reduce((s, ben) => {
      const rep = ben.repartition as Record<string, number>;
      return s + (rep[c.id as string] ?? 0);
    }, 0);
    if (Math.abs(sum - 100) > 1)
      return { error: `Le total des répartitions pour "${c.nom}" est ${sum.toFixed(1)} % (attendu : 100 %).` };
  }

  return { data: body as SuccessionAVInput };
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

  return Response.json(computeSuccessionAV(validation.data));
}
