// ─────────────────────────────────────────────────────────
//  PARTAGE CLÉ C — Chiffrement pour accès client
//  Flux : Clé A → cleDossier → phrase 3 mots → snapshot re-chiffré
//  La phrase est partagée avec le client (hors bande).
//  Elle ne transite jamais sur le réseau.
// ─────────────────────────────────────────────────────────

import {
  getCleSession,
  deriverCleDossier,
  genererPhrasePartage,
  phraseVersCleDossier,
  exporterCle,
  chiffrer,
  dechiffrer,
  importerCle,
} from './crypto'
import { getDossier } from './dossiers'
import { getSupabase } from './supabase'
import type { Partage, DossierPatrimonial, PartagePermission } from './types'

// Champs que le client peut modifier par défaut (mode edit_partial)
export const CHAMPS_EDITABLES_DEFAUT = [
  'identite.objectifs',
  'identite.objectifs_commentaire',
  'identite.notes_famille',
  'identite.projet_imminent',
]

export const CHAMPS_EDITABLES_OPTIONS: { value: string; label: string }[] = [
  { value: 'identite.objectifs',            label: 'Objectifs de placement' },
  { value: 'identite.objectifs_commentaire', label: 'Commentaire objectifs' },
  { value: 'identite.notes_famille',        label: 'Notes famille' },
  { value: 'identite.projet_imminent',      label: 'Projet imminent' },
]

export interface ResultatPartage {
  partageId: string
  phrase: string      // 3 mots à transmettre au client (hors bande)
  token: string       // UUID dans l'URL
  url: string         // Lien complet à envoyer au client
}

// ── Création d'un partage (côté CGP, session déverrouillée) ──────────────────

