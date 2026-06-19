'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Share2, Lock } from 'lucide-react'
import { UnlockGate } from '@/components/unlock-gate'
import { useAuth } from '@/lib/use-auth'
import { getDossier } from '@/lib/dossiers'
import { listerPartagesCGP } from '@/lib/db-partages'
import { ShareModal } from '@/components/share-modal'
import type { DossierPatrimonial } from '@/lib/types'

// ─── Page dossier ──────────────────────────────────────────────────────────

function DossierDetailContent({ alias }: { alias: string }) {
  useAuth()
  const router = useRouter()
  const [dossier, setDossier] = useState<DossierPatrimonial | null>(null)
  const [loading, setLoading] = useState(true)
  const [showShare, setShowShare] = useState(false)
  const [sharePrefillEmail, setSharePrefillEmail] = useState('')

  const load = useCallback(async () => {
    try {
      const d = await getDossier(alias)
      setDossier(d)
    } finally {
      setLoading(false)
    }
  }, [alias])

  useEffect(() => { void load() }, [load])

  const handleOpenShare = async () => {
    try {
      const partages = await listerPartagesCGP(alias)
      setSharePrefillEmail(dossier?.client_email || partages[0]?.client_email || '')
    } catch {
      setSharePrefillEmail(dossier?.client_email ?? '')
    }
    setShowShare(true)
  }

  const patrimoine = dossier
    ? dossier.biens_immo.reduce((s, b) => s + (b.valeur_venale - b.crd), 0) +
      dossier.produits_financiers.reduce((s, p) => s + p.valeur_actuelle, 0)
    : 0

  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dossiers')}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/5"
          >
            <ArrowLeft size={14} /> Retour
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-100">{dossier?.label || alias}</h1>
            <div className="text-xs text-slate-500">{alias}</div>
          </div>
        </div>

        <button
          onClick={() => void handleOpenShare()}
          disabled={loading || !dossier}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Share2 size={15} />
          Partager avec client
        </button>
      </div>

      {loading && <div className="text-sm text-slate-500">Chargement...</div>}

      {!loading && !dossier && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
          Dossier introuvable.
        </div>
      )}

      {!loading && dossier && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">Patrimoine net</div>
            <div className="text-lg font-bold text-emerald-400">{fmt(patrimoine)}</div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Lock size={12} /> Dossier chiffré côté navigateur.
          </div>
          <Link
            href={`/saisie?alias=${alias}`}
            className="mt-4 inline-flex rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
          >
            Ouvrir / modifier le dossier →
          </Link>
        </div>
      )}

      {showShare && (
        <ShareModal alias={alias} initialEmail={sharePrefillEmail} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}

export default function DossierDetailPage() {
  const params = useParams()
  const alias = params.alias as string
  return (
    <UnlockGate>
      <DossierDetailContent alias={alias} />
    </UnlockGate>
  )
}
