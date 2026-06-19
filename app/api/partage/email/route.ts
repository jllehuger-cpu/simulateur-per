// POST /api/partage/email — envoie l'email d'invitation au client (côté serveur)
//
// Resend a besoin de sa clé secrète (RESEND_API_KEY) qui ne doit jamais être
// exposée au navigateur — d'où cette route plutôt qu'un appel direct depuis
// lib/partage-cle.ts (qui s'exécute côté client pour le chiffrement E2E).

import { NextResponse } from 'next/server'
import { sendShareEmail } from '@/lib/email'

export async function POST(request: Request) {
  let body: { clientEmail?: string; url?: string; alias?: string; cgpName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const { clientEmail, url, alias, cgpName } = body
  if (!clientEmail || !url || !alias || !cgpName) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  try {
    await sendShareEmail(clientEmail, url, alias, cgpName)
  } catch (err) {
    console.error('[API /partage/email] Erreur envoi:', err)
    return NextResponse.json({ error: 'Échec de l\'envoi de l\'email' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
