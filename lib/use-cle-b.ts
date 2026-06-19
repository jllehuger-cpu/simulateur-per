'use client'

import { useState, useCallback } from 'react'
import { deriverCle, setCleIdentiteSession, clearCleIdentiteSession, identiteDisponible } from './crypto'
import { lireToutesCompletes, compterIdentites, supprimerToutesIdentites, sauvegarderIdentite } from './db-identite'

// La Clé B (identité) n'est jamais stockée — comme la Clé A, elle n'existe qu'en
// mémoire navigateur pour la session en cours. "Active" signifie donc "dérivée et
// chargée dans cet onglet", pas un état persistant côté serveur.

const TIMEOUT_MS = 15_000

function avecTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout (${label}) — Supabase n'a pas répondu après ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
    ),
  ])
}

export function useCleB() {
  const [active,  setActive]  = useState(identiteDisponible())
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const activer = useCallback(async (motDePasse: string) => {
    console.log('[CLÉ B] activer() — tentative')
    setLoading(true); setError('')
    try {
      console.log('[CLÉ B] Dérivation de la clé...')
      const cle = await deriverCle(motDePasse + '_identite')
      console.log('[CLÉ B] ✅ Clé dérivée')
      setCleIdentiteSession(cle)

      console.log('[CLÉ B] Comptage des identités existantes (Supabase)...')
      const total = await avecTimeout(compterIdentites(), 'compterIdentites')
      console.log('[CLÉ B] Total identités existantes:', total)

      if (total > 0) {
        console.log('[CLÉ B] Vérification de la clé par déchiffrement...')
        const dechiffrees = await avecTimeout(lireToutesCompletes(), 'lireToutesCompletes')
        console.log('[CLÉ B] Identités déchiffrées avec succès:', dechiffrees.length)
        if (dechiffrees.length === 0) {
          clearCleIdentiteSession()
          throw new Error('Clé incorrecte')
        }
      }

      setActive(true)
      console.log('[CLÉ B] ✅ Activation réussie')
      return true
    } catch (e) {
      console.error('[CLÉ B] ❌ Erreur activation:', e)
      setError(e instanceof Error ? e.message : 'Erreur serveur')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const modifier = useCallback(async (ancienMotDePasse: string, nouveauMotDePasse: string) => {
    console.log('[CLÉ B] modifier() — tentative')
    setLoading(true); setError('')
    try {
      const ancienneCle = await deriverCle(ancienMotDePasse + '_identite')
      setCleIdentiteSession(ancienneCle)

      console.log('[CLÉ B] Lecture des identités avec l\'ancienne clé...')
      const total = await avecTimeout(compterIdentites(), 'compterIdentites')
      const identites = await avecTimeout(lireToutesCompletes(), 'lireToutesCompletes')
      console.log('[CLÉ B] Identités lisibles:', identites.length, '/ total:', total)
      if (total > 0 && identites.length === 0) {
        throw new Error('Clé incorrecte')
      }

      console.log('[CLÉ B] Re-chiffrement avec la nouvelle clé...')
      const nouvelleCle = await deriverCle(nouveauMotDePasse + '_identite')
      setCleIdentiteSession(nouvelleCle)

      for (const identite of identites) {
        await avecTimeout(sauvegarderIdentite(identite), `sauvegarderIdentite(${identite.alias})`)
      }

      setActive(true)
      console.log('[CLÉ B] ✅ Modification réussie —', identites.length, 'identité(s) re-chiffrée(s)')
      return true
    } catch (e) {
      console.error('[CLÉ B] ❌ Erreur modification:', e)
      setError(e instanceof Error ? e.message : 'Erreur serveur')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const desactiver = useCallback(async () => {
    console.log('[CLÉ B] desactiver() — tentative')
    setLoading(true); setError('')
    try {
      await avecTimeout(supprimerToutesIdentites(), 'supprimerToutesIdentites')
      clearCleIdentiteSession()
      setActive(false)
      console.log('[CLÉ B] ✅ Désactivation réussie')
      return true
    } catch (e) {
      console.error('[CLÉ B] ❌ Erreur désactivation:', e)
      setError(e instanceof Error ? e.message : 'Erreur serveur')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return { active, loading, error, setError, activer, modifier, desactiver }
}
