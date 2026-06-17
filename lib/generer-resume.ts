import type { DossierPatrimonial, SituationFamiliale } from './types'

const SITUATION_LABEL: Record<SituationFamiliale, string> = {
  celibataire: 'Célibataire',
  marie:       'Marié(e)',
  pacse:       'Pacsé(e)',
  concubin:    'En concubinage',
  divorce:     'Divorcé(e)',
  veuf:        'Veuf/Veuve',
}

export function genererResumeAuto(dossier: DossierPatrimonial): string {
  const parties: string[] = []
  const id = dossier.identite

  // 1. Situation + âge
  if (id.age_client) {
    const sit = id.situation_familiale ? SITUATION_LABEL[id.situation_familiale] : null
    parties.push(sit ? `${sit}, ${id.age_client} ans` : `${id.age_client} ans`)
  }

  // 2. Enfants
  const nbEnfants = (id.enfants ?? []).length
  if (nbEnfants > 0) {
    parties.push(`${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''}`)
  }

  // 3. Immobilier
  const nbBiens = dossier.biens_immo.length
  if (nbBiens > 0) {
    parties.push(`${nbBiens} bien${nbBiens > 1 ? 's' : ''} immo`)
  }

  // 4. Patrimoine net (immo net + financier)
  const patrimoineNet =
    dossier.biens_immo.reduce((s, b) => s + (b.valeur_venale ?? 0) - (b.crd ?? 0), 0) +
    dossier.produits_financiers.reduce((s, p) => s + (p.valeur_actuelle ?? 0), 0)

  if (patrimoineNet > 0) {
    parties.push(
      new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
        .format(patrimoineNet)
    )
  }

  return parties.join(' · ')
}

export function emojiSituation(dossier: DossierPatrimonial): string {
  const sit     = dossier.identite.situation_familiale
  const enfants = (dossier.identite.enfants ?? []).length
  if (sit === 'marie')   return enfants > 0 ? '👨‍👩‍👧' : '👫'
  if (sit === 'pacse')   return '💑'
  if (sit === 'concubin') return '💑'
  return '👤'
}
