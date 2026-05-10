import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY;
  return Response.json({
    present: !!key,
    length: key?.length ?? 0,
    prefix: key ? key.slice(0, 10) + '…' : null,
  });
}

const SYSTEM_PROMPT = `Tu es un expert en droit des assurances et droit patrimonial français. Tu rédiges des clauses bénéficiaires d'assurance vie précises, juridiquement correctes et personnalisées.

Les 3 variantes doivent être progressivement plus détaillées :
- variante_simple : clause courte et lisible, formulation basique mais juridiquement valide (2-3 lignes)
- variante_intermediaire : clause avec représentation par souche, mention de l'acceptation et ordre de substitution (4-6 lignes)
- variante_complete : clause complète avec toutes les mentions recommandées — représentation, souche, acceptation, ordre de substitution, identification précise, mention TEPA si applicable (8-12 lignes)

Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, avec exactement ce format :
{
  "variante_simple": "texte de la clause",
  "variante_intermediaire": "texte de la clause",
  "variante_complete": "texte de la clause",
  "points_vigilance": ["point 1", "point 2", "point 3"],
  "conseil_notaire": true,
  "raison_conseil_notaire": "raison principale si conseil_notaire est true, sinon chaîne vide"
}`;

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

const LABELS_SITUATION: Record<string, string> = {
  celibataire: 'Célibataire',
  marie_communaute: 'Marié(e) en régime de communauté',
  marie_separation: 'Marié(e) en séparation de biens',
  pacse: 'Pacsé(e)',
  divorce: 'Divorcé(e)',
  veuf: 'Veuf / Veuve',
};

const LABELS_OBJECTIF: Record<string, string> = {
  proteger_conjoint: 'Protéger le conjoint / partenaire',
  transmettre_enfants: 'Transmettre aux enfants',
  reduire_droits: 'Réduire les droits de succession',
  proteger_handicap: 'Protéger un enfant handicapé',
  eviter_conflits: 'Prévenir les conflits familiaux',
  optimisation_fiscale: 'Optimisation fiscale',
};

const LABELS_TYPE_CLAUSE: Record<string, string> = {
  standard: 'Standard (désignation par lien de parenté)',
  quotites: 'Avec quotités (répartition en %)',
  demembre: 'Démembrée (quasi-usufruit / nue-propriété)',
  condition_age: "À condition d'âge",
};

const LABELS_QUOTITE: Record<string, string> = {
  conjoint_100: 'Conjoint 100 %',
  conjoint_50_enfants_50: 'Conjoint 50 %, Enfants 50 %',
  conjoint_tiers_enfants_2tiers: 'Conjoint 1/3, Enfants 2/3',
  enfants_100: 'Enfants 100 % par parts égales',
};

function buildPrompt(body: WizardInput): string {
  const lines: string[] = [
    "Situation de l'assuré :",
    `- Situation matrimoniale : ${LABELS_SITUATION[body.situationMatrimoniale] ?? body.situationMatrimoniale}`,
    `- Nombre d'enfants : ${body.nombreEnfants}`,
  ];

  if (body.nombreEnfants > 0) {
    lines.push(`- Enfants mineurs : ${body.enfantsMineurs ? 'oui' : 'non'}`);
    lines.push(`- Famille recomposée (enfants non communs) : ${body.enfantsNonCommuns ? 'oui' : 'non'}`);
    lines.push(`- Enfant(s) handicapé(s) : ${body.enfantHandicape ? 'oui' : 'non'}`);
  }

  lines.push(`- Parents vivants : ${body.parentsVivants ? 'oui' : 'non'}`);
  lines.push('');
  lines.push(`Objectifs : ${body.objectifs.map(o => LABELS_OBJECTIF[o] ?? o).join(', ') || 'non précisés'}`);
  lines.push('');
  lines.push(`Type de clause : ${LABELS_TYPE_CLAUSE[body.typeClause] ?? body.typeClause}`);

  if (body.quotiteOption) {
    lines.push(`Quotités souhaitées : ${LABELS_QUOTITE[body.quotiteOption] ?? body.quotiteOption}`);
  }

  lines.push(`Clause de représentation par souche : ${body.clauseRepresentation}`);
  lines.push(`Mention de renvoi aux héritiers légaux en dernier rang : ${body.mentionHeritiers}`);
  lines.push('');
  lines.push("Rédige 3 variantes de clause bénéficiaire parfaitement adaptées à cette situation.");

  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY manquante — configurez-la dans les variables d\'environnement Vercel.' },
      { status: 500 },
    );
  }

  try {
    const body = await request.json() as WizardInput;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(body) }],
    });

    const text = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Erreur inconnue.' },
      { status: 500 },
    );
  }
}
