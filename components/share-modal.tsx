'use client'

import { useState } from 'react'
import { Share2, X, Copy, Check, ShieldAlert, AlertTriangle, RotateCcw, Loader2 } from 'lucide-react'
import { getCleSession } from '@/lib/crypto'
import { creerPartageComplet, CHAMPS_EDITABLES_DEFAUT, ResultatPartage } from '@/lib/partage-cle'
import type { PartagePermission } from '@/lib/types'

const GENERATION_TIMEOUT_MS = 30_000

function categoriserErreur(message: string): { label: string; hint: string } {
  if (message === 'Session non déverrouillée' || message === 'Session déverrouillée requise') {
    return { label: 'Session non déverrouillée', hint: "Ouvrez le dossier d'abord pour déverrouiller la session." }
  }
  if (message === 'Timeout Supabase') {
    return { label: 'Timeout', hint: 'La requête a pris trop de temps. Réessayez.' }
  }
  if (message.startsWith('Erreur Supabase')) {
    return { label: 'Erreur Supabase', hint: 'Réessayez.' }
  }
  if (message.startsWith('Erreur chiffrement')) {
    return { label: 'Erreur chiffrement', hint: 'Réessayez.' }
  }
  return { label: 'Erreur', hint: 'Réessayez.' }
}

type PermissionSimple = 'read_full' | 'edit_partial'

const PERMISSION_LABELS: Record<PermissionSimple, string> = {
  read_full: 'Lecture seule',
  edit_partial: 'Lecture + modification limitée',
}

export function ShareModal({ alias, onClose, initialEmail }: {
  alias: string
  onClose: () => void
  initialEmail?: string
}) {
  const [email, setEmail] = useState(initialEmail ?? '')
  const [permission, setPermission] = useState<PermissionSimple>('read_full')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ResultatPartage | null>(null)
  const [copied, setCopied] = useState<'url' | 'phrase' | null>(null)

  const handleGenerer = async () => {
    if (!email.trim()) { setError('Email requis'); return }

    console.log('[UI PARTAGE] Vérification de la session avant génération...')
    const cleSession = getCleSession()
    if (!cleSession) {
      console.warn('[UI PARTAGE] ❌ Session non déverrouillée — clé absente')
      setError('Session non déverrouillée')
      return
    }
    console.log('[UI PARTAGE] ✓ Clé de session présente (valeur masquée : ***)')

    setLoading(true)
    setError('')

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Timeout Supabase')), GENERATION_TIMEOUT_MS)
    })

    try {
      console.log('Appel creerPartageComplet()...')
      const resultat = await Promise.race([
        creerPartageComplet({
          dossierAlias: alias,
          clientEmail: email.trim(),
          permissions: permission as PartagePermission,
          champsEditables: permission === 'edit_partial' ? CHAMPS_EDITABLES_DEFAUT : [],
        }),
        timeoutPromise,
      ])
      console.log('✅ Partage créé', resultat)
      setResult(resultat)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur lors de la création du partage'
      console.error('❌ Erreur:', message)
      setError(message)
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  const copier = (text: string, type: 'url' | 'phrase') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c1120] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
            <Share2 size={18} className="text-blue-400" />
            Partager avec le client
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <>
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={14} />
                  {categoriserErreur(error).label}
                </div>
                <div className="mt-1 text-xs text-red-300/90">{error}</div>
                <div className="mt-1.5 flex items-center gap-1 text-xs text-red-300/70">
                  <RotateCcw size={11} /> {categoriserErreur(error).hint}
                </div>
              </div>
            )}

            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Email du client
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="client@exemple.fr"
              className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500/50"
            />

            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Permissions
            </label>
            <select
              value={permission}
              onChange={e => setPermission(e.target.value as PermissionSimple)}
              className="mb-5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500/50"
            >
              <option value="read_full" className="bg-[#0c1120]">{PERMISSION_LABELS.read_full}</option>
              <option value="edit_partial" className="bg-[#0c1120]">{PERMISSION_LABELS.edit_partial}</option>
            </select>

            <button
              onClick={() => void handleGenerer()}
              disabled={loading || !email.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Chiffrement en cours...</>
                : error ? 'Réessayer' : 'Générer partage'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300">
              <Check size={16} /> Partage créé avec succès
            </div>

            <label className="mb-1.5 block text-center text-xs font-medium text-slate-400">
              Phrase d&apos;accès (3 mots)
            </label>
            <code className="mb-3 block rounded-lg border border-amber-500/25 bg-white/5 px-4 py-4 text-center text-2xl font-bold tracking-wide text-amber-300">
              {result.phrase}
            </code>
            <button
              onClick={() => copier(result.phrase, 'phrase')}
              className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10"
            >
              {copied === 'phrase' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied === 'phrase' ? 'Copié' : 'Copier phrase'}
            </button>

            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Lien de partage
            </label>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex-1 truncate rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
                {result.url}
              </div>
              <button
                onClick={() => copier(result.url, 'url')}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10"
              >
                {copied === 'url' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copied === 'url' ? 'Copié' : 'Copier lien'}
              </button>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs leading-relaxed text-amber-200/90">
              <ShieldAlert size={15} className="mt-0.5 flex-shrink-0" />
              Envoyez la phrase par SMS ou téléphone (pas par email). Le lien peut être envoyé par email.
            </div>

            <button
              onClick={onClose}
              className="mt-5 w-full rounded-lg border border-white/10 py-2 text-sm text-slate-300 transition hover:bg-white/10"
            >
              Fermer
            </button>
          </>
        )}
      </div>
    </div>
  )
}
