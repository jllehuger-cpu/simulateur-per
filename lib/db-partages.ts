import { getSupabase } from './supabase'
import type { Partage, ModificationClient, PartageStatus } from './types'

const supabase = getSupabase()

// ── Partages ──────────────────────────────────────────────

export async function creerPartage(params: {
  dossier_alias: string
  client_email: string
  cle_partage_chiffree: string
  iv_partage: string
  permissions?: Partage['permissions']
  champs_editables?: string[]
}): Promise<Partage> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data, error } = await supabase
    .from('partages')
    .insert({
      dossier_alias: params.dossier_alias,
      cgp_user_id: user.id,
      client_email: params.client_email,
      cle_partage_chiffree: params.cle_partage_chiffree,
      iv_partage: params.iv_partage,
      permissions: params.permissions ?? 'read_partial',
      champs_editables: params.champs_editables ?? ['produits_financiers'],
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw error
  return data as Partage
}

export async function listerPartagesCGP(dossier_alias?: string): Promise<Partage[]> {
  let query = supabase.from('partages').select('*').order('created_at', { ascending: false })
  if (dossier_alias) query = query.eq('dossier_alias', dossier_alias)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Partage[]
}

export async function listerPartagesClient(): Promise<Partage[]> {
  const { data, error } = await supabase
    .from('partages')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Partage[]
}

export async function mettreAJourStatusPartage(id: string, status: PartageStatus): Promise<void> {
  const { error } = await supabase
    .from('partages')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function lierClientAuPartage(id: string, client_user_id: string): Promise<void> {
  const { error } = await supabase
    .from('partages')
    .update({ client_user_id, status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function revoquerPartage(id: string): Promise<void> {
  return mettreAJourStatusPartage(id, 'revoked')
}

// ── Modifications client ──────────────────────────────────

export async function enregistrerModificationClient(params: {
  partage_id: string
  dossier_alias: string
  champ_modifie: string
  ancienne_valeur?: string
  nouvelle_valeur: string
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { error } = await supabase.from('modifications_client').insert({
    partage_id: params.partage_id,
    dossier_alias: params.dossier_alias,
    champ_modifie: params.champ_modifie,
    ancienne_valeur: params.ancienne_valeur ?? null,
    nouvelle_valeur: params.nouvelle_valeur,
    client_user_id: user.id,
  })
  if (error) throw error
}

export async function listerModificationsClient(partage_id: string): Promise<ModificationClient[]> {
  const { data, error } = await supabase
    .from('modifications_client')
    .select('*')
    .eq('partage_id', partage_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ModificationClient[]
}
