import { supabase } from './supabase'
import { chiffrer, dechiffrer, getCleIdentiteSession } from './crypto'

export interface IdentiteProspect {
  alias: string
  nom: string
  prenom: string
  tel?: string
  email?: string
  notes_cgp?: string
}

export async function sauvegarderIdentite(identite: IdentiteProspect): Promise<void> {
  const cle = getCleIdentiteSession()
  if (!cle) throw new Error('Cle identite non disponible')

  const { chiffre: nomChiffre, iv: ivNom } = await chiffrer(identite.nom, cle)
  const { chiffre: prenomChiffre } = await chiffrer(identite.prenom, cle)
  const telChiffre = identite.tel ? (await chiffrer(identite.tel, cle)).chiffre : null
  const emailChiffre = identite.email ? (await chiffrer(identite.email, cle)).chiffre : null

  await supabase.from('dossiers_identite').upsert({
    alias:          identite.alias,
    nom_chiffre:    nomChiffre,
    prenom_chiffre: prenomChiffre,
    iv_identite:    ivNom,
    tel_chiffre:    telChiffre,
    email_chiffre:  emailChiffre,
    notes_cgp:      identite.notes_cgp ?? null,
    updated_at:     new Date().toISOString(),
  })
}

export async function lireIdentite(alias: string): Promise<IdentiteProspect | null> {
  const cle = getCleIdentiteSession()
  if (!cle) return null

  const { data, error } = await supabase
    .from('dossiers_identite')
    .select('*')
    .eq('alias', alias)
    .single()

  if (error || !data) return null

  try {
    const nom    = await dechiffrer(data.nom_chiffre,    data.iv_identite, cle)
    const prenom = await dechiffrer(data.prenom_chiffre, data.iv_identite, cle)
    const tel    = data.tel_chiffre
      ? await dechiffrer(data.tel_chiffre, data.iv_identite, cle) : undefined
    const email  = data.email_chiffre
      ? await dechiffrer(data.email_chiffre, data.iv_identite, cle) : undefined
    return { alias, nom, prenom, tel, email, notes_cgp: data.notes_cgp }
  } catch {
    return null
  }
}

export async function lireToutes(): Promise<Map<string, IdentiteProspect>> {
  const cle = getCleIdentiteSession()
  if (!cle) return new Map()

  const { data } = await supabase.from('dossiers_identite').select('*')
  if (!data) return new Map()

  const map = new Map<string, IdentiteProspect>()
  await Promise.all(data.map(async row => {
    try {
      const nom    = await dechiffrer(row.nom_chiffre,    row.iv_identite, cle)
      const prenom = await dechiffrer(row.prenom_chiffre, row.iv_identite, cle)
      map.set(row.alias, { alias: row.alias, nom, prenom, notes_cgp: row.notes_cgp })
    } catch {
      // Ignorer les entrées avec mauvaise clé
    }
  }))
  return map
}

export async function sauvegarderMeta(alias: string, dossier: Record<string, unknown>): Promise<void> {
  const identite = dossier.identite as Record<string, unknown> ?? {}
  const biensImmo = (dossier.biens_immo as unknown[]) ?? []
  const produits  = (dossier.produits_financiers as Record<string, unknown>[]) ?? []

  await supabase.from('dossiers_meta').upsert({
    alias,
    age_client:     identite.age_client ?? null,
    situation:      identite.situation_familiale ?? null,
    statut_pro:     identite.statut_pro_client ?? null,
    nb_enfants:     (identite.enfants as unknown[] ?? []).length,
    departement:    identite.departement ?? null,
    tmi:            (dossier.revenus as Record<string, unknown> ?? {}).tmi ?? null,
    patrimoine_net: calculerPatrimoineNet(dossier),
    profil_risque:  identite.profil_risque ?? null,
    has_immo:       biensImmo.length > 0,
    has_av:         produits.some(p => p.type === 'Assurance-Vie'),
    has_per:        produits.some(p => p.type === 'PER'),
    has_pea:        produits.some(p => p.type === 'PEA'),
    updated_at:     new Date().toISOString(),
  })
}

function calculerPatrimoineNet(dossier: Record<string, unknown>): number {
  const immo = (dossier.biens_immo as Record<string, number>[] ?? [])
    .reduce((s, b) => s + (b.valeur_venale ?? 0) - (b.crd ?? 0), 0)
  const fin = (dossier.produits_financiers as Record<string, number>[] ?? [])
    .reduce((s, p) => s + (p.valeur_actuelle ?? 0), 0)
  return immo + fin
}
