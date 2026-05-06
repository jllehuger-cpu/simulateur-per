import { NextRequest } from 'next/server';

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */
export type Anciennete = 'moins8ans' | 'plus8ans';
export type Situation  = 'celibataire' | 'marie_pacse';
export type TypeRachat = 'partiel' | 'total';

export interface AVInput {
  valeurContrat:    number;   // valeur actuelle du contrat
  primesVersees:    number;   // total des primes versées (capital investi)
  typeRachat:       TypeRachat;
  montantRachat:    number;   // ignoré si typeRachat === 'total'
  anciennete:       Anciennete;
  tmi:              number;   // 0 | 0.11 | 0.30 | 0.41 | 0.45
  situation:        Situation;
}

export interface AVResult {
  // --- Base imposable ---
  plusValueTotale:       number;  // valeurContrat − primesVersées
  montantRachatEffectif: number;  // rachat total = valeurContrat
  interetsBruts:         number;  // intérêts du rachat (pro-rata si partiel)
  abattement:            number;  // 0 si < 8 ans, 4 600 ou 9 200 si ≥ 8 ans
  interetsImposables:    number;  // intérêts - abattement (pour IR)
  interetsPS:            number;  // intérêts bruts (PS s'applique avant abattement)

  // --- Option PFU ---
  pfuTauxIR:      number;   // taux moyen pondéré effectif (7.5 / 12.8 %)
  pfuIR:          number;
  pfuPS:          number;
  pfuTotal:       number;
  pfuNetPercu:    number;

  // --- Option Barème IR ---
  baremeTauxIR:   number;   // TMI retenu
  baremeIR:       number;
  baremePS:       number;
  baremeTotal:    number;
  baremeNetPercu: number;

  // --- Verdict ---
  meilleureOption: 'pfu' | 'bareme' | 'egal';
  economie:        number;
}

/* ─────────────────────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────────────────────── */
const TMI_VALIDES    = new Set([0, 0.11, 0.30, 0.41, 0.45]);
const SEUIL_7_5      = 150_000;  // seuil de primes versées pour le taux 7,5 %
const TAUX_PS        = 0.172;    // prélèvements sociaux (17,2 %)
const TAUX_PFU_COURT = 0.128;    // PFU IR contrat < 8 ans
const TAUX_PFU_LONG  = 0.075;    // PFU IR contrat > 8 ans, primes ≤ 150 k€
const TAUX_PFU_HAUT  = 0.128;    // PFU IR contrat > 8 ans, primes > 150 k€
const ABATT_CELIBATAIRE = 4_600;
const ABATT_COUPLE      = 9_200;

