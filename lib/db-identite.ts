import { getSupabase } from './supabase'
import { dechiffrer, getCleIdentiteSession } from './crypto'

const supabase = getSupabase()

export interface IdentiteProspect {
  alias: string
  nom: string
  prenom: string
  tel?: string
  email?: string
  // Conjoint
  nom_conjoint?: string
  prenom_conjoint?: string
  tel_conjoint?: string
  email_conjoint?: string
  notes_cgp?: string
}

export async function sauvegarderIdentite(identite: IdentiteProspect): Promise<void> {
  const cle = getCleIdentiteSession()
  if (!cle) throw new Error('Cle identite non disponible')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  // Un seul IV partagé pour toute la ligne — garantit que tous les champs sont
  // déchiffrables avec le même iv_identite stocké.
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ivBase64 = btoa(String.fromCharCode(...iv))
  const enc = new TextEncoder()
  const encField = async (text: string): Promise<string> => {
    const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, enc.encode(text))
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
  }

  const nomChiffre    = await encField(identite.nom)
  const prenomChiffre = await encField(identite.prenom)
  const telChiffre    = identite.tel       ? await encField(identite.tel)       : null
  const emailChiffre  = identite.email     ? await encField(identite.email)     : null

  const nomConjointChiffre    = identite.nom_conjoint    ? await encField(identite.nom_conjoint)    : null
  const prenomConjointChiffre = identite.prenom_conjoint ? await encField(identite.prenom_conjoint) : null
  const telConjointChiffre    = identite.tel_conjoint    ? await encField(identite.tel_conjoint)    : null
  const emailConjointChiffre  = identite.email_conjoint  ? await encField(identite.email_conjoint)  : null

  const { error } = await supabase.from('dossiers_identite').upsert({
    alias:                    identite.alias,
    nom_chiffre:              nomChiffre,
    prenom_chiffre:           prenomChiffre,
    iv_identite:              ivBase64,
    tel_chiffre:              telChiffre,
    email_chiffre:            emailChiffre,
    nom_conjoint_chiffre:     nomConjointChiffre,
    prenom_conjoint_chiffre:  prenomConjointChiffre,
    tel_conjoint_chiffre:     telConjointChiffre,
    email_conjoint_chiffre:   emailConjointChiffre,
    notes_cgp:                identite.notes_cgp ?? null,
    updated_at:               new Date().toISOString(),
    user_id:                  user.id,
  })
  if (error) throw new Error(`sauvegarderIdentite: ${error.message}`)
}

export async function lireIdentite(alias: string): Promise<IdentiteProspect | null> {
  const cle = getCleIdentiteSession()
  if (!cle) return null

  const { data, error } = await supabase
    .from('dossiers_identite')
    .select('*')
    .eq('alias', alias)
    .maybeSingle()

  if (error || !data) return null

  try {
    const nom    = await dechiffrer(data.nom_chiffre,    data.iv_identite, cle)
    const prenom = await dechiffrer(data.prenom_chiffre, data.iv_identite, cle)
    const tel    = data.tel_chiffre
      ? await dechiffrer(data.tel_chiffre, data.iv_identite, cle) : undefined
    const email  = data.email_chiffre
      ? await dechiffrer(data.email_chiffre, data.iv_identite, cle) : undefined

    // Conjoint
    const nom_conjoint = data.nom_conjoint_chiffre
      ? await dechiffrer(data.nom_conjoint_chiffre, data.iv_identite, cle) : undefined
    const prenom_conjoint = data.prenom_conjoint_chiffre
      ? await dechiffrer(data.prenom_conjoint_chiffre, data.iv_identite, cle) : undefined
    const tel_conjoint = data.tel_conjoint_chiffre
      ? await dechiffrer(data.tel_conjoint_chiffre, data.iv_identite, cle) : undefined
    const email_conjoint = data.email_conjoint_chiffre
      ? await dechiffrer(data.email_conjoint_chiffre, data.iv_identite, cle) : undefined

    return {
      alias, nom, prenom, tel, email,
      nom_conjoint, prenom_conjoint, tel_conjoint, email_conjoint,
      notes_cgp: data.notes_cgp,
    }
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
      const nom_conjoint = row.nom_conjoint_chiffre
        ? await dechiffrer(row.nom_conjoint_chiffre, row.iv_identite, cle) : undefined
      const prenom_conjoint = row.prenom_conjoint_chiffre
        ? await dechiffrer(row.prenom_conjoint_chiffre, row.iv_identite, cle) : undefined
      map.set(row.alias, { alias: row.alias, nom, prenom, nom_conjoint, prenom_conjoint, notes_cgp: row.notes_cgp })
    } catch {
      // Ignorer les entrées avec mauvaise clé
    }
  }))
  return map
}

