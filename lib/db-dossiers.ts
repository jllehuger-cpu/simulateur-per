// CRUD Supabase — persistance longue durée (en complément du localStorage)
//
// Schéma SQL à créer dans le dashboard Supabase :
// CREATE TABLE dossiers (
//   alias        TEXT PRIMARY KEY,
//   created_at   TIMESTAMPTZ DEFAULT now(),
//   updated_at   TIMESTAMPTZ DEFAULT now(),
//   data_chiffre TEXT NOT NULL,   -- JSON chiffré AES-256-GCM côté client
//   iv           TEXT NOT NULL,   -- Vecteur d'initialisation (base64)
//   audit_result TEXT,            -- Résultat audit en clair (pas de données perso)
//   has_audit    BOOLEAN DEFAULT false
// );

import { getSupabase } from './supabase'

const supabase = getSupabase()

export async function sauvegarderDossierDB(
  alias: string,
  dataChiffre: string,
  iv: string,
  auditResult?: string,
  label?: string,
  resumeAuto?: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  await supabase.from('dossiers').upsert({
    alias,
    data_chiffre: dataChiffre,
    iv,
    audit_result: auditResult ?? null,
    has_audit: !!auditResult,
    label: label ?? null,
    resume_auto: resumeAuto ?? null,
    updated_at: new Date().toISOString(),
    user_id: user.id,
  })
}

export async function listerDossiersDB(): Promise<{ alias: string; updated_at: string; has_audit: boolean }[]> {
  const { data, error } = await supabase
    .from('dossiers')
    .select('alias, updated_at, has_audit')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getDossierDB(
  alias: string
): Promise<{ data_chiffre: string; iv: string; audit_result?: string } | null> {
  const { data, error } = await supabase
    .from('dossiers')
    .select('data_chiffre, iv, audit_result')
    .eq('alias', alias)
    .single()
  if (error) return null
  return data as { data_chiffre: string; iv: string; audit_result?: string }
}

export async function supprimerDossierDB(alias: string): Promise<void> {
  await supabase.from('dossiers').delete().eq('alias', alias)
}