/* ─────────────────────────────────────────────────────────────
   CALCUL PRINCIPAL
───────────────────────────────────────────────────────────── */
function computeAV(input: AVInput): AVResult {
  const { valeurContrat, primesVersees, typeRachat, anciennete, tmi, situation } = input;

  /**
   * Plus-value latente totale du contrat.
   * Peut être négative (contrat en perte) → imposable = 0 dans ce cas.
   */
  const plusValueTotale = valeurContrat - primesVersees;

  /**
   * Montant effectif du rachat.
   * Rachat total = valeur entière du contrat.
   */
  const montantRachatEffectif =
    typeRachat === 'total' ? valeurContrat : Math.min(input.montantRachat, valeurContrat);

  /**
   * Part d'intérêts dans le rachat (pro-rata).
   *
   * Rachat total   : intérêts = valeurContrat − primesVersées
   * Rachat partiel : intérêts = rachat × (plusValue / valeurContrat)
   *   → règle du Code général des impôts : Art. 125-0 A
   *   Si le contrat est en perte (plusValue ≤ 0), les intérêts sont nuls.
   */
  let interetsBruts: number;
  if (typeRachat === 'total') {
    interetsBruts = Math.max(0, plusValueTotale);
  } else {
    const ratio = valeurContrat > 0 ? Math.max(0, plusValueTotale) / valeurContrat : 0;
    interetsBruts = montantRachatEffectif * ratio;
  }

  /**
   * Abattement annuel sur les intérêts (Art. 125-0 A II CGI).
   * Applicable uniquement aux contrats de + de 8 ans.
   * 4 600 € / célibataire — 9 200 € / couple marié ou pacsé.
   * Limité aux intérêts bruts réels.
   */
  const abattementMax =
    anciennete === 'plus8ans'
      ? situation === 'marie_pacse' ? ABATT_COUPLE : ABATT_CELIBATAIRE
      : 0;
  const abattement = Math.min(abattementMax, interetsBruts);

  const interetsImposables = Math.max(0, interetsBruts - abattement);
  const interetsPS = interetsBruts; // PS s'applique sur les intérêts BRUTS (avant abattement)

  /* ── Option PFU ──────────────────────────────────────────── */

  /**
   * PFU (Prélèvement Forfaitaire Unique) — Art. 200 A CGI.
   *
   * Contrat < 8 ans :
   *   Taux IR = 12,8 % sur tous les intérêts nets d'abattement (= intérêts bruts car pas d'abattement)
   *
   * Contrat ≥ 8 ans :
   *   Taux = 7,5 % si primes versées ≤ 150 000 €
   *   Taux mixte si primes versées > 150 000 € :
   *     - fraction à 7,5 % = interêts × (150 000 / primesVersées)
   *     - fraction à 12,8 % = reste
   *
   * Dans tous les cas, PS = 17,2 % sur intérêts BRUTS.
   */
  let pfuIR: number;
  let pfuTauxIR: number;

  if (anciennete === 'moins8ans') {
    pfuIR = interetsImposables * TAUX_PFU_COURT;
    pfuTauxIR = TAUX_PFU_COURT;
  } else {
    // > 8 ans — seuil 150 k€ sur les primes versées
    if (primesVersees <= SEUIL_7_5) {
      pfuIR = interetsImposables * TAUX_PFU_LONG;
      pfuTauxIR = TAUX_PFU_LONG;
    } else {
      const ratio7_5  = SEUIL_7_5 / primesVersees;
      const fraction7_5  = interetsImposables * ratio7_5;
      const fraction12_8 = interetsImposables * (1 - ratio7_5);
      pfuIR = fraction7_5 * TAUX_PFU_LONG + fraction12_8 * TAUX_PFU_HAUT;
      // Taux moyen pondéré pour affichage
      pfuTauxIR = interetsImposables > 0 ? pfuIR / interetsImposables : TAUX_PFU_LONG;
    }
  }

  const pfuPS    = interetsPS * TAUX_PS;
  const pfuTotal = pfuIR + pfuPS;

  /* ── Option Barème IR ───────────────────────────────────── */

  /**
   * Barème progressif (Art. 13 CGI).
   * Les intérêts nets d'abattement s'ajoutent au revenu imposable.
   * On applique directement la TMI déclarée (calcul différentiel simplifié).
   * PS = 17,2 % sur intérêts BRUTS (même base que PFU).
   */
  const baremeIR     = interetsImposables * tmi;
  const baremeTauxIR = tmi;
  const baremePS     = interetsPS * TAUX_PS;
  const baremeTotal  = baremeIR + baremePS;

  /* ── Résultats nets ─────────────────────────────────────── */
  const pfuNetPercu    = montantRachatEffectif - pfuTotal;
  const baremeNetPercu = montantRachatEffectif - baremeTotal;

  const diff = pfuTotal - baremeTotal;
  const meilleureOption: 'pfu' | 'bareme' | 'egal' =
    diff > 0.005 ? 'bareme' : diff < -0.005 ? 'pfu' : 'egal';
  const economie = Math.abs(diff);

  return {
    plusValueTotale,
    montantRachatEffectif,
    interetsBruts,
    abattement,
    interetsImposables,
    interetsPS,
    pfuTauxIR, pfuIR, pfuPS, pfuTotal, pfuNetPercu,
    baremeTauxIR, baremeIR, baremePS, baremeTotal, baremeNetPercu,
    meilleureOption, economie,
  };
}

/* ─────────────────────────────────────────────────────────────
   VALIDATION
───────────────────────────────────────────────────────────── */
function validateInput(body: unknown): { data: AVInput; error?: never } | { data?: never; error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Corps JSON invalide.' };
  const b = body as Record<string, unknown>;

  for (const field of ['valeurContrat', 'primesVersees', 'montantRachat'] as const) {
    if (typeof b[field] !== 'number' || !isFinite(b[field] as number) || (b[field] as number) < 0)
      return { error: `${field} doit être un nombre fini ≥ 0.` };
  }

  if (b.typeRachat !== 'partiel' && b.typeRachat !== 'total')
    return { error: "typeRachat doit être 'partiel' ou 'total'." };

  if (b.anciennete !== 'moins8ans' && b.anciennete !== 'plus8ans')
    return { error: "anciennete doit être 'moins8ans' ou 'plus8ans'." };

  if (typeof b.tmi !== 'number' || !TMI_VALIDES.has(b.tmi))
    return { error: `tmi doit être parmi : ${[...TMI_VALIDES].join(', ')}.` };

  if (b.situation !== 'celibataire' && b.situation !== 'marie_pacse')
    return { error: "situation doit être 'celibataire' ou 'marie_pacse'." };

  const valeurContrat = b.valeurContrat as number;
  const montantRachat = b.montantRachat as number;
  if (b.typeRachat === 'partiel' && montantRachat > valeurContrat)
    return { error: 'montantRachat ne peut pas dépasser la valeur du contrat.' };

  return {
    data: {
      valeurContrat,
      primesVersees:  b.primesVersees  as number,
      typeRachat:     b.typeRachat,
      montantRachat,
      anciennete:     b.anciennete,
      tmi:            b.tmi            as number,
      situation:      b.situation,
    },
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

  return Response.json(computeAV(validation.data));
}