/**
 * Lit toutes les identités avec TOUS les champs déchiffrés, en une seule requête
 * Supabase (le nombre total de lignes ET les identités déchiffrées). Évite un
 * aller-retour réseau séparé pour le comptage (voir compterIdentites, conservé
 * pour compatibilité mais plus utilisé sur le chemin critique d'activation/Clé B).
 */
export async function lireToutesCompletesAvecTotal(): Promise<{ total: number; identites: IdentiteProspect[] }> {
  const cle = getCleIdentiteSession()
  if (!cle) return { total: 0, identites: [] }

  const { data, error } = await supabase.from('dossiers_identite').select('*')
  if (error || !data) return { total: 0, identites: [] }

  const results: IdentiteProspect[] = []
  for (const row of data) {
    try {
      const nom    = await dechiffrer(row.nom_chiffre,    row.iv_identite, cle)
      const prenom = await dechiffrer(row.prenom_chiffre, row.iv_identite, cle)
      const tel    = row.tel_chiffre    ? await dechiffrer(row.tel_chiffre,    row.iv_identite, cle) : undefined
      const email  = row.email_chiffre  ? await dechiffrer(row.email_chiffre, row.iv_identite, cle) : undefined
      const nom_conjoint    = row.nom_conjoint_chiffre    ? await dechiffrer(row.nom_conjoint_chiffre,    row.iv_identite, cle) : undefined
      const prenom_conjoint = row.prenom_conjoint_chiffre ? await dechiffrer(row.prenom_conjoint_chiffre, row.iv_identite, cle) : undefined
      const tel_conjoint    = row.tel_conjoint_chiffre    ? await dechiffrer(row.tel_conjoint_chiffre,    row.iv_identite, cle) : undefined
      const email_conjoint  = row.email_conjoint_chiffre  ? await dechiffrer(row.email_conjoint_chiffre,  row.iv_identite, cle) : undefined
      results.push({
        alias: row.alias, nom, prenom, tel, email,
        nom_conjoint, prenom_conjoint, tel_conjoint, email_conjoint,
        notes_cgp: row.notes_cgp,
      })
    } catch {
      // Clé incorrecte pour cette ligne — on l'ignore (signalé par l'appelant via le compte de retour)
    }
  }
  return { total: data.length, identites: results }
}

/** Lit toutes les identités avec TOUS les champs déchiffrés (pour re-chiffrement/migration de clé). */
export async function lireToutesCompletes(): Promise<IdentiteProspect[]> {
  return (await lireToutesCompletesAvecTotal()).identites
}

/** Compte les lignes d'identité existantes (sans déchiffrement) — utile pour valider une clé avant migration. */
export async function compterIdentites(): Promise<number> {
  const { count } = await supabase.from('dossiers_identite').select('*', { count: 'exact', head: true })
  return count ?? 0
}

/** Supprime définitivement toutes les identités chiffrées de l'utilisateur courant (désactivation Clé B). */
export async function supprimerToutesIdentites(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const { error } = await supabase.from('dossiers_identite').delete().eq('user_id', user.id)
  if (error) throw new Error(`supprimerToutesIdentites: ${error.message}`)
}

export async function sauvegarderMeta(alias: string, dossier: Record<string, unknown>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const identite = dossier.identite as Record<string, unknown> ?? {}
  const biensImmo = (dossier.biens_immo as unknown[]) ?? []
  const produits  = (dossier.produits_financiers as Record<string, unknown>[]) ?? []

  const { error: metaError } = await supabase.from('dossiers_meta').upsert({
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
    user_id:        user.id,
  })
  if (metaError) console.warn('[sauvegarderMeta]', metaError.message)
}

function calculerPatrimoineNet(dossier: Record<string, unknown>): number {
  const immo = (dossier.biens_immo as Record<string, number>[] ?? [])
    .reduce((s, b) => s + (b.valeur_venale ?? 0) - (b.crd ?? 0), 0)
  const fin = (dossier.produits_financiers as Record<string, number>[] ?? [])
    .reduce((s, p) => s + (p.valeur_actuelle ?? 0), 0)
  return immo + fin
}
