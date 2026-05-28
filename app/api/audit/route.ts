import { NextRequest } from 'next/server';

const SYSTEM_PROMPT = `Tu es un conseiller en gestion de patrimoine expert, spécialisé en droit patrimonial français.
Tu réalises un audit patrimonial complet à partir des données client fournies.

CONNAISSANCES CLÉS :

## RÉGIMES MATRIMONIAUX
- Communauté réduite aux acquêts (régime légal depuis 1966) : 3 masses (propres + communs). Acquêts pendant le mariage = communs. Biens reçus par succession/donation = propres.
- Séparation de biens : chaque époux propriétaire de ses biens. Attention acquisitions indivises.
- Communauté universelle : tous les biens communs. Clause d'attribution intégrale fréquente.
- Participation aux acquêts : séparation pendant le mariage, créance de participation à la dissolution.
- PACS : séparation de biens par défaut (depuis 2007). Option indivision possible.
- Concubinage : aucun régime légal.

## ASSURANCE-VIE — FISCALITÉ DÉCÈS
- Primes versées AVANT 70 ans : art. 990 I CGI → abattement 152 500 € par bénéficiaire, puis 20% jusqu'à 700 000 €, puis 31,25%.
- Primes versées APRÈS 70 ans : art. 757 B CGI → abattement global 30 500 € (tous bénéficiaires), puis droits de succession sur primes (hors intérêts capitalisés).
- Conjoint/partenaire PACS bénéficiaire : EXONÉRÉ (loi TEPA).
- Clause bénéficiaire démembrée : usufruit conjoint + nue-propriété enfants → pleine propriété en franchise d'impôt au décès de l'usufruitier (art. 1133 CGI).

## DÉMEMBREMENT DE PROPRIÉTÉ
- Usufruit + Nue-propriété. Barème fiscal art. 669 CGI.
- Donation nue-propriété avec réserve d'usufruit : stratégie efficace.
- Au décès de l'usufruitier : pleine propriété SANS droits.

## TRANSMISSION & DONATIONS
- Abattement ligne directe : 100 000 € par parent/enfant, renouvelable tous les 15 ans.
- Abattement petit-enfant : 31 865 €.
- Barème ligne directe : 5% à 45%.
- Donation-partage : fige les valeurs au jour de l'acte.

## PER
- Versements déductibles du revenu imposable (limite 10% revenus, plafond).
- Économie fiscale = versement × TMI.
- Stratégie : maximiser quand TMI élevée.

## SOCIÉTÉS CIVILES
- SCI familiale : gestion et transmission immobilier. Transmission progressive par donation de parts, décote minorité (~10-15%).

## INDIVISION
- Risques : blocage, obligation de partage.
- Alternative : SCI pour structurer.

INSTRUCTIONS DE RÉDACTION :
Structure ta réponse EXACTEMENT avec ces balises XML :

<bilan_civil>
Analyse situation familiale, régime matrimonial et implications, protection conjoint et enfants, situation successorale. Identifie zones de risque.
</bilan_civil>

<bilan_fiscal>
Analyse pression fiscale (IR, TMI), leviers d'optimisation (PER, AV, donation), plafond PER. Calcule économies potentielles.
</bilan_fiscal>

<bilan_financier>
Analyse allocation patrimoniale (immobilier vs financier vs liquidités), diversification, rendements, couverture retraite. Identifie déséquilibres.
</bilan_financier>

<zones_risque>
Liste risques : sous-protection conjoint, concentration, liquidités insuffisantes, fiscalité non optimisée, absence transmission anticipée, etc.
</zones_risque>

<recommandations>
Préconisations civiles, fiscales et financières concrètes, chiffrées. Priorise par urgence et impact.
</recommandations>

Sois précis, technique mais accessible. Utilise les données chiffrées du client. N'invente rien.`;

function extractSection(text: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : '';
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY non configurée.' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON malformé.' }, { status: 400 });
  }

  const { clientData } = body as { clientData?: unknown };
  if (!clientData) {
    return Response.json({ error: 'clientData manquant.' }, { status: 422 });
  }

  const userMessage = `Voici les données du client pour l'audit patrimonial :\n\n${JSON.stringify(clientData, null, 2)}\n\nRéalise l'audit complet en suivant exactement le format demandé avec les balises XML.`;

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
  } catch (err) {
    return Response.json({ error: `Erreur réseau : ${String(err)}` }, { status: 502 });
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => '');
    return Response.json({ error: `Anthropic error ${anthropicRes.status}: ${errText}` }, { status: 502 });
  }

  const data = await anthropicRes.json() as { content?: Array<{ type: string; text?: string }> };
  const raw = data.content?.find((b) => b.type === 'text')?.text ?? '';

  return Response.json({
    success: true,
    sections: {
      bilan_civil:      extractSection(raw, 'bilan_civil'),
      bilan_fiscal:     extractSection(raw, 'bilan_fiscal'),
      bilan_financier:  extractSection(raw, 'bilan_financier'),
      zones_risque:     extractSection(raw, 'zones_risque'),
      recommandations:  extractSection(raw, 'recommandations'),
      raw,
    },
  });
}
