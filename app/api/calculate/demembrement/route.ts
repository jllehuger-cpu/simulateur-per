import { NextRequest } from 'next/server';

/* ── Tables & helpers ── */
const TABLE_INSEE: Record<'H'|'F', Record<number,number>> = {
  H: {0:79.45,10:69.85,20:59.98,30:50.33,40:40.78,50:31.59,60:23.19,61:22.41,62:21.64,63:20.89,64:20.14,65:19.39,66:18.65,67:17.91,68:17.17,69:16.45,70:15.73,75:12.24,80:9.02,85:6.28,90:4.23,95:2.92,100:2.61},
  F: {0:85.40,10:75.76,20:65.83,30:55.97,40:46.20,50:36.68,60:27.63,61:26.75,62:25.88,63:25.01,64:24.14,65:23.28,66:22.42,67:21.57,68:20.72,69:19.87,70:19.02,75:14.93,80:11.10,85:7.76,90:5.16,95:3.40,100:2.34},
};
function esperance(age: number, s: 'H'|'F'): number {
  const keys = Object.keys(TABLE_INSEE[s]).map(Number).sort((a,b)=>b-a);
  const k = keys.find(a => a <= age) ?? 0;
  return TABLE_INSEE[s][k] ?? 2;
}
function fiscalPctU(a: number): number {
  if (a < 21) return 90; if (a < 31) return 80; if (a < 41) return 70;
  if (a < 51) return 60; if (a < 61) return 50; if (a < 71) return 40;
  if (a < 81) return 30; if (a < 91) return 20; return 10;
}
function econoPctU(a: number, s: 'H'|'F', rend: number, taux: number): number {
  const n = esperance(a, s);
  const i = taux / 100, r = rend / 100;
  const pct = i === 0 ? r * n * 100 : r * (1 - Math.pow(1+i,-n)) / i * 100;
  return Math.min(100, Math.max(0, pct));
}

interface Tranche { limite: number|null; taux: number }
function droits(base: number, tranches: Tranche[]): number {
  let d = 0, reste = base, prev = 0;
  for (const t of tranches) {
    const lim = t.limite === null ? Infinity : t.limite;
    const s = Math.min(Math.max(0, reste), lim - prev);
    if (s > 0) { d += s * t.taux; reste -= s; }
    prev = lim;
    if (reste <= 0) break;
  }
  return d;
}

const BAREMES_LD: Tranche[] = [
  {limite:8072,taux:0.05},{limite:12109,taux:0.10},{limite:15932,taux:0.15},
  {limite:552324,taux:0.20},{limite:902838,taux:0.30},{limite:1805677,taux:0.40},
  {limite:null,taux:0.45},
];
const ABATTEMENTS: Record<string,number> = {
  enfant:100000, petit_enfant:31865, frere_soeur:15932, neveu_niece:7967, tiers:1594,
};
function bareme(lien: string): Tranche[] {
  if (lien === 'frere_soeur') return [{limite:24430,taux:0.35},{limite:null,taux:0.45}];
  if (lien === 'neveu_niece') return [{limite:null,taux:0.55}];
  if (lien === 'tiers')       return [{limite:null,taux:0.60}];
  return BAREMES_LD;
}

