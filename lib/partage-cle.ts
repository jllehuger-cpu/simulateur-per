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
  const cleMaitre = getCleSession()
  if (!cleMaitre) throw new Error('Session non déverrouillée — Clé A requise')

  // 1. Dériver la clé du dossier à partir de la Clé A
  const cleDossier = await deriverCleDossier(cleMaitre, params.dossierAlias)

  // 2. Générer la phrase de partage mémorisable (3 mots)
  const phrase = await genererPhrasePartage(cleDossier)

  // 3. Dériver une clé AES depuis la phrase (côté client, même opération)
  const clePhrase = await phraseVersCleDossier(phrase)

  // 4. Re-chiffrer la clé dossier brute avec la clé phrase
  //    → permet au client de récupérer la clé exacte sans la Clé A
  const rawBytes = new Uint8Array(await exporterCle(cleDossier))
  const b64Key   = btoa(String.fromCharCode(...rawBytes))
  const { chiffre: cle_partage_chiffree, iv: iv_partage } = await chiffrer(b64Key, clePhrase)

  // 5. Créer un snapshot du dossier chiffré avec la clé phrase
  //    → permet une consultation hors-ligne sans Clé A
  const dossier = await getDossier(params.dossierAlias)
  if (!dossier) throw new Error(`Dossier ${params.dossierAlias} introuvable`)
  const snapshotJson = JSON.stringify(dossier)
  const { chiffre: snapshot_chiffre, iv: snapshot_iv } = await chiffrer(snapshotJson, clePhrase)

  // 6. Générer le token d'invitation (UUID)
  const token = crypto.randomUUID()

  // 7. Persister en Supabase
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

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

  if (error) throw error

  const url = (typeof window !== 'undefined' ? window.location.origin : '') +
              `/client/${params.dossierAlias}?token=${token}`

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
