import { NextRequest } from 'next/server';

interface WizardInput {
  situationMatrimoniale: string;
  nombreEnfants: number;
  enfantsMineurs: boolean;
  enfantsNonCommuns: boolean;
  enfantHandicape: boolean;
  parentsVivants: boolean;
  objectifs: string[];
  typeClause: string;
  quotiteOption: string;
  clauseRepresentation: string;
  mentionHeritiers: string;
}

function getSituationLabel(sit: string): string {
  const labels: Record<string, string> = {
    marie_communaute: 'en régime de communauté',
    marie_separation: 'en séparation de biens',
  };
  return labels[sit] ?? '';
}

function hasObj(input: WizardInput, obj: string): boolean {
  return input.objectifs.includes(obj);
}

// "Transmettre aux enfants" sans "Protéger le conjoint" → enfants en premier bénéficiaire
function prioritizeEnfants(input: WizardInput): boolean {
  return hasObj(input, 'transmettre_enfants') && !hasObj(input, 'proteger_conjoint');
}

// "Protéger un enfant handicapé" → clause spécifique
function useHandicapClause(input: WizardInput): boolean {
  return hasObj(input, 'proteger_handicap');
}

function applyAdaptations(text: string, input: WizardInput): string {
  let out = text;

  if (input.situationMatrimoniale === 'pacse') {
    out = out.replace(/Mon conjoint/g, 'Mon partenaire de PACS');
    out = out.replace(/mon conjoint/g, 'mon partenaire de PACS');
    out = out.replace(/conjoint survivant/g, 'partenaire de PACS survivant');
  }

  if (input.situationMatrimoniale === 'celibataire' && input.nombreEnfants === 0) {
    out = out.replace(/Mon conjoint/g, 'La personne désignée par mes soins');
    out = out.replace(/mon conjoint/g, 'la personne désignée par mes soins');
  }

  if (input.enfantsMineurs) {
    out += " Si l'un des bénéficiaires est mineur au jour du versement, les fonds lui seront remis à sa majorité, sous administration légale de son représentant légal.";
  }

  return out;
}

function generateStandard(input: WizardInput) {
  // Objectif "Protéger un enfant handicapé" → clause nominative spécifique
  if (useHandicapClause(input)) {
    const simple =
      "Mon enfant [prénom] en premier lieu, à défaut mes autres enfants nés ou à naître, vivants ou représentés, par parts égales entre eux, à défaut mes héritiers.";
    const intermediaire =
      "Mon enfant [prénom] en premier lieu, désigné(e) nominativement, à défaut mes autres enfants nés ou à naître, vivants ou représentés par leurs descendants en ligne directe, par parts égales entre eux, à défaut mes héritiers légaux.";
    const complete =
      "Mon enfant [prénom], né(e) le [date] à [lieu], en premier lieu, à défaut mes autres enfants nés ou à naître, vivants ou représentés par leurs descendants en ligne directe, par parts égales entre eux. En cas de prédécès de l'un d'eux, sa part accroît celle des autres bénéficiaires de même rang, à défaut mes héritiers légaux.";
    return {
      simple: applyAdaptations(simple, input),
      intermediaire: applyAdaptations(intermediaire, input),
      complete: applyAdaptations(complete, input),
    };
  }

  // Objectif "Transmettre aux enfants" uniquement (sans "Protéger le conjoint") → enfants en premier
  if (prioritizeEnfants(input)) {
    const simple =
      "Mes enfants nés ou à naître, vivants ou représentés, par parts égales entre eux, à défaut mes héritiers.";
    const intermediaire =
      "Mes enfants nés ou à naître, vivants ou représentés par leurs descendants en ligne directe, par parts égales entre eux, à défaut mes héritiers légaux.";
    const complete =
      "Mes enfants nés ou à naître, vivants ou représentés par leurs descendants en ligne directe, par parts égales entre eux. En cas de prédécès de l'un d'eux, sa part accroît celle des autres, à défaut mes héritiers légaux.";
    return {
      simple: applyAdaptations(simple, input),
      intermediaire: applyAdaptations(intermediaire, input),
      complete: applyAdaptations(complete, input),
    };
  }

  // Défaut : conjoint en premier (objectifs "Protéger le conjoint" ou les deux, ou aucun)
  const sitLabel = getSituationLabel(input.situationMatrimoniale);
  const conjointLabel = sitLabel ? `Mon conjoint ${sitLabel}` : 'Mon conjoint';

  const simple =
    'Mon conjoint, à défaut mes enfants nés ou à naître, vivants ou représentés, par parts égales entre eux, à défaut mes héritiers.';
  const intermediaire =
    `${conjointLabel}, à défaut mes enfants nés ou à naître, vivants ou représentés, par parts égales entre eux, à défaut mes héritiers légaux.`;
  const complete =
    'Mon conjoint au jour de mon décès, à défaut mes enfants nés ou à naître, vivants ou représentés par leurs descendants en ligne directe, par parts égales entre eux, à défaut mes héritiers légaux tels que définis par le Code civil.';

  return {
    simple: applyAdaptations(simple, input),
    intermediaire: applyAdaptations(intermediaire, input),
    complete: applyAdaptations(complete, input),
  };
}

