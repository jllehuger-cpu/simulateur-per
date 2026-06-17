// GET  /api/partage?token=<uuid>  → données chiffrées pour le client (sans auth)
// POST /api/partage?token=<uuid>  → enregistrer une modification client
//
// SQL requis (Supabase) :
//   ALTER TABLE partages ADD COLUMN IF NOT EXISTS snapshot_chiffre TEXT;
//   ALTER TABLE partages ADD COLUMN IF NOT EXISTS snapshot_iv TEXT;
//   ALTER TABLE partages ADD COLUMN IF NOT EXISTS token_invite VARCHAR(255) UNIQUE;
//
//   -- Permettre la lecture par token (unauthenticated)
//   CREATE POLICY "Read by token" ON partages
//     FOR SELECT USING (token_invite IS NOT NULL AND status != 'revoked');
//
//   -- Permettre l'insertion de modifications par le client (non authentifié)
//   CREATE POLICY "Client insert modification" ON modifications_client
//     FOR INSERT WITH CHECK (true);

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function makeSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
}

// ── GET : Récupérer les données du partage ────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
  }

  const supabase = await makeSupabase()
  const { data, error } = await supabase
    .from('partages')
    .select('id, dossier_alias, client_email, snapshot_chiffre, snapshot_iv, cle_partage_chiffree, iv_partage, permissions, champs_editables, status')
    .eq('token_invite', token)
    .neq('status', 'revoked')
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Partage introuvable ou révoqué' }, { status: 404 })
  }

  return NextResponse.json(data)
}

// ── POST : Enregistrer une modification client ────────────────────────────────

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
  }

  let body: { champ: string; ancienne_valeur?: string; nouvelle_valeur: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const supabase = await makeSupabase()

  // Vérifier le token et les permissions
  const { data: partage } = await supabase
    .from('partages')
    .select('id, dossier_alias, permissions, champs_editables')
    .eq('token_invite', token)
    .eq('status', 'active')
    .maybeSingle()

  if (!partage) {
    return NextResponse.json({ error: 'Token invalide ou partage inactif' }, { status: 403 })
  }

  const champsEditables = (partage.champs_editables as string[]) ?? []
  if (
    partage.permissions !== 'edit_partial' ||
    !champsEditables.includes(body.champ)
  ) {
    return NextResponse.json({ error: 'Modification non autorisée pour ce champ' }, { status: 403 })
  }

  const { error } = await supabase.from('modifications_client').insert({
    partage_id:      partage.id,
    dossier_alias:   partage.dossier_alias,
    champ_modifie:   body.champ,
    ancienne_valeur: body.ancienne_valeur ?? null,
    nouvelle_valeur: body.nouvelle_valeur,
    client_user_id:  null,
  })

  if (error) {
    return NextResponse.json({ error: 'Erreur lors de l\'enregistrement' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
