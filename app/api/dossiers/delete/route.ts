import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { alias?: string }
    const alias = body.alias?.trim()

    if (!alias) {
      return NextResponse.json({ error: 'alias manquant' }, { status: 400 })
    }

    const cookieStore = await cookies()

    // createServerClient (SSR) — pas getSupabase() qui est navigateur uniquement
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},   // lecture seule dans les route handlers
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Suppression avec double contrainte alias + user_id (RLS + sécurité défensive)
    const { error: deleteError } = await supabase
      .from('dossiers')
      .delete()
      .eq('alias', alias)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('[DELETE] Erreur Supabase:', deleteError.message)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // localStorage non accessible côté serveur — nettoyage fait côté client par l'appelant
    return NextResponse.json({ success: true, deleted: alias })
  } catch (err) {
    console.error('[DELETE] Erreur inattendue:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
