import { NextRequest } from 'next/server';

/* ── Types ─────────────────────────────────────────── */
type LienParente =
  | 'enfant' | 'petit_enfant' | 'arriere_petit_enfant'
  | 'conjoint_pacs' | 'frere_soeur' | 'neveu_niece' | 'tiers';

interface Tranche { limite: number | null; taux: number; }

export interface DonationSimpleInput {
  type: 'donation';
  montant: number;
  lienParente: LienParente;
  nbDonateurs: 1 | 2;
  handicap: boolean;
  donationsAnterieures: number;
}

export interface DonationPartageInput {
  type: 'partage';
  patrimoineTotal: number;
  nbDonateurs: 1 | 2;
  enfants: Array<{ partPct: number; donationsAnterieures: number; handicap: boolean; }>;
}

export interface GenerationInput {
  type: 'generation';
  montant: number;
  nbEnfants: number;
  nbPetitsEnfantsParEnfant: number;
  nbDonateurs: 1 | 2;
  donationsEnfants: number;
  donationsPetitsEnfants: number;
}

type DonationInput = DonationSimpleInput | DonationPartageInput | GenerationInput;

/* ── Constants ─────────────────────────────────────── */
const ABATTEMENTS: Record<LienParente, number> = {
  enfant: 100000,
  petit_enfant: 31865,
  arriere_petit_enfant: 5310,
  conjoint_pacs: 80724,
  frere_soeur: 15932,
  neveu_niece: 7967,
  tiers: 1594,
};

const ABATTEMENT_HANDICAP = 159325;

const BAREMES: Record<string, Tranche[]> = {
  ligne_directe: [
    { limite: 8072, taux: 0.05 },
    { limite: 12109, taux: 0.10 },
    { limite: 15932, taux: 0.15 },
    { limite: 552324, taux: 0.20 },
    { limite: 902838, taux: 0.30 },
    { limite: 1805677, taux: 0.40 },
    { limite: null, taux: 0.45 },
  ],
  conjoint_pacs: [
    { limite: 8072, taux: 0.05 },
    { limite: 15932, taux: 0.10 },
    { limite: 31865, taux: 0.15 },
    { limite: 552324, taux: 0.20 },
    { limite: 902838, taux: 0.30 },
    { limite: 1805677, taux: 0.40 },
    { limite: null, taux: 0.45 },
  ],
  frere_soeur: [
    { limite: 24430, taux: 0.35 },
    { limite: null, taux: 0.45 },
  ],
  neveu_niece: [{ limite: null, taux: 0.55 }],
  tiers: [{ limite: null, taux: 0.60 }],
};

function getBareme(lien: LienParente): Tranche[] {
  if (['enfant', 'petit_enfant', 'arriere_petit_enfant'].includes(lien)) return BAREMES.ligne_directe;
  return BAREMES[lien] ?? BAREMES.tiers;
}

/* ── Tax engine ────────────────────────────────────── */
export interface TrancheDetail { label: string; assiette: number; taux: string; impot: number; }

export function computeTax(
  assiette: number,
  tranches: Tranche[]
): { total: number; detail: TrancheDetail[] } {
  if (assiette <= 0) return { total: 0, detail: [] };
  let droits = 0;
  let reste = assiette;
  let prev = 0;
  const detail: TrancheDetail[] = [];
  for (const t of tranches) {
    const lim = t.limite === null ? Infinity : t.limite;
    const slice = Math.min(Math.max(0, reste), lim - prev);
    if (slice > 0) {
      const impot = slice * t.taux;
      droits += impot;
      detail.push({
        label: t.limite === null
          ? `Plus de ${prev.toLocaleString('fr-FR')} €`
          : `Jusqu'à ${t.limite.toLocaleString('fr-FR')} €`,
        assiette: slice,
        taux: (t.taux * 100).toFixed(0),
        impot,
      });
      reste -= slice;
    }
    prev = t.limite === null ? prev : (t.limite as number);
    if (reste <= 0) break;
  }
  return { total: droits, detail };
}

/* ── Computation functions ─────────────────────────── */
export function computeDonationSimple(input: DonationSimpleInput) {
  const { montant, lienParente, nbDonateurs, handicap, donationsAnterieures } = input;
  const bareme = getBareme(lienParente);
  const abattBase = ABATTEMENTS[lienParente] * nbDonateurs;
  const abattHandicap = handicap ? ABATTEMENT_HANDICAP : 0;
  const abattTotal = abattBase + abattHandicap;
  const abattResiduel = Math.max(0, abattTotal - donationsAnterieures);
  const abattDejaConso = Math.min(donationsAnterieures, abattTotal);

  const baseTotale = Math.max(0, donationsAnterieures + montant - abattTotal);
  const baseAnterieure = Math.max(0, donationsAnterieures - abattTotal);
  const { total: droitsTotaux, detail } = computeTax(baseTotale, bareme);
  const { total: droitsAnterieurs } = computeTax(baseAnterieure, bareme);
  const droits = Math.max(0, droitsTotaux - droitsAnterieurs);
  const baseTaxable = Math.max(0, montant - abattResiduel);

  return {
    abattBase, abattHandicap, abattTotal, abattResiduel, abattDejaConso,
    baseTaxable, droits, netRecu: montant - droits, detail,
  };
}

