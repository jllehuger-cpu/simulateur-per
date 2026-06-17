'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { UnlockGate } from '@/components/unlock-gate'
import { useAuth } from '@/lib/use-auth'
import {
  creerPartageComplet,
  CHAMPS_EDITABLES_DEFAUT,
  CHAMPS_EDITABLES_OPTIONS,
  ResultatPartage,
} from '@/lib/partage-cle'
import {
  listerPartagesCGP,
  revoquerPartage,
  listerModificationsClient,
} from '@/lib/db-partages'
import type { Partage, ModificationClient } from '@/lib/types'

const PERMISSIONS_OPTS = [
  { v: 'read_partial', l: '👁  Lecture seule (champs autorisés)', desc: 'Le client peut consulter, pas modifier.' },
  { v: 'read_full',    l: '👁  Lecture complète du dossier',      desc: 'Le client voit tout, ne peut pas modifier.' },
  { v: 'edit_partial', l: '✏️  Lecture + écriture (champs limités)', desc: 'Le client peut modifier les champs que vous autorisez.' },
]

// ── Composant interne ─────────────────────────────────────────────────────────

function PartagerContent({ alias }: { alias: string }) {
  useAuth()
  const router = useRouter()

  const [email,        setEmail]        = useState('')
  const [permissions,  setPermissions]  = useState<'read_partial' | 'read_full' | 'edit_partial'>('read_partial')
  const [champsEditables, setChampsEditables] = useState<string[]>(CHAMPS_EDITABLES_DEFAUT)
  const [loading,      setLoading]      = useState(false)
  const [result,       setResult]       = useState<ResultatPartage | null>(null)
  const [error,        setError]        = useState('')
  const [copied,       setCopied]       = useState<'url' | 'phrase' | null>(null)

  const [partages,     setPartages]     = useState<Partage[]>([])
  const [mods,         setMods]         = useState<Record<string, ModificationClient[]>>({})
  const [loadingList,  setLoadingList]  = useState(true)

  const loadPartages = useCallback(async () => {
    try {
      const list = await listerPartagesCGP(alias)
      setPartages(list)
      // Charger les modifications pour chaque partage
      const modsMap: Record<string, ModificationClient[]> = {}
      await Promise.all(list.map(async p => {
        try {
          modsMap[p.id] = await listerModificationsClient(p.id)
        } catch { modsMap[p.id] = [] }
      }))
      setMods(modsMap)
    } catch { /* silencieux */ }
    finally { setLoadingList(false) }
  }, [alias])

  useEffect(() => { void loadPartages() }, [loadPartages])

  const handleCreer = async () => {
    if (!email.trim()) { setError('Email requis'); return }
    setLoading(true); setError('')
    try {
      const r = await creerPartageComplet({
        dossierAlias:    alias,
        clientEmail:     email.trim(),
        permissions,
        champsEditables: permissions === 'edit_partial' ? champsEditables : [],
      })
      setResult(r)
      setEmail('')
      void loadPartages()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création du partage')
    } finally {
      setLoading(false)
    }
  }

  const handleRevoquer = async (id: string) => {
    if (!confirm('Révoquer ce partage ? Le client ne pourra plus accéder au dossier.')) return
    try {
      await revoquerPartage(id)
      void loadPartages()
    } catch { alert('Erreur lors de la révocation') }
  }

  const copier = (text: string, type: 'url' | 'phrase') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const toggleChamp = (champ: string) => {
    setChampsEditables(prev =>
      prev.includes(champ) ? prev.filter(c => c !== champ) : [...prev, champ]
    )
  }

  const STATUS_BADGE: Record<string, string> = {
    pending: '⏳ En attente', active: '✅ Actif', revoked: '❌ Révoqué',
  }

  // ── Rendu ──

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, color: 'var(--text-muted)', fontSize: 12,
            padding: '6px 12px', cursor: 'pointer',
          }}
        >
          ← Retour
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            Partager le dossier
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{alias}</div>
        </div>
      </div>

      {/* Résultat de création */}
      {result && (
        <div className="glass-card" style={{
          padding: '1.25rem', marginBottom: 20,
          border: '1px solid rgba(16,185,129,0.3)',
          background: 'rgba(16,185,129,0.06)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#34D399', marginBottom: 12 }}>
            ✅ Partage créé — transmettez ces informations au client
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              🔑 Phrase d&apos;accès (3 mots) — à communiquer séparément (SMS, téléphone)
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{
                flex: 1, padding: '10px 14px',
                background: 'rgba(255,255,255,0.05)', borderRadius: 8,
                fontSize: 18, fontWeight: 700, letterSpacing: '0.05em',
                color: 'var(--accent-gold)', border: '1px solid rgba(201,168,76,0.3)',
              }}>
                {result.phrase}
              </code>
              <button
                onClick={() => copier(result.phrase, 'phrase')}
                style={{
                  padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
                  background: 'transparent', color: copied === 'phrase' ? '#34D399' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                }}
              >
                {copied === 'phrase' ? '✓ Copié' : '📋 Copier'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              🔗 Lien d&apos;accès (peut être envoyé par email)
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{
                flex: 1, padding: '8px 12px',
                background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                fontSize: 11, color: 'var(--text-muted)',
                wordBreak: 'break-all', border: '1px solid rgba(255,255,255,0.08)',
              }}>
                {result.url}
              </div>
              <button
                onClick={() => copier(result.url, 'url')}
                style={{
                  padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
                  background: 'transparent', color: copied === 'url' ? '#34D399' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                }}
              >
                {copied === 'url' ? '✓ Copié' : '📋 Copier'}
              </button>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            ⚠️ Transmettez la phrase par un canal différent du lien (ex : lien par email + phrase par SMS).
          </div>
          <button
            onClick={() => setResult(null)}
            style={{
              marginTop: 12, padding: '6px 14px', borderRadius: 8,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
            }}
          >
            Créer un autre partage
          </button>
        </div>
      )}

      {/* Formulaire de création */}
      {!result && (
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Nouveau partage
          </div>

          {error && (
            <div style={{
              fontSize: 12, color: '#FCA5A5', marginBottom: 12,
              padding: '8px 12px', background: 'rgba(239,68,68,0.08)',
              borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)',
            }}>
              ❌ {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              Email du client
            </label>
            <input
              className="glass-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="client@exemple.fr"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              Niveau d&apos;accès
            </label>
            {PERMISSIONS_OPTS.map(opt => (
              <label key={opt.v} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                background: permissions === opt.v ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${permissions === opt.v ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.15s',
              }}>
                <input
                  type="radio"
                  name="permissions"
                  value={opt.v}
                  checked={permissions === opt.v}
                  onChange={() => setPermissions(opt.v as typeof permissions)}
                  style={{ marginTop: 2, accentColor: 'var(--accent-blue)' }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{opt.l}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {permissions === 'edit_partial' && (
            <div style={{
              marginBottom: 14, padding: '12px 14px',
              background: 'rgba(16,185,129,0.05)',
              border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#34D399', marginBottom: 8 }}>
                Champs éditables par le client
              </div>
              {CHAMPS_EDITABLES_OPTIONS.map(opt => (
                <label key={opt.value} style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: '5px 0', fontSize: 13, color: 'var(--text-secondary)',
                }}>
                  <input
                    type="checkbox"
                    checked={champsEditables.includes(opt.value)}
                    onChange={() => toggleChamp(opt.value)}
                    style={{ accentColor: '#10B981', width: 14, height: 14 }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}

          <button
            onClick={() => void handleCreer()}
            disabled={loading || !email.trim()}
            style={{
              width: '100%', padding: '10px 0',
              background: loading || !email.trim()
                ? 'rgba(255,255,255,0.05)'
                : 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(59,130,246,0.12))',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 10, color: loading || !email.trim() ? 'var(--text-muted)' : 'var(--accent-blue)',
              fontWeight: 600, fontSize: 14, cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '⏳ Création du partage…' : '🔗 Créer le partage'}
          </button>
        </div>
      )}

      {/* Liste des partages existants */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
        Partages existants ({partages.filter(p => p.status !== 'revoked').length} actif{partages.filter(p => p.status !== 'revoked').length !== 1 ? 's' : ''})
      </div>

      {loadingList && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 16 }}>Chargement…</div>
      )}

      {!loadingList && partages.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Aucun partage créé</div>
      )}

      {partages.map(p => {
        const partMods = mods[p.id] ?? []
        return (
          <div key={p.id} className="glass-card" style={{ padding: '1rem', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {p.client_email ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {STATUS_BADGE[p.status] ?? p.status} ·{' '}
                  {p.permissions === 'edit_partial' ? '✏️ édition limitée' :
                   p.permissions === 'read_full'    ? '👁 lecture complète' : '👁 lecture partielle'}
                  {' · '}
                  créé le {new Date(p.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
              {p.status !== 'revoked' && (
                <button
                  onClick={() => void handleRevoquer(p.id)}
                  style={{
                    padding: '4px 12px', fontSize: 11,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 6, color: '#EF4444', cursor: 'pointer',
                  }}
                >
                  Révoquer
                </button>
              )}
            </div>

            {partMods.length > 0 && (
              <div style={{
                padding: '8px 10px',
                background: 'rgba(201,168,76,0.07)',
                border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-gold)', marginBottom: 4 }}>
                  {partMods.length} modification{partMods.length > 1 ? 's' : ''} client à examiner
                </div>
                {partMods.slice(0, 3).map(m => (
                  <div key={m.id} style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                    • <code style={{ fontSize: 11 }}>{m.champ_modifie}</code> → &ldquo;{(m.nouvelle_valeur ?? '').substring(0, 50)}&rdquo;
                  </div>
                ))}
                {partMods.length > 3 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>…et {partMods.length - 3} de plus</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Export avec UnlockGate ────────────────────────────────────────────────────

export default function PagePartagerDossier() {
  const params = useParams()
  const alias  = params.alias as string
  return (
    <UnlockGate>
      <PartagerContent alias={alias} />
    </UnlockGate>
  )
}
