// ─────────────────────────────────────────────────────────
//  TYPES — Données patrimoniales ANONYMISÉES
//  Aucun nom, prénom, adresse ou identifiant direct ici.
//  Le lien alias ↔ client réel reste chez le CGP.
// ─────────────────────────────────────────────────────────

export type SituationFamiliale =
  | 'celibataire' | 'marie' | 'pacse' | 'concubin'
  | 'divorce' | 'veuf'

export type RegimeMatrimonial =
  // Mariage (5 régimes)
  | 'communaute_reduite_acquets'   // Régime légal sans contrat
  | 'communaute_universelle'       // Contrat — tous biens communs
  | 'communaute_meubles_acquets'   // Ancien régime légal avant 1966
  | 'separation_biens'             // Contrat — indépendance totale
  | 'participation_acquets'        // Contrat — hybride séparation/communauté
  // PACS (2 régimes)
  | 'pacs_separation_biens'        // Régime légal PACS depuis 2007
  | 'pacs_indivision'              // PACS avec convention d'indivision
  // Concubinage
  | 'sans_regime'                  // Pas de régime matrimonial

export type StatutPro =
  | 'salarie_cadre' | 'salarie_non_cadre' | 'tns' | 'fonctionnaire' | 'retraite' | 'sans_emploi'

export type ProfilRisque = 'prudent' | 'equilibre' | 'dynamique'

export type Horizon = 'court' | 'moyen' | 'long'

// ── Ascendant ────────────────────────────────────────────
export interface Ascendant {
  id: string
  lien: 'pere_client' | 'mere_client' | 'pere_conjoint' | 'mere_conjoint'
      | 'pere_adoptif_client' | 'mere_adoptif_client'
      | 'pere_adoptif_conjoint' | 'mere_adoptif_conjoint'
      | 'autre'
  type_adoption?: 'pleniere' | 'simple'
  age?: number
  situation: 'vivant' | 'decede'
  patrimoine_estime?: number
  dependant: boolean
  testament_connu: boolean | 'inconnu'
  donation_consentie: boolean
  mandat_protection_future?: 'oui' | 'non' | 'a_faire' | 'en_cours'
  mpf_authentique?: 'oui' | 'non' | 'inconnu'
  grand_parent_vivant?: boolean
  notes?: string
}

// ── Frère / Sœur ────────────────────────────────────────
export interface FrereSoeur {
  id: string
  alias: string
  age: number
  situation: 'valide' | 'handicape'
  type_handicap?: string
  a_enfants: boolean
  nb_enfants?: number
}

// ── Enfant ──────────────────────────────────────────────
export interface Enfant {
  id: string
  age: number
  lien: 'commun' | 'client_seul' | 'conjoint_seul'
  situation: 'mineur' | 'etudiant' | 'actif' | 'marie'
  rattachement_fiscal: 'foyer_client' | 'autonome'
}

// ── Identité (anonymisée) ────────────────────────────────
export interface Identite {
  // Pas de nom/prénom — juste les caractéristiques utiles
  age_client: number
  age_conjoint?: number
  situation_familiale: SituationFamiliale
  regime_matrimonial: RegimeMatrimonial
  statut_pro_client: StatutPro
  statut_pro_conjoint?: StatutPro
  departement: string
  proprietaire_rp: boolean
  loyer_mensuel?: number
  enfants: Enfant[]
  enfants_garde_alternee?: string[]  // IDs des enfants en garde alternée
  ascendants?: Ascendant[]
  freres_soeurs?: FrereSoeur[]
  date_union?: string                // Date mariage ou PACS (ISO)
  notes_famille?: string             // Notes libres famille
  contrat_mariage?: 'oui' | 'non'   // Contrat de mariage
  testament?: 'oui' | 'non' | 'en_cours'
  type_testament?: 'olographe' | 'authentique' | 'mystique'
  dde?: 'oui' | 'non'               // Donation entre époux
  mpf_authentique?: 'oui' | 'non' | 'inconnu'
  // Objectifs
  profil_risque: ProfilRisque
  horizon: Horizon
  capacite_epargne_mensuelle: number
  objectifs: string[]
  projet_imminent?: string
  objectifs_commentaire?: string
}