/* ── Calcul donation (onglet 3) ── */
function computeDonation(p: {
  valeurBien: number; ageDonateur: number; sexeDonateur: 'H'|'F';
  methodeNP: 'fiscal'|'economique'; lienParente: string; nbDonateurs: number;
  donationAnterieure: number; rendement?: number; tauxActualisation?: number;
}) {
  const rend = p.rendement ?? 4;
  const taux = p.tauxActualisation ?? 3;
  const pctUF = p.methodeNP === 'fiscal'
    ? fiscalPctU(p.ageDonateur)
    : econoPctU(p.ageDonateur, p.sexeDonateur, rend, taux);
  const pctNP = (100 - pctUF) / 100;
  const valNP = p.valeurBien * pctNP;
  const ab = Math.max(0, (ABATTEMENTS[p.lienParente] ?? 0) * p.nbDonateurs - p.donationAnterieure);
  const bar = bareme(p.lienParente);
  const droitsA = droits(Math.max(0, p.valeurBien - ab), bar);
  const droitsB = droits(Math.max(0, valNP - ab), bar);
  return {
    pctNP: pctNP * 100, valeurNP: valNP, abattement: ab,
    optionA: { assiette: p.valeurBien, baseTaxable: Math.max(0, p.valeurBien - ab), droits: droitsA, netTransmis: p.valeurBien - droitsA },
    optionB: { assiette: valNP, baseTaxable: Math.max(0, valNP - ab), droits: droitsB, netTransmisATerme: p.valeurBien },
    economie: droitsA - droitsB,
  };
}

/* ── Calcul usufruit successif (onglet 4) ── */
function computeSuccessif(p: {
  valeurBien: number; agePere: number; sexePere: 'H'|'F';
  ageConjoint: number; sexeConjoint: 'H'|'F'; nbEnfants: number;
  methode: 'fiscal'|'economique'; rendement?: number; tauxActualisation?: number;
}) {
  const rend = p.rendement ?? 4;
  const taux = p.tauxActualisation ?? 3;
  const pctUF1 = (p.methode === 'fiscal'
    ? fiscalPctU(p.agePere)
    : econoPctU(p.agePere, p.sexePere, rend, taux)) / 100;
  const UF1 = p.valeurBien * pctUF1;
  let UFsucc: number;
  if (p.methode === 'fiscal') {
    const pctConj = fiscalPctU(p.ageConjoint) / 100;
    UFsucc = Math.max(0, p.valeurBien * pctConj - UF1);
  } else {
    const i = taux / 100, r = rend / 100;
    const espP = esperance(p.agePere, p.sexePere);
    const espC = esperance(p.ageConjoint, p.sexeConjoint);
    const flux = p.valeurBien * r;
    UFsucc = i === 0
      ? Math.max(0, flux * (espC - espP))
      : Math.max(0, flux * (Math.pow(1+i,-espP) - Math.pow(1+i,-espC)) / i);
  }
  const NP = Math.max(0, p.valeurBien - UF1 - UFsucc);
  const partEnf = p.nbEnfants > 0 ? NP / p.nbEnfants : NP;
  const droitsEnf = droits(Math.max(0, partEnf - 100000), BAREMES_LD);
  return {
    UF1: { montant: UF1, pct: pctUF1 * 100 },
    UFsuccessif: { montant: UFsucc, pct: UFsucc / p.valeurBien * 100 },
    NP: { montant: NP, pct: NP / p.valeurBien * 100, partParEnfant: partEnf },
    fiscalite: { droitsParEnfant: droitsEnf, droitsTotaux: droitsEnf * p.nbEnfants },
  };
}

/* ── Route ── */
export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'JSON malformé.' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null)
    return Response.json({ error: 'Corps invalide.' }, { status: 400 });
  const b = body as Record<string,unknown>;
  if (b.type === 'donation') {
    const required = ['valeurBien','ageDonateur','sexeDonateur','methodeNP','lienParente','nbDonateurs','donationAnterieure'];
    for (const k of required) {
      if (b[k] === undefined) return Response.json({ error: `Champ manquant : ${k}` }, { status: 422 });
    }
    return Response.json(computeDonation(b as any));
  }
  if (b.type === 'successif') {
    const required = ['valeurBien','agePere','sexePere','ageConjoint','sexeConjoint','nbEnfants','methode'];
    for (const k of required) {
      if (b[k] === undefined) return Response.json({ error: `Champ manquant : ${k}` }, { status: 422 });
    }
    return Response.json(computeSuccessif(b as any));
  }
  return Response.json({ error: 'type doit être "donation" ou "successif".' }, { status: 422 });
}