function generateDemembre(input: WizardInput) {
  const simple =
    'Mon conjoint en usufruit, mes enfants nés ou à naître en nue-propriété, par parts égales entre eux, à défaut mes héritiers.';

  const intermediaire =
    "Mon conjoint en usufruit — le capital lui sera remis à charge de quasi-usufruit (art. 587 c. civ.) —, mes enfants nés ou à naître, vivants ou représentés, en nue-propriété par parts égales entre eux, à défaut mes héritiers.";

  const complete =
    "Mon conjoint au jour de mon décès en usufruit — le capital lui sera remis à charge de quasi-usufruit conformément à l'article 587 du Code civil, avec obligation de restitution aux nus-propriétaires —, mes enfants nés ou à naître, vivants ou représentés par leurs descendants en ligne directe, en nue-propriété par parts égales entre eux. À défaut de conjoint survivant, le capital sera attribué en pleine propriété à mes enfants par parts égales, vivants ou représentés, à défaut mes héritiers légaux.";

  return {
    simple: applyAdaptations(simple, input),
    intermediaire: applyAdaptations(intermediaire, input),
    complete: applyAdaptations(complete, input),
  };
}

function generateQuotites(input: WizardInput) {
  const parts: Record<string, { conjoint: string; enfants: string }> = {
    conjoint_100: { conjoint: '100 %', enfants: '' },
    conjoint_50_enfants_50: { conjoint: '50 %', enfants: '50 %' },
    conjoint_tiers_enfants_2tiers: { conjoint: '1/3', enfants: '2/3' },
    enfants_100: { conjoint: '', enfants: '100 %' },
  };

  const p = parts[input.quotiteOption] ?? { conjoint: '[X] %', enfants: '[Y] %' };
  const X = p.conjoint || '[X] %';
  const Y = p.enfants || '[Y] %';

  const simple =
    `Mon conjoint pour ${X}, mes enfants nés ou à naître, vivants ou représentés, pour ${Y} par parts égales entre eux, à défaut mes héritiers.`;

  const intermediaire =
    `Mon conjoint pour ${X} en pleine propriété, mes enfants nés ou à naître, vivants ou représentés, pour ${Y} par parts égales entre eux, à défaut mes héritiers légaux.`;

  const complete =
    `Mon conjoint au jour de mon décès pour ${X} du capital en pleine propriété, mes enfants nés ou à naître, vivants ou représentés par leurs descendants, pour ${Y} du capital par parts égales entre eux. En cas de prédécès de l'un d'eux, sa part accroît celle des autres bénéficiaires de même rang, à défaut mes héritiers légaux.`;

  return {
    simple: applyAdaptations(simple, input),
    intermediaire: applyAdaptations(intermediaire, input),
    complete: applyAdaptations(complete, input),
  };
}

function generateConditionAge(input: WizardInput) {
  const simple =
    "Mon conjoint pour la totalité si au jour de mon décès il/elle a moins de 70 ans, pour les 3/4 entre 70 et 80 ans, pour la moitié entre 80 et 90 ans, pour le 1/4 au-delà de 90 ans. La fraction restante reviendra à mes enfants vivants ou représentés par parts égales, à défaut mes héritiers.";

  const intermediaire =
    "Mon conjoint pour la totalité si au jour de mon décès il/elle a moins de soixante-dix ans, pour les trois quarts entre soixante-dix et quatre-vingts ans, pour la moitié entre quatre-vingts et quatre-vingt-dix ans, pour le quart au-delà de quatre-vingt-dix ans. La fraction restante reviendra à mes enfants vivants ou représentés par parts égales, à défaut mes héritiers légaux.";

  const complete =
    "Mon conjoint au jour de mon décès pour la totalité du capital s'il/elle a moins de soixante-dix ans, pour les trois quarts entre soixante-dix et quatre-vingts ans, pour la moitié entre quatre-vingts et quatre-vingt-dix ans, pour le quart au-delà de quatre-vingt-dix ans. La fraction non attribuée au conjoint sera versée à mes enfants nés ou à naître, vivants ou représentés par leurs descendants, par parts égales entre eux. En cas de prédécès du conjoint, le capital sera intégralement attribué à mes enfants par parts égales entre eux, à défaut mes héritiers légaux.";

  return {
    simple: applyAdaptations(simple, input),
    intermediaire: applyAdaptations(intermediaire, input),
    complete: applyAdaptations(complete, input),
  };
}