function computeDonationPartage(input: DonationPartageInput) {
  const { patrimoineTotal, nbDonateurs, enfants } = input;
  const resultatsEnfants = enfants.map(e => {
    const part = patrimoineTotal * (e.partPct / 100);
    const abattBase = 100000 * nbDonateurs;
    const abattHandicap = e.handicap ? ABATTEMENT_HANDICAP : 0;
    const abattTotal = abattBase + abattHandicap;
    const abattResiduel = Math.max(0, abattTotal - e.donationsAnterieures);
    const baseTotale = Math.max(0, e.donationsAnterieures + part - abattTotal);
    const baseAnterieure = Math.max(0, e.donationsAnterieures - abattTotal);
    const { total: dt } = computeTax(baseTotale, BAREMES.ligne_directe);
    const { total: da } = computeTax(baseAnterieure, BAREMES.ligne_directe);
    const droits = Math.max(0, dt - da);
    return { part, abattResiduel, baseTaxable: Math.max(0, part - abattResiduel), droits, netRecu: part - droits };
  });
  return {
    resultatsEnfants,
    totalDroits: resultatsEnfants.reduce((s, e) => s + e.droits, 0),
    totalNet: resultatsEnfants.reduce((s, e) => s + e.netRecu, 0),
  };
}

function computeGeneration(input: GenerationInput) {
  const { montant, nbEnfants, nbPetitsEnfantsParEnfant, nbDonateurs, donationsEnfants, donationsPetitsEnfants } = input;
  const nbPEtTotal = nbEnfants * nbPetitsEnfantsParEnfant;
  const ld = BAREMES.ligne_directe;

  const taxOneChild = (part: number, anterior: number, abatt: number) => {
    const bt = Math.max(0, anterior + part - abatt);
    const ba = Math.max(0, anterior - abatt);
    return Math.max(0, computeTax(bt, ld).total - computeTax(ba, ld).total);
  };

  const partEnfant = montant / nbEnfants;
  const partPEt = montant / nbPEtTotal;
  const abattEnfant = 100000 * nbDonateurs;
  const abattPEtDirect = 31865 * nbDonateurs;

  let droitsA = 0, droitsB = 0, droitsC = 0;
  for (let i = 0; i < nbEnfants; i++) {
    droitsA += taxOneChild(partEnfant, donationsEnfants, abattEnfant);
    for (let j = 0; j < nbPetitsEnfantsParEnfant; j++) {
      droitsB += taxOneChild(partPEt, donationsPetitsEnfants, abattPEtDirect);
      const abattCParPEt = (100000 * nbDonateurs) / nbPetitsEnfantsParEnfant;
      droitsC += taxOneChild(partPEt, donationsPetitsEnfants, abattCParPEt);
    }
  }

  return {
    A: { droits: droitsA, netRecu: montant - droitsA },
    B: { droits: droitsB, netRecu: montant - droitsB },
    C: { droits: droitsC, netRecu: montant - droitsC },
  };
}

/* ── Validation ────────────────────────────────────── */
const LIENS_VALIDES = new Set<string>([
  'enfant', 'petit_enfant', 'arriere_petit_enfant',
  'conjoint_pacs', 'frere_soeur', 'neveu_niece', 'tiers',
]);

function validateInput(body: unknown):
  { data: DonationInput; error?: never } | { data?: never; error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Corps de requête invalide.' };
  const b = body as Record<string, unknown>;

  if (b.type === 'donation') {
    if (typeof b.montant !== 'number' || b.montant < 0) return { error: 'montant invalide.' };
    if (!LIENS_VALIDES.has(b.lienParente as string)) return { error: 'lienParente invalide.' };
    if (b.nbDonateurs !== 1 && b.nbDonateurs !== 2) return { error: 'nbDonateurs doit être 1 ou 2.' };
    if (typeof b.handicap !== 'boolean') return { error: 'handicap doit être boolean.' };
    if (typeof b.donationsAnterieures !== 'number' || b.donationsAnterieures < 0) return { error: 'donationsAnterieures invalide.' };
    return { data: b as unknown as DonationSimpleInput };
  }

  if (b.type === 'partage') {
    if (typeof b.patrimoineTotal !== 'number' || b.patrimoineTotal < 0) return { error: 'patrimoineTotal invalide.' };
    if (b.nbDonateurs !== 1 && b.nbDonateurs !== 2) return { error: 'nbDonateurs doit être 1 ou 2.' };
    if (!Array.isArray(b.enfants) || b.enfants.length < 1 || b.enfants.length > 6) return { error: 'enfants: 1 à 6 éléments.' };
    const total = (b.enfants as Array<{ partPct: unknown }>).reduce((s, e) => s + (typeof e.partPct === 'number' ? e.partPct : 0), 0);
    if (Math.abs(total - 100) > 0.5) return { error: 'La somme des parts doit être 100%.' };
    return { data: b as unknown as DonationPartageInput };
  }

  if (b.type === 'generation') {
    if (typeof b.montant !== 'number' || b.montant < 0) return { error: 'montant invalide.' };
    if (typeof b.nbEnfants !== 'number' || b.nbEnfants < 1 || b.nbEnfants > 10) return { error: 'nbEnfants invalide (1–10).' };
    if (typeof b.nbPetitsEnfantsParEnfant !== 'number' || b.nbPetitsEnfantsParEnfant < 1) return { error: 'nbPetitsEnfantsParEnfant invalide.' };
    if (b.nbDonateurs !== 1 && b.nbDonateurs !== 2) return { error: 'nbDonateurs doit être 1 ou 2.' };
    return { data: b as unknown as GenerationInput };
  }

  return { error: "type invalide. Valeurs: 'donation', 'partage', 'generation'." };
}

/* ── Handler ───────────────────────────────────────── */
export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'JSON malformé.' }, { status: 400 });
  }
  const v = validateInput(body);
  if ('error' in v) return Response.json({ error: v.error }, { status: 422 });
  const input = v.data;
  if (input.type === 'donation') return Response.json(computeDonationSimple(input));
  if (input.type === 'partage') return Response.json(computeDonationPartage(input));
  return Response.json(computeGeneration(input as GenerationInput));
}
