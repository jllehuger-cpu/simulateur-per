'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Lock, Unlock, RotateCcw, ShieldAlert } from 'lucide-react'
import { useCleB } from '@/lib/use-cle-b'

const INPUT_CLASS =
  'w-full rounded-lg border border-white/10 bg-slate-700 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-blue-500/50'

// Contenu réutilisable — utilisé dans la modal navbar (CleBModal) et inline dans /settings
export function CleBManager({ onClose }: { onClose?: () => void }) {
  const { active, loading, error, setError, activer, modifier, desactiver } = useCleB()
  const [mode, setMode] = useState<'view' | 'modifier' | 'desactiver'>('view')
  const [motDePasse, setMotDePasse]   = useState('')
  const [ancienMdp,  setAncienMdp]    = useState('')
  const [nouveauMdp, setNouveauMdp]   = useState('')
  const [success,    setSuccess]      = useState('')

  const reset = () => { setMotDePasse(''); setAncienMdp(''); setNouveauMdp(''); setError(''); }

  const handleActiver = async () => {
    console.log('[CLÉ B] Clic "Activer" — valeur saisie (longueur):', motDePasse.trim().length)
    if (!motDePasse.trim()) { console.log('[CLÉ B] Champ vide — abandon'); return }
    const ok = await activer(motDePasse.trim())
    if (ok) { setSuccess('✅ Clé B activée'); reset() }
  }

  const handleModifier = async () => {
    if (!ancienMdp.trim() || !nouveauMdp.trim()) return
    const ok = await modifier(ancienMdp.trim(), nouveauMdp.trim())
    if (ok) { setSuccess('✅ Clé B modifiée'); reset(); setMode('view') }
  }

  const handleDesactiver = async () => {
    const ok = await desactiver()
    if (ok) { setSuccess('Clé B désactivée — identités supprimées'); setMode('view') }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Statut */}
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
        active
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
          : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
      }`}>
        {active ? <Unlock size={16} className="flex-shrink-0" /> : <Lock size={16} className="flex-shrink-0" />}
        <span>
          {active
            ? 'Clé B active pour cette session'
            : 'Clé B inactive — vos données personnelles ne sont pas chiffrées'}
        </span>
      </div>

      {/* Avertissement — toujours visible, séparé du formulaire */}
      <div className="mb-4 flex items-start gap-2 rounded border border-amber-600 bg-amber-900/20 p-3 text-sm text-amber-200">
        <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
        <span>Ne perdez pas votre Clé B ! Comme la Clé A, elle n&apos;est jamais stockée et ne peut pas être récupérée en cas d&apos;oubli.</span>
      </div>

      {success && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          <div className="flex items-center gap-1.5 font-semibold">
            <ShieldAlert size={14} className="flex-shrink-0" /> {error}
          </div>
        </div>
      )}

      {/* ── Vue : inactive → activer ── */}
      {!active && mode === 'view' && (
        <div className="flex flex-col space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Clé B (passphrase)</label>
            <input
              type="password"
              value={motDePasse}
              onChange={e => setMotDePasse(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && void handleActiver()}
              placeholder="Saisissez votre Clé B (passphrase)"
              className={INPUT_CLASS}
            />
          </div>
          <button
            onClick={() => void handleActiver()}
            disabled={loading || !motDePasse.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Activation...' : '🔑 Activer la Clé B'}
          </button>
        </div>
      )}

      {/* ── Vue : active → modifier / désactiver ── */}
      {active && mode === 'view' && (
        <div className="flex gap-3">
          <button
            onClick={() => { setMode('modifier'); setSuccess('') }}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white transition hover:bg-amber-500"
          >
            <RotateCcw size={14} /> Modifier
          </button>
          <button
            onClick={() => { setMode('desactiver'); setSuccess('') }}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            <Lock size={14} /> Désactiver
          </button>
        </div>
      )}

      {/* ── Vue : modifier ── */}
      {mode === 'modifier' && (
        <div className="flex flex-col space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Ancienne Clé B</label>
            <input type="password" value={ancienMdp} onChange={e => setAncienMdp(e.target.value)}
              placeholder="Ancienne passphrase" className={INPUT_CLASS} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Nouvelle Clé B</label>
            <input type="password" value={nouveauMdp} onChange={e => setNouveauMdp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && void handleModifier()}
              placeholder="Nouvelle passphrase" className={INPUT_CLASS} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setMode('view'); reset() }}
              className="flex-1 rounded-lg border border-white/10 py-3 text-sm text-slate-300 transition hover:bg-white/10">
              Annuler
            </button>
            <button
              onClick={() => void handleModifier()}
              disabled={loading || !ancienMdp.trim() || !nouveauMdp.trim()}
              className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? 'Re-chiffrement...' : 'Confirmer'}
            </button>
          </div>
        </div>
      )}

      {/* ── Vue : désactiver (confirmation) ── */}
      {mode === 'desactiver' && (
        <div className="flex flex-col space-y-4">
          <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-3 text-sm text-red-200">
            Cette action supprime <strong>définitivement</strong> toutes les identités chiffrées
            (noms, prénoms, contacts). Les dossiers patrimoniaux ne sont pas affectés. Irréversible.
          </div>
          <div className="flex gap-3">
            <button onClick={() => setMode('view')}
              className="flex-1 rounded-lg border border-white/10 py-3 text-sm text-slate-300 transition hover:bg-white/10">
              Annuler
            </button>
            <button
              onClick={() => void handleDesactiver()}
              disabled={loading}
              className="flex-1 rounded-lg bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? 'Suppression...' : '🔐 Confirmer la désactivation'}
            </button>
          </div>
        </div>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="w-full rounded-lg border border-white/10 py-2.5 text-sm text-slate-300 transition hover:bg-white/10"
        >
          Fermer
        </button>
      )}
    </div>
  )
}

// Enveloppe modale — utilisée depuis la navbar
//
// Rendue via un portail vers document.body : la navbar a un backdrop-filter
// (blur), ce qui crée un containing block pour les descendants `fixed` et les
// positionne par rapport au header (60px) au lieu du viewport. Le portail
// échappe à ce piège et garantit un centrage correct, sticky-au-scroll, etc.
export function CleBModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1120] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
            🔑 Gérer la Clé B
          </h2>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>
        <CleBManager onClose={onClose} />
      </div>
    </div>,
    document.body
  )
}