function computePointsVigilance(input: WizardInput): string[] {
  const points: string[] = [];

  if (input.enfantsMineurs) {
    points.push("Enfants mineurs : le tuteur légal gérera le capital jusqu'à la majorité. Une clause de représentation est indispensable.");
  }
  if (input.enfantHandicape || hasObj(input, 'proteger_handicap')) {
    points.push("Enfant handicapé : ⚠️ envisagez une clause avec un trust ou une association agréée pour éviter la perte des aides sociales. Une structure spécialisée (MJPM, association habilitée) peut être désignée bénéficiaire.");
  }
  if (input.enfantsNonCommuns) {
    points.push('Famille recomposée : précisez "mes enfants issus de mon union avec [...]" pour éviter toute ambiguïté entre les enfants de lits différents.');
  }
  if (input.typeClause === 'demembre') {
    points.push("Clause démembrée : le nu-propriétaire dispose d'une créance de restitution. Une rédaction notariale est fortement conseillée.");
  }
  if (input.situationMatrimoniale === 'celibataire' && input.nombreEnfants === 0) {
    points.push("Personne seule sans enfants : désignez votre bénéficiaire avec précision (nom, prénom, date et lieu de naissance, adresse).");
  }

  // Objectifs
  if (hasObj(input, 'optimisation_fiscale')) {
    points.push("Optimisation fiscale — art. 990 I CGI : abattement de 152 500 € par bénéficiaire pour les primes versées avant 70 ans. Art. 757 B CGI : au-delà de 70 ans, seules les primes excédant 30 500 € sont soumises aux droits de succession.");
    if (input.typeClause === 'demembre') {
      points.push("Clause démembrée et fiscalité : les droits 990 I sont calculés sur la valeur en pleine propriété du capital, puis répartis entre usufruitier et nu-propriétaire selon le barème de l'art. 669 CGI.");
    }
  }
  if (hasObj(input, 'eviter_conflits')) {
    points.push("Prévention des conflits : une clause avec quotités précises et des désignations nominatives est préférable à une clause générale pour éviter toute ambiguïté entre héritiers.");
  }
  if (useHandicapClause(input)) {
    points.push("Remplacez [prénom], [date] et [lieu] par les informations exactes de l'enfant concerné avant de transmettre cette clause à votre assureur.");
  }

  points.push("La clause peut être modifiée à tout moment tant que le bénéficiaire n'a pas accepté.");
  points.push("L'art. 990 I CGI exonère jusqu'à 152 500 € par bénéficiaire pour les primes versées avant 70 ans.");

  return points;
}

function computeConseilNotaire(input: WizardInput): { needed: boolean; raison: string } {
  if (input.typeClause === 'demembre') {
    return {
      needed: true,
      raison: "La clause démembrée génère un quasi-usufruit sur le capital : sa rédaction précise est essentielle pour protéger les droits des nus-propriétaires.",
    };
  }
  if (input.enfantHandicape) {
    return {
      needed: true,
      raison: "La présence d'un enfant handicapé nécessite une structuration spécifique (tutelle, mandataire judiciaire, association habilitée).",
    };
  }
  if (input.enfantsNonCommuns) {
    return {
      needed: true,
      raison: "La situation de famille recomposée peut engendrer des conflits entre héritiers de différents lits si la clause n'est pas rédigée avec précision.",
    };
  }
  if (input.typeClause === 'condition_age') {
    return {
      needed: true,
      raison: "La clause à condition d'âge est complexe et doit être rédigée avec soin pour être juridiquement opposable à l'assureur.",
    };
  }
  return { needed: false, raison: '' };
}

export async function POST(request: NextRequest) {
  const body = await request.json() as WizardInput;

  let variants: { simple: string; intermediaire: string; complete: string };
  switch (body.typeClause) {
    case 'demembre':      variants = generateDemembre(body);      break;
    case 'quotites':      variants = generateQuotites(body);      break;
    case 'condition_age': variants = generateConditionAge(body);  break;
    default:              variants = generateStandard(body);
  }

  const points = computePointsVigilance(body);
  const { needed, raison } = computeConseilNotaire(body);

  return Response.json({
    variante_simple: variants.simple,
    variante_intermediaire: variants.intermediaire,
    variante_complete: variants.complete,
    points_vigilance: points,
    conseil_notaire: needed,
    raison_conseil_notaire: raison,
  });
}
