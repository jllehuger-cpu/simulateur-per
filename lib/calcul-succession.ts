// ─────────────────────────────────────────────────────────
//  CALCUL SUCCESSION — Droit français (Code civil)
//  Basé sur DossierPatrimonial réel, pas sur un type "Famille" fictif.
// ─────────────────────────────────────────────────────────

import type { DossierPatrimonial, RegimeMatrimonial, SituationFamiliale } from './types'

// ── Types de sortie ──────────────────────────────────────

export type LienHeritier = 'enfant' | 'conjoint' | 'parent' | 'frere_soeur'

export interface HeritierLegal {
  id: string
  label: string
  lien: LienHeritier
  partPP: number      // part en pleine propriété (%)
  partUsufruit: number  // part en usufruit (%, option conjoint)
  notes: string[]
}

export interface AnalyseSuccession {
  /** Qui est supposé décéder */
  cible: 'client' | 'conjoint'
  /** Masse successorale après liquidation du régime matrimonial */
  masseSuccessorale: number
  /** Héritiers légaux avec leurs parts */
  heritiers: HeritierLegal[]
  /** Réserve héréditaire globale (%) */
  reserve: number
  /** Quotité disponible (%) */
  quotiteDisponible: number
  /** Option usufruitière disponible pour le conjoint */
  optionUsufruit: boolean
  /** Avertissements / situations particulières */
  alertes: string[]
  /** Mapping id → montant en € */
  montantsEuros: Record<string, number>
}

// ── Utilitaires internes ─────────────────────────────────

function pct(n: number): number { return Math.round(n * 1000) / 1000 }

function reserveHereditaire(nbEnfants: number): number {
  if (nbEnfants === 1) return 50
  if (nbEnfants === 2) return pct(200 / 3)   // 66.67
  if (nbEnfants >= 3)  return 75
  return 0
}

function quotiteDisponible(nbEnfants: number): number {
  return 100 - reserveHereditaire(nbEnfants)
}

/**
 * Masse successorale après liquidation du régime matrimonial.
 * Simplifié : on suppose que tous les biens sont communs dans les régimes communautaires.
 */
function masseSucessorale(
  patrimoineTotal: number,
  regime: RegimeMatrimonial,
  situationFamiliale: SituationFamiliale,
): number {
  const aConjoint = ['marie', 'pacse', 'concubin'].includes(situationFamiliale)
  if (!aConjoint) return patrimoineTotal

  switch (regime) {
    case 'communaute_reduite_acquets':
    case 'communaute_universelle':
    case 'communaute_meubles_acquets':
    case 'pacs_indivision':
      // Liquidation : moitié revient au conjoint survivant hors succession
      return patrimoineTotal / 2
    case 'participation_acquets':
      // Simplifié : acquêts partagés à 50/50
      return patrimoineTotal / 2
    case 'separation_biens':
    case 'pacs_separation_biens':
    case 'sans_regime':
    default:
      return patrimoineTotal
  }
}

// ── Calcul principal ──────────────────────────────────────