export async function creerPartageComplet(params: {
  dossierAlias: string
  clientEmail: string
  permissions: PartagePermission
  champsEditables?: string[]
}): Promise<ResultatPartage> {
  console.log('[PARTAGE] 1/7 — Vérification de la session...')
  const cleMaitre = getCleSession()
  if (!cleMaitre) {
    console.warn('[PARTAGE] ❌ Session non déverrouillée — clé absente')
    throw new Error('Session non déverrouillée')
  }
  console.log('[PARTAGE] ✓ Clé de session présente (valeur masquée : ***)')

  let phrase: string
  let cle_partage_chiffree: string
  let iv_partage: string
  let snapshot_chiffre: string
  let snapshot_iv: string

  try {
    // 1. Dériver la clé du dossier à partir de la Clé A
    console.log('[PARTAGE] 2/7 — Dérivation de la clé dossier...')
    const cleDossier = await deriverCleDossier(cleMaitre, params.dossierAlias)

    // 2. Générer la phrase de partage mémorisable (3 mots)
    console.log('[PARTAGE] 3/7 — Génération de la phrase de partage...')
    phrase = await genererPhrasePartage(cleDossier)
    console.log('[PARTAGE] ✓ Phrase générée (masquée, 3 mots)')

    // 3. Dériver une clé AES depuis la phrase (côté client, même opération)
    console.log('[PARTAGE] 4/7 — Dérivation de la clé depuis la phrase...')
    const clePhrase = await phraseVersCleDossier(phrase)

    // 4. Re-chiffrer la clé dossier brute avec la clé phrase
    //    → permet au client de récupérer la clé exacte sans la Clé A
    console.log('[PARTAGE] 5/7 — Rechiffrement de la clé dossier...')
    const rawBytes = new Uint8Array(await exporterCle(cleDossier))
    const b64Key   = btoa(String.fromCharCode(...rawBytes))
    const cleChiffree = await chiffrer(b64Key, clePhrase)
    cle_partage_chiffree = cleChiffree.chiffre
    iv_partage            = cleChiffree.iv

    // 5. Créer un snapshot du dossier chiffré avec la clé phrase
    //    → permet une consultation hors-ligne sans Clé A
    console.log('[PARTAGE] 6/7 — Chiffrement du snapshot dossier...')
    const dossier = await getDossier(params.dossierAlias)
    if (!dossier) throw new Error(`Dossier ${params.dossierAlias} introuvable`)
    const snapshotJson = JSON.stringify(dossier)
    const snapshotChiffre = await chiffrer(snapshotJson, clePhrase)
    snapshot_chiffre = snapshotChiffre.chiffre
    snapshot_iv       = snapshotChiffre.iv

    console.log('[PARTAGE] ✅ Chiffrement réussi')
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[PARTAGE] ❌ Erreur chiffrement:', message)
    throw new Error(`Erreur chiffrement: ${message}`)
  }

  const supabase = getSupabase()

  // 6. Révoquer les anciens partages actifs pour ce client/dossier
  console.log('[PARTAGE] Recherche de partages existants...')
  const { data: existingShares, error: searchError } = await supabase
    .from('partages')
    .select('id, status')
    .eq('dossier_alias', params.dossierAlias)
    .eq('client_email', params.clientEmail)

  if (searchError) {
    console.error('[PARTAGE] Erreur recherche partages:', searchError)
    throw new Error('Impossible de vérifier les partages existants')
  }

  if (existingShares && existingShares.length > 0) {
    const activeShares = existingShares.filter(s => s.status !== 'revoked')

    if (activeShares.length > 0) {
      console.log('[PARTAGE] Révocation de', activeShares.length, 'ancien(s) partage(s)')

      const { error: revokeError } = await supabase
        .from('partages')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .in('id', activeShares.map(s => s.id))

      if (revokeError) {
        console.error('[PARTAGE] Erreur révocation:', revokeError)
        throw new Error('Impossible de révoquer l\'ancien partage')
      }

      console.log('[PARTAGE] ✅ Ancien(s) partage(s) révoqué(s)')
    }
  }

  // 7. Générer le token d'invitation (UUID)
  const token = crypto.randomUUID()

  // 8. Persister en Supabase
  console.log('[PARTAGE] 7/7 — Persistance Supabase...')
  const { data: { user } } = await supabase.auth.getUser()
  console.log('[PARTAGE] User actuel:', user)
  if (!user) {
    console.error('[PARTAGE] ❌ Erreur Supabase: utilisateur non authentifié')
    throw new Error('Erreur Supabase: Non authentifié')
  }
  console.log('[PARTAGE] cgp_user_id à insérer:', user.id)

  const { data, error } = await supabase
    .from('partages')
    .insert({
      dossier_alias:        params.dossierAlias,
      cgp_user_id:          user.id,
      client_email:         params.clientEmail,
      cle_partage_chiffree,
      iv_partage,
      snapshot_chiffre,
      snapshot_iv,
      permissions:          params.permissions,
      champs_editables:     params.champsEditables ?? CHAMPS_EDITABLES_DEFAUT,
      status:               'pending',
      token_invite:         token,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[PARTAGE] ❌ Erreur Supabase:', error.message)
    throw new Error(`Erreur Supabase: ${error.message}`)
  }

  console.log('[PARTAGE] ✅ Partage créé en DB — id:', data.id, '· token:', token)

  const url = (typeof window !== 'undefined' ? window.location.origin : '') +
              `/client/${params.dossierAlias}?token=${token}`

  // 8. Envoyer l'email d'invitation au client — réellement best-effort : non bloquant,
  //    pour qu'un Resend/réseau lent ne retarde jamais le retour du résultat au CGP
  //    (le partage est déjà créé en base à ce stade, c'est ce qui compte).
  void (async () => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('nom')
        .eq('id', user.id)
        .single()
      const cgpName = profile?.nom || user.email || 'Votre conseiller'

      const res = await fetch('/api/partage/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientEmail: params.clientEmail, url, alias: params.dossierAlias, cgpName }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur serveur')
      console.log('[PARTAGE] ✅ Email d\'invitation envoyé à', params.clientEmail)
    } catch (e) {
      console.error('[PARTAGE] ⚠️ Échec envoi email (partage créé malgré tout):', e instanceof Error ? e.message : e)
    }
  })()

  return { partageId: data.id, phrase, token, url }
}

// ── Déchiffrement côté client ────────────────────────────────────────────────

export async function dechiffrerSnapshotClient(
  snapshotChiffre: string,
  snapshotIv: string,
  phrase: string
): Promise<DossierPatrimonial> {
  const clePhrase = await phraseVersCleDossier(phrase)
  const json = await dechiffrer(snapshotChiffre, snapshotIv, clePhrase)
  return JSON.parse(json) as DossierPatrimonial
}

// Pour accès lecture/écriture après avoir la clé dossier via cle_partage_chiffree
export async function restaurerCleDossier(
  clePartageChiffree: string,
  ivPartage: string,
  phrase: string
): Promise<CryptoKey> {
  const clePhrase = await phraseVersCleDossier(phrase)
  const b64Key    = await dechiffrer(clePartageChiffree, ivPartage, clePhrase)
  const rawBytes  = Uint8Array.from(atob(b64Key), c => c.charCodeAt(0))
  return importerCle(rawBytes.buffer as ArrayBuffer)
}

// ── Helpers permission ───────────────────────────────────────────────────────

export function verifierPermissionChamp(partage: Partage, champ: string): boolean {
  if (partage.permissions === 'read_full') return true
  return (partage.champs_editables ?? []).includes(champ)
}

export function verifierPermissionEdition(partage: Partage, champ: string): boolean {
  return partage.permissions === 'edit_partial' &&
         (partage.champs_editables ?? []).includes(champ)
}