// ── Revenus ──────────────────────────────────────────────
export interface Revenus {
  // Package salarié (brut)
  salaire_base_brut_client: number
  salaire_base_brut_conjoint: number
  primes_brut_client: number
  primes_brut_conjoint: number
  epargne_salariale_brut_client: number
  epargne_salariale_brut_conjoint: number
  taux_cotisations_client: number   // default 0.22
  taux_cotisations_conjoint: number
  // Autres revenus nets
  revenus_tns_net: number
  dividendes_net: number
  revenus_fonciers_net: number
  loyers_lmnp_net: number
  rcm_net: number
  plus_values_net: number
  retraite_net: number
  autres_revenus_net: number
  // Fiscalité
  ir_paye_n1: number
  tmi: number  // 0, 11, 30, 41, 45
  nb_parts: number
  ifi_paye_n1: number
  deficit_foncier_reportable: number
  avantages_fiscaux: string
}

// ── Bien immobilier ──────────────────────────────────────
export interface BienImmo {
  id: string
  type: string
  localisation: string
  detenu_par: string
  mode_propriete: string
  quote_part: number
  valeur_venale: number
  prix_acquisition: number
  annee_acquisition: number
  crd: number
  mensualite: number
  duree_restante_mois: number
  taux: number
  assurance_emprunteur: number
  loyer_mensuel_brut: number
  taux_occupation: number
  charges_annuelles: number
  regime_fiscal: string
  dispositif_fiscal: string
  date_achat_exacte?: string
  notes?: string
}

// ── Frais de contrat ─────────────────────────────────────
export interface FraisContrat {
  // Assurance-Vie & Capitalisation
  frais_entree_pct?: number
  frais_gestion_uc_pct?: number
  frais_gestion_euro_pct?: number
  frais_arbitrage_pct?: number
  // PEA & CTO & Compte-Titres
  frais_courtage_pct?: number
  droits_garde_annuels?: number
  // PER
  frais_entree_per_pct?: number
  frais_gestion_per_pct?: number
  frais_arreage_rente_pct?: number
}

// ── Produit financier ─────────────────────────────────────
export interface LignePorfolio {
  libelle: string
  isin?: string
  categorie: string
  valeur: number
  pct_portefeuille: number
  perf_1an?: number
}

export interface ProduitFinancier {
  id: string
  type: string  // AV, PEA, CTO, PER, Livret A...
  etablissement: string
  titulaire: string
  date_ouverture: string
  valeur_actuelle: number
  versements_annuels: number
  clause_beneficiaire?: string
  montant_verse?: number    // Total primes versées depuis ouverture
  lignes: LignePorfolio[]
  frais?: FraisContrat
  notes?: string
}

// ── Prévoyance ────────────────────────────────────────────
export interface Prevoyance {
  capital_deces_client: number
  capital_deces_conjoint: number
  source_deces_client: string
  ij_client: number
  delai_carence_client: number
  maintien_salaire_client: string
  retraite_estimee_client: number
  retraite_estimee_conjoint: number
  age_depart_client: number
}

// ── Dossier complet ───────────────────────────────────────
export interface DossierPatrimonial {
  alias: string          // Ex: "Dossier_2024_047" — JAMAIS le vrai nom
  created_at: string
  updated_at: string
  identite: Partial<Identite>
  revenus: Partial<Revenus>
  biens_immo: BienImmo[]
  produits_financiers: ProduitFinancier[]
  prevoyance: Partial<Prevoyance>
  audit_result?: string  // Résultat généré par Claude
}

// ── Store local (localStorage, pas de serveur) ───────────
export const STORAGE_KEY = 'cgp_dossiers_v1'