export function analyserSuccession(
  dossier: DossierPatrimonial,
  cible: 'client' | 'conjoint',
  patrimoineManuel?: number,
): AnalyseSuccession {
  const id = dossier.identite
  const alertes: string[] = []

  // Patrimoine brut total
  const immoBrut    = dossier.biens_immo.reduce((s, b) => s + (b.valeur_venale ?? 0), 0)
  const financier   = dossier.produits_financiers.reduce((s, p) => s + (p.valeur_actuelle ?? 0), 0)
  const patrimBrut  = patrimoineManuel ?? (immoBrut + financier)

  const sf    = id.situation_familiale ?? 'celibataire'
  const regime = id.regime_matrimonial ?? 'sans_regime'
  const masse  = masseSucessorale(patrimBrut, regime, sf)
  const aConjoint = ['marie', 'pacse', 'concubin'].includes(sf)

  // Si on calcule la succession du conjoint, on inverse les rôles
  // Pour l'instant, seul le cas "décès du client" est pleinement implémenté.
  // Le cas conjoint est symétrique mais dépend des enfants non communs.
  const estClient = cible === 'client'

  // Enfants qui héritent du cible
  const enfantsDuCible = (id.enfants ?? []).filter(e =>
    estClient
      ? e.lien === 'commun' || e.lien === 'client_seul'
      : e.lien === 'commun' || e.lien === 'conjoint_seul'
  )
  const nbEnfants = enfantsDuCible.length
  const tousCommuns = nbEnfants > 0 && enfantsDuCible.every(e => e.lien === 'commun')

  // Parents du cible (ascendants vivants)
  const parentsDuCible = (id.ascendants ?? []).filter(a => {
    if (a.situation !== 'vivant') return false
    if (estClient) return a.lien === 'pere_client' || a.lien === 'mere_client' || a.lien === 'pere_adoptif_client' || a.lien === 'mere_adoptif_client'
    return a.lien === 'pere_conjoint' || a.lien === 'mere_conjoint' || a.lien === 'pere_adoptif_conjoint' || a.lien === 'mere_adoptif_conjoint'
  })
  const pereVivant = parentsDuCible.some(a => a.lien.startsWith('pere'))
  const mereVivante = parentsDuCible.some(a => a.lien.startsWith('mere'))
  const nbParents = (pereVivant ? 1 : 0) + (mereVivante ? 1 : 0)

  // Frères/sœurs du cible
  const freresSoeursDuCible = (id.freres_soeurs ?? []).filter(fs =>
    estClient ? (fs.lien ?? 'client') === 'client' : fs.lien === 'conjoint'
  )

  const heritiers: HeritierLegal[] = []
  const reserve = reserveHereditaire(nbEnfants)
  const qd      = quotiteDisponible(nbEnfants)

  // ── CAS 1 : Avec enfants ─────────────────────────────────────
  if (nbEnfants > 0) {
    const partParEnfant = pct(reserve / nbEnfants)
    enfantsDuCible.forEach((e, i) => {
      const isClientSeul   = e.lien === 'client_seul'
      const isConjointSeul = e.lien === 'conjoint_seul'
      const notes: string[] = ['Héritier réservataire']
      if (isClientSeul)   notes.push('Enfant du client uniquement')
      if (isConjointSeul) notes.push('Enfant du conjoint uniquement')
      heritiers.push({
        id: `enfant_${i}`,
        label: `Enfant ${i + 1}`,
        lien: 'enfant',
        partPP: partParEnfant,
        partUsufruit: partParEnfant,
        notes,
      })
    })

    // Conjoint survivant
    if (aConjoint && !['celibataire', 'divorce', 'veuf'].includes(sf)) {
      if (tousCommuns) {
        // Option : 1/4 PP ou 100% usufruit
        heritiers.push({
          id: 'conjoint',
          label: 'Conjoint survivant',
          lien: 'conjoint',
          partPP: 25,
          partUsufruit: 100,
          notes: [
            'Choix possible : ¼ PP ou 100% usufruit',
            '(tous enfants communs)',
          ],
        })
      } else {
        // Enfants non communs présents : seulement 1/4 PP
        heritiers.push({
          id: 'conjoint',
          label: 'Conjoint survivant',
          lien: 'conjoint',
          partPP: 25,
          partUsufruit: 0,
          notes: [
            '¼ PP (présence d\'enfants non communs)',
            'Option usufruit non disponible',
          ],
        })
        alertes.push('Enfants non communs présents : le conjoint ne peut pas opter pour l\'usufruit total.')
      }
    }

    if (sf === 'concubin') {
      alertes.push('Concubin(e) : aucun droit légal à la succession. Un testament est indispensable.')
    }
    if (sf === 'pacse') {
      alertes.push('Partenaire de PACS : droits successoraux limités. Vérifier le testament.')
    }

  // ── CAS 2 : Sans enfants ─────────────────────────────────────
  } else {
    if (aConjoint && !['celibataire', 'divorce', 'veuf'].includes(sf)) {
      if (nbParents === 2) {
        // Père ET mère en vie : chacun 1/4, conjoint 1/2
        heritiers.push({
          id: 'conjoint',
          label: 'Conjoint survivant',
          lien: 'conjoint',
          partPP: 50,
          partUsufruit: 50,
          notes: ['½ PP (deux parents du défunt vivants)'],
        })
        heritiers.push({
          id: 'pere',
          label: 'Père',
          lien: 'parent',
          partPP: 25,
          partUsufruit: 25,
          notes: ['¼ PP (droit de retour légal)'],
        })
        heritiers.push({
          id: 'mere',
          label: 'Mère',
          lien: 'parent',
          partPP: 25,
          partUsufruit: 25,
          notes: ['¼ PP (droit de retour légal)'],
        })
      } else if (nbParents === 1) {
        // Un seul parent : 1/4 ; conjoint : 3/4
        heritiers.push({
          id: 'conjoint',
          label: 'Conjoint survivant',
          lien: 'conjoint',
          partPP: 75,
          partUsufruit: 75,
          notes: ['¾ PP (un seul parent du défunt vivant)'],
        })
        if (pereVivant) heritiers.push({ id: 'pere', label: 'Père', lien: 'parent', partPP: 25, partUsufruit: 25, notes: ['¼ PP'] })
        else             heritiers.push({ id: 'mere', label: 'Mère', lien: 'parent', partPP: 25, partUsufruit: 25, notes: ['¼ PP'] })
      } else {
        // Aucun parent : conjoint hérite de tout
        heritiers.push({
          id: 'conjoint',
          label: 'Conjoint survivant',
          lien: 'conjoint',
          partPP: 100,
          partUsufruit: 100,
          notes: ['100% PP (pas d\'enfants, pas de parents vivants)'],
        })
      }
    } else {
      // Pas de conjoint (célibataire, divorcé, veuf, concubin)
      if (nbParents === 2) {
        heritiers.push({ id: 'pere',  label: 'Père',  lien: 'parent', partPP: 50, partUsufruit: 50, notes: ['½'] })
        heritiers.push({ id: 'mere',  label: 'Mère',  lien: 'parent', partPP: 50, partUsufruit: 50, notes: ['½'] })
      } else if (nbParents === 1) {
        if (pereVivant) heritiers.push({ id: 'pere', label: 'Père', lien: 'parent', partPP: 50, partUsufruit: 50, notes: ['½ (seul parent vivant)'] })
        else             heritiers.push({ id: 'mere', label: 'Mère', lien: 'parent', partPP: 50, partUsufruit: 50, notes: ['½ (seul parent vivant)'] })
        // L'autre moitié va aux frères/sœurs ou à la branche remontante
        if (freresSoeursDuCible.length > 0) {
          const partFS = pct(50 / freresSoeursDuCible.length)
          freresSoeursDuCible.forEach((fs, i) => {
            heritiers.push({
              id: `fs_${i}`,
              label: fs.alias || `F/S ${i + 1}`,
              lien: 'frere_soeur',
              partPP: partFS,
              partUsufruit: partFS,
              notes: ['Branche opposée au parent manquant'],
            })
          })
        } else {
          // Branche orpheline revient au parent vivant
          heritiers[0].partPP = 100
          heritiers[0].partUsufruit = 100
          heritiers[0].notes.push('Totalité (branche de l\'autre parent sans héritiers)')
        }
      } else if (freresSoeursDuCible.length > 0) {
        // Ni conjoint ni parents : frères/sœurs
        const partFS = pct(100 / freresSoeursDuCible.length)
        freresSoeursDuCible.forEach((fs, i) => {
          heritiers.push({
            id: `fs_${i}`,
            label: fs.alias || `F/S ${i + 1}`,
            lien: 'frere_soeur',
            partPP: partFS,
            partUsufruit: partFS,
            notes: [],
          })
        })
      } else {
        alertes.push('Aucun héritier identifié. Les biens reviendraient à l\'État (déshérence).')
      }
    }
  }

  // Alertes régime
  if (regime === 'communaute_universelle' && aConjoint) {
    alertes.push('Communauté universelle avec clause d\'attribution intégrale : le conjoint peut récupérer la totalité hors succession. La masse ci-dessus est donc indicative.')
  }
  if (sf === 'concubin') {
    alertes.push('Droits de succession entre concubins : 60 % (aucun abattement).')
  }

  // Option usufruit disponible ?
  const optionUsufruit = tousCommuns && aConjoint && nbEnfants > 0

  // Conversion en euros
  const montantsEuros: Record<string, number> = {}
  heritiers.forEach(h => {
    montantsEuros[h.id] = Math.round(masse * h.partPP / 100)
  })

  return {
    cible,
    masseSuccessorale: masse,
    heritiers,
    reserve,
    quotiteDisponible: qd,
    optionUsufruit,
    alertes,
    montantsEuros,
  }
}

