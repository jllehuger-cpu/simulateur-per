import { getCleSession, deriverCleDossier, chiffrer, dechiffrer } from './crypto'
import { sauvegarderDossierDB } from './db-dossiers'
import { STORAGE_KEY } from './types'
import type { DossierPatrimonial } from './types'

const MIGRATION_KEY = 'cles_derivees_migre_v1'

export function migrationNecessaire(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(MIGRATION_KEY) !== 'done'
}

/**
 * Migre tous les dossiers : déchiffre avec l'ancienne clé unique,
 * re-chiffre avec la clé dérivée par dossier.
 * Tourne UNE SEULE FOIS — flag MIGRATION_KEY en localStorage.
 */
export async function migrerVersClesDerivees(): Promise<{ migres: number; erreurs: number }> {
  const cleMaitre = getCleSession()
  if (!cleMaitre) throw new Error('Session verrouillée')

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    localStorage.setItem(MIGRATION_KEY, 'done')
    return { migres: 0, erreurs: 0 }
  }

  const entries = JSON.parse(raw) as { alias: string; chiffre: string; iv: string }[]
  let migres = 0
  let erreurs = 0

  const newEntries: { alias: string; chiffre: string; iv: string }[] = []

  for (const entry of entries) {
    try {
      // Déchiffrer avec l'ancienne clé maître directe
      const json = await dechiffrer(entry.chiffre, entry.iv, cleMaitre)
      const dossier = JSON.parse(json) as DossierPatrimonial

      // Re-chiffrer avec la clé dérivée pour ce dossier
      const cleDossier = await deriverCleDossier(cleMaitre, entry.alias)
      const { chiffre, iv } = await chiffrer(json, cleDossier)

      newEntries.push({ alias: entry.alias, chiffre, iv })

      try {
        await sauvegarderDossierDB(entry.alias, chiffre, iv, dossier.audit_result)
      } catch {
        console.warn(`[MIGRATION] Erreur sync Supabase pour ${entry.alias}`)
      }

      migres++
    } catch (err) {
      console.error(`[MIGRATION] Erreur migration ${entry.alias}:`, err)
      erreurs++
      newEntries.push(entry)
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries))

  if (erreurs === 0) {
    localStorage.setItem(MIGRATION_KEY, 'done')
  }

  console.log(`[MIGRATION] ${migres} dossier(s) migré(s), ${erreurs} erreur(s)`)
  return { migres, erreurs }
}