// ── Description régime matrimonial ──────────────────────

export const REGIME_LABELS: Record<RegimeMatrimonial, string> = {
  communaute_reduite_acquets:  'Communauté réduite aux acquêts',
  communaute_universelle:      'Communauté universelle',
  communaute_meubles_acquets:  'Communauté de meubles et acquêts',
  separation_biens:            'Séparation de biens',
  participation_acquets:       'Participation aux acquêts',
  pacs_separation_biens:       'PACS — séparation de biens',
  pacs_indivision:             'PACS — indivision',
  sans_regime:                 'Sans régime (concubinage)',
}

export const REGIME_IMPACT: Record<RegimeMatrimonial, string> = {
  communaute_reduite_acquets:  'Biens acquis pendant le mariage partagés à 50/50 avant succession. Biens propres intégralement dans la succession.',
  communaute_universelle:      'Tous les biens (y compris antérieurs) partagés à 50/50. Clause d\'attribution intégrale fréquente → conjoint peut tout récupérer hors succession.',
  communaute_meubles_acquets:  'Meubles + acquêts communs. Biens immeubles antérieurs = propres.',
  separation_biens:            'Chacun conserve ses biens. Pas de liquidation avant succession. La totalité du patrimoine du défunt tombe dans la succession.',
  participation_acquets:       'Fonctionnement en séparation pendant le mariage, puis créance de participation liquidée au décès (≈ 50% des acquêts).',
  pacs_separation_biens:       'Séparation de biens (régime légal PACS depuis 2007). Le partenaire survivant n\'hérite que s\'il y a un testament.',
  pacs_indivision:             'Biens acquis ensemble indivisément. Part du défunt = ½ de l\'indivis tombe dans la succession.',
  sans_regime:                 'Concubinage : aucune protection légale. Pas de droit à la succession sans testament. Droits de mutation : 60%.',
}
