'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DossierPatrimonial, STORAGE_KEY } from '@/lib/types'
import {
  listerDossiers, nouveauDossier,
  sauvegarderDossier, importerDossierJSON, exporterDossierExcel,
} from '@/lib/dossiers'
import { identiteDisponible } from '@/lib/crypto'
import { lireToutes, sauvegarderIdentite, IdentiteProspect } from '@/lib/db-identite'
import { listerPartagesCGP } from '@/lib/db-partages'
import { ShareModal } from '@/components/share-modal'
import { UnlockGate } from '@/components/unlock-gate'
import { useAuth } from '@/lib/use-auth'
import { useIdentiteVisible, masquerTexte } from '@/lib/use-identite-visible'
import { genererResumeAuto, emojiSituation } from '@/lib/generer-resume'

function ModalIdentite({
  alias,
  existante,
  onClose,
  onSaved,
}: {
  alias: string
  existante?: IdentiteProspect
  onClose: () => void
  onSaved: () => void
}) {
  const [nom,      setNom]      = useState(existante?.nom ?? '')
  const [prenom,   setPrenom]   = useState(existante?.prenom ?? '')
  const [tel,      setTel]      = useState(existante?.tel ?? '')
  const [email,    setEmail]    = useState(existante?.email ?? '')
  const [notes,    setNotes]    = useState(existante?.notes_cgp ?? '')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const handleSave = async () => {
    if (!nom.trim() || !prenom.trim()) { setError('Nom et prénom obligatoires'); return }
    setSaving(true)
    try {
      await sauvegarderIdentite({ alias, nom: nom.trim(), prenom: prenom.trim(), tel: tel.trim() || undefined, email: email.trim() || undefined, notes_cgp: notes.trim() || undefined })
      onSaved()
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: 13,
    marginBottom: 10, boxSizing: 'border-box' as const,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
    }} onClick={onClose}>
      <div className="glass-card" style={{ padding: 28, maxWidth: 400, width: '92%' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>
          Identité — <span style={{ color: 'var(--accent-gold)' }}>{alias}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Prénom" value={prenom} onChange={e => setPrenom(e.target.value)} />
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} />
        </div>
        <input style={inputStyle} placeholder="Téléphone (optionnel)" value={tel} onChange={e => setTel(e.target.value)} />
        <input style={inputStyle} placeholder="Email (optionnel)" value={email} onChange={e => setEmail(e.target.value)} />
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
          placeholder="Notes CGP (optionnel)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        {error && <div style={{ fontSize: 12, color: '#F87171', marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 12 }}>Annuler</button>
          <button onClick={() => void handleSave()} disabled={saving} style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))',
            color: '#fff', fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DossiersContent() {
  const router = useRouter()
  useAuth()
  const { visible: identiteVisible } = useIdentiteVisible()
  const [isMounted,     setIsMounted]     = useState(false)
  const [dossiers,   setDossiers]   = useState<DossierPatrimonial[]>([])
  const [search,     setSearch]     = useState('')
  const [confirmDel,    setConfirmDel]    = useState<string | null>(null)
  const [deleting,      setDeleting]      = useState(false)
  const [deleteError,   setDeleteError]   = useState('')
  const [identites,     setIdentites]     = useState<Map<string, IdentiteProspect>>(new Map())
  const [modalId,       setModalId]       = useState<string | null>(null)
  const [shareAlias,        setShareAlias]        = useState<string | null>(null)
  const [sharePrefillEmail, setSharePrefillEmail] = useState('')
  const [shareLoading,      setShareLoading]      = useState<string | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newInitiale,   setNewInitiale]   = useState('')
  const [editingLabelAlias, setEditingLabelAlias] = useState<string | null>(null)
  const [tempLabel,         setTempLabel]          = useState('')
  const [newCreating,       setNewCreating]         = useState(false)
  const [newDialogError,    setNewDialogError]       = useState('')

  const reloadIdentites = useCallback(async () => {
    if (identiteDisponible()) {
      const map = await lireToutes()
      setIdentites(map)
    }
  }, [])

  const reload = useCallback(async () => {
    try {
      const list = await listerDossiers()
      setDossiers(list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
    } catch { /* session locked */ }
  }, [])

  useEffect(() => { setIsMounted(true) }, [])

  useEffect(() => {
    void reload()
    void reloadIdentites()
  }, [reload, reloadIdentites])

  if (!isMounted) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Chargement...</div>

  const handleNew = async () => {
    setNewCreating(true)
    setNewDialogError('')
    try {
      const lettre = newInitiale.trim().charAt(0).toUpperCase()
      const d = nouveauDossier(lettre || undefined)
      await sauvegarderDossier(d)
      setShowNewDialog(false)
      setNewInitiale('')
      setNewCreating(false)
      router.push(`/saisie?alias=${d.alias}`)
    } catch (err) {
      console.error('[NEW DOSSIER]', err)
      setNewDialogError(err instanceof Error ? err.message : String(err))
      setNewCreating(false)
    }
  }

  const handleDelete = async (alias: string) => {
    setDeleting(true)
    setDeleteError('')
    try {
      // Suppression Supabase via API route (createServerClient côté serveur)
      const res = await fetch('/api/dossiers/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ alias }),
      })
      const json = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Erreur HTTP ${res.status}`)
      }

      // Nettoyage localStorage côté client (les données chiffrées ne sont qu'un cache)
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const entries = JSON.parse(raw) as { alias: string }[]
          localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.filter(e => e.alias !== alias)))
        }
      } catch { /* localStorage non critique */ }

      setConfirmDel(null)
      void reload()
    } catch (err) {
      console.error('[DELETE]', err)
      setDeleteError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  const handleSaveLabel = async (alias: string) => {
    const dossier = dossiers.find(d => d.alias === alias)
    if (!dossier) { setEditingLabelAlias(null); return }
    const newLabel = tempLabel.trim() || undefined
    if (newLabel === dossier.label) { setEditingLabelAlias(null); return }
    const updated = { ...dossier, label: newLabel }
    setDossiers(prev => prev.map(d => d.alias === alias ? updated : d))
    setEditingLabelAlias(null)
    try {
      await sauvegarderDossier(updated)
    } catch (err) {
      console.error('[LABEL]', err)
    }
  }

  const handleOpenShare = async (alias: string, dossierClientEmail?: string) => {
    console.log('[SHARE] openShare appelé', alias)
    setShareLoading(alias)
    try {
      console.log('[SHARE] Récupération partages existants...')
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 10_000)
      )
      const partages = await Promise.race([listerPartagesCGP(alias), timeout])
      setSharePrefillEmail(dossierClientEmail || partages[0]?.client_email || '')
      console.log('[SHARE] ✅ Partages récupérés')
    } catch (err) {
      console.warn('[SHARE] Erreur récup partages (ok, on continue):', err)
      // Pas grave si on ne récupère pas les anciens partages — on ouvre le modal quand même
      setSharePrefillEmail(dossierClientEmail ?? '')
    } finally {
      setShareLoading(null)
    }
    // IMPORTANT : afficher le modal même si la récupération a échoué/timeout
    console.log('[SHARE] setShareAlias à', alias)
    setShareAlias(alias)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const d = await importerDossierJSON(file)
      await sauvegarderDossier(d)
      void reload()
    } catch {
      alert('Fichier invalide')
    }
    e.target.value = ''
  }

  const filtered = dossiers.filter(d =>
    d.alias.toLowerCase().includes(search.toLowerCase()) ||
    (identites.get(d.alias)?.nom ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (identites.get(d.alias)?.prenom ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const patrimoine = (d: DossierPatrimonial) => {
    const immo = d.biens_immo.reduce((s, b) => s + (b.valeur_venale - b.crd), 0)
    const fin  = d.produits_financiers.reduce((s, p) => s + p.valeur_actuelle, 0)
    return immo + fin
  }

  const fmt = (n: number) => n > 0
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
    : '—'

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px', maxWidth: 860, margin: '0 auto', position: 'relative', zIndex: 1 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Mes dossiers</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {dossiers.length} dossier{dossiers.length > 1 ? 's' : ''} · chiffrés localement · aucune donnée personnelle sur le serveur
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{
            padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13,
            border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.04)',
            color: 'var(--text-secondary)', whiteSpace: 'nowrap'
          }}>
            ↑ Importer JSON
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
          <button onClick={() => setShowNewDialog(true)} style={{
            padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))',
            color: '#fff', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap'
          }}>
            + Nouveau dossier
          </button>
        </div>
      </div>

      {/* Bandeau sécurité */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)',
        borderRadius: 10, padding: '10px 16px'
      }}>
        <span style={{ fontSize: 18 }}>🔒</span>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--accent-emerald)' }}>Chiffrement AES-256-GCM côté navigateur.</strong>
          {' '}Les dossiers sont chiffrés avec votre mot de passe avant tout stockage.
          Supabase ne voit que du texte illisible.
          {identiteDisponible() && (
            <span style={{ marginLeft: 8, color: 'var(--accent-blue)' }}>· Clé identité active</span>
          )}
        </div>
      </div>

      {/* Bandeau clé identité inactive */}
      {!identiteDisponible() && (
        <div style={{
          background: 'rgba(59,130,246,0.06)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 10, padding: '10px 16px',
          fontSize: 12, color: 'var(--text-secondary)',
          marginBottom: 16
        }}>
          🔒 Clé identité non active — les dossiers s&apos;affichent avec leurs alias.
          Pour voir et saisir les vrais noms, déverrouillez avec la clé identité au prochain accès.
        </div>
      )}

      {/* Recherche */}
      {dossiers.length > 3 && (
        <input
          className="glass-input"
          placeholder={identiteDisponible() ? 'Rechercher par alias ou nom...' : 'Rechercher un alias...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Aucun dossier pour l&apos;instant</div>
          <button onClick={() => setShowNewDialog(true)} style={{
            marginTop: 16, padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))',
            color: '#fff', fontWeight: 600, fontSize: 13
          }}>
            Créer mon premier dossier
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(d => {
            const pat        = patrimoine(d)
            const hasAudit   = !!d.audit_result
            const identite   = identites.get(d.alias)
            const nomAffiche = identite ? `${identite.prenom} ${identite.nom}` : null
            const resume     = d.resume_auto || genererResumeAuto(d)
            const isEditing  = editingLabelAlias === d.alias

            return (
              <div key={d.alias} className="glass-card" style={{
                padding: '14px 20px',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
                onClick={() => router.push(`/saisie?alias=${d.alias}`)}
              >
                {/* Ligne 1 : icône + identité/alias + badge audité + patrimoine + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

                  {/* Icône statut */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                    background: hasAudit ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${hasAudit ? 'rgba(16,185,129,0.25)' : 'var(--border-glass)'}`,
                  }}>
                    {hasAudit ? '✅' : emojiSituation(d)}
                  </div>

                  {/* Noms / alias */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {nomAffiche ? (
                        <>
                          <span style={{
                            fontWeight: 600, color: 'var(--text-primary)',
                            fontFamily: identiteVisible ? 'inherit' : 'var(--font-mono, monospace)',
                            letterSpacing: identiteVisible ? 'normal' : '0.05em',
                          }}>
                            {masquerTexte(identite!.prenom, identiteVisible)}{' '}
                            {masquerTexte(identite!.nom.toUpperCase(), identiteVisible)}
                            {identite?.prenom_conjoint && identite?.nom_conjoint && (
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                                {' '}&amp;{' '}
                                {masquerTexte(identite.prenom_conjoint, identiteVisible)}{' '}
                                {masquerTexte(identite.nom_conjoint.toUpperCase(), identiteVisible)}
                              </span>
                            )}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--accent-gold)', letterSpacing: '0.03em' }}>
                            {d.alias}
                          </span>
                        </>
                      ) : (
                        <>
                          <span style={{ fontWeight: 600, color: 'var(--accent-gold)', letterSpacing: '0.03em' }}>
                            {d.alias}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.5 }}>🔒</span>
                        </>
                      )}
                      {hasAudit && (
                        <span style={{
                          fontSize: 10, padding: '1px 7px', borderRadius: 10,
                          background: 'rgba(16,185,129,0.12)', color: 'var(--accent-emerald)',
                          border: '1px solid rgba(16,185,129,0.2)', fontWeight: 600
                        }}>Audité</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      Modifié le {fmtDate(d.updated_at)}
                    </div>
                  </div>

                  {/* Patrimoine net */}
                  {pat > 0 && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-emerald)' }}>{fmt(pat)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>patrimoine net</div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => identiteDisponible() && setModalId(d.alias)}
                      disabled={!identiteDisponible()}
                      title={!identiteDisponible()
                        ? 'Déverrouillez avec la clé identité pour saisir les noms'
                        : identite ? 'Modifier l\'identité' : 'Saisir l\'identité prospect'
                      }
                      style={{
                        padding: '5px 10px', borderRadius: 7, fontSize: 13, cursor: identiteDisponible() ? 'pointer' : 'not-allowed',
                        border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.08)',
                        color: 'var(--accent-indigo)', opacity: identiteDisponible() ? 1 : 0.35,
                      }}>
                      👤
                    </button>
                    {hasAudit && (
                      <button
                        onClick={() => {
                          sessionStorage.setItem('audit_payload', d.audit_result!)
                          sessionStorage.setItem('audit_alias', d.alias)
                          router.push('/audit?view=1')
                        }}
                        style={{
                          padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                          border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.08)',
                          color: 'var(--accent-emerald)',
                        }}>
                        Voir audit
                      </button>
                    )}
                    <button
                      onClick={() => exporterDossierExcel(d)}
                      style={{
                        padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                        border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.08)',
                        color: 'var(--accent-indigo)',
                      }}>
                      ↓ Excel
                    </button>
                    <button
                      onClick={() => router.push(`/dossiers/${d.alias}`)}
                      title="Détails du dossier"
                      style={{
                        padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                        border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.08)',
                        color: 'var(--accent-blue)',
                      }}>
                      👁️ Détails
                    </button>
                    <button
                      onClick={() => router.push(`/saisie?alias=${d.alias}`)}
                      title="Modifier le dossier"
                      style={{
                        padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                        border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.08)',
                        color: 'var(--accent-amber)',
                      }}>
                      ✏️ Modifier
                    </button>
                    <button
                      onClick={() => void handleOpenShare(d.alias, d.client_email)}
                      disabled={shareLoading === d.alias}
                      title="Partager avec le client"
                      style={{
                        padding: '5px 10px', borderRadius: 7, fontSize: 11,
                        cursor: shareLoading === d.alias ? 'not-allowed' : 'pointer',
                        border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.08)',
                        color: 'var(--accent-blue)', opacity: shareLoading === d.alias ? 0.5 : 1,
                      }}>
                      {shareLoading === d.alias ? '⏳' : '🤝'} Partager
                    </button>
                    <button
                      onClick={() => setConfirmDel(d.alias)}
                      style={{
                        padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                        border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)',
                        color: '#EF4444',
                      }}>
                      ✕
                    </button>
                  </div>
                </div>

                {/* Ligne 2 : label éditable + résumé auto */}
                <div style={{ marginTop: 10, marginLeft: 52, display: 'flex', flexDirection: 'column', gap: 4 }}
                  onClick={e => e.stopPropagation()}>

                  {/* Label inline */}
                  {isEditing ? (
                    <input
                      autoFocus
                      value={tempLabel}
                      maxLength={100}
                      onChange={e => setTempLabel(e.target.value)}
                      onBlur={() => void handleSaveLabel(d.alias)}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  { e.preventDefault(); void handleSaveLabel(d.alias) }
                        if (e.key === 'Escape') { setTempLabel(d.label ?? ''); setEditingLabelAlias(null) }
                      }}
                      placeholder="Ex : Succession mère, Retraite 2030..."
                      style={{
                        width: '100%', maxWidth: 340,
                        padding: '4px 10px', borderRadius: 7, fontSize: 12,
                        border: '1px solid rgba(99,102,241,0.5)',
                        background: 'rgba(99,102,241,0.1)', color: 'var(--text-primary)',
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <div
                      onClick={() => { setEditingLabelAlias(d.alias); setTempLabel(d.label ?? '') }}
                      title="Cliquer pour nommer ce dossier"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 10px', borderRadius: 7, fontSize: 12,
                        border: `1px solid ${d.label ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.07)'}`,
                        background: d.label ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                        color: d.label ? 'var(--text-primary)' : 'var(--text-muted)',
                        cursor: 'pointer', alignSelf: 'flex-start',
                        fontStyle: d.label ? 'normal' : 'italic',
                      }}>
                      <span style={{ opacity: 0.6, fontSize: 10 }}>✏️</span>
                      {d.label ?? 'Nommer ce dossier...'}
                    </div>
                  )}

                  {/* Résumé auto */}
                  {resume && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 2 }}>
                      {resume}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal identité */}
      {modalId && (
        <ModalIdentite
          alias={modalId}
          existante={identites.get(modalId)}
          onClose={() => setModalId(null)}
          onSaved={() => void reloadIdentites()}
        />
      )}

      {/* Modal partage */}
      {shareAlias && (
        <ShareModal
          alias={shareAlias}
          initialEmail={sharePrefillEmail}
          onClose={() => setShareAlias(null)}
        />
      )}

      {/* Dialog nouvelle initiale */}
      {showNewDialog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
          backdropFilter: 'blur(4px)',
        }} onClick={() => { setShowNewDialog(false); setNewInitiale(''); setNewDialogError('') }}>
          <div className="glass-card" style={{
            padding: '32px 28px', maxWidth: 400, width: '92%',
            border: '1px solid rgba(255,255,255,0.12)',
          }} onClick={e => e.stopPropagation()}>

            {/* Titre */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 24 }}>📁</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>
                  Nouveau dossier
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Créer un dossier patrimonial anonymisé
                </div>
              </div>
            </div>

            {/* Explication pédagogique */}
            <div style={{
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.15)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 16,
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>Comment fonctionne l&apos;alias ?</strong><br/>
              Chaque dossier est identifié par un code anonyme : <strong style={{ color: 'var(--accent-gold)' }}>DOS-année-mois-initiale</strong>.<br/>
              L&apos;initiale vous aide à retrouver vos dossiers sans stocker de nom sur le serveur.
              Le nom complet du client pourra être saisi de manière chiffrée dans l&apos;étape Identité.
            </div>

            {/* Champ de saisie */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6, display: 'block' }}>
                Première lettre du nom de famille :
              </label>
              <input
                autoFocus
                maxLength={1}
                value={newInitiale}
                onChange={e => setNewInitiale(e.target.value.replace(/[^a-zA-ZÀ-ÿ]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && newInitiale.trim() && void handleNew()}
                placeholder="D"
                style={{
                  width: '100%', fontSize: 28, textAlign: 'center',
                  textTransform: 'uppercase', letterSpacing: '0.15em',
                  padding: '10px 14px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Preview alias */}
            <div style={{
              textAlign: 'center', marginBottom: 20, padding: '10px 0',
              borderRadius: 8, background: 'rgba(201,168,76,0.06)',
              border: '1px solid rgba(201,168,76,0.15)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                Alias du dossier :
              </div>
              <div style={{
                fontSize: 18, fontWeight: 700, letterSpacing: '0.08em',
                color: newInitiale.trim() ? 'var(--accent-gold)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono, monospace)',
              }}>
                DOS-{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}-{newInitiale.toUpperCase() || '?'}
              </div>
            </div>

            {/* Erreur */}
            {newDialogError && (
              <div style={{
                marginBottom: 14, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#FCA5A5',
              }}>
                ⚠️ {newDialogError}
              </div>
            )}

            {/* Boutons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowNewDialog(false); setNewInitiale(''); setNewDialogError('') }}
                disabled={newCreating}
                className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>
                Annuler
              </button>
              <button
                onClick={() => void handleNew()}
                disabled={!newInitiale.trim() || newCreating}
                style={{
                  padding: '8px 22px', borderRadius: 8, border: 'none',
                  cursor: (newInitiale.trim() && !newCreating) ? 'pointer' : 'not-allowed',
                  background: (newInitiale.trim() && !newCreating)
                    ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))'
                    : 'rgba(255,255,255,0.05)',
                  color: (newInitiale.trim() && !newCreating) ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600, fontSize: 13,
                  transition: 'all 0.2s',
                  opacity: newCreating ? 0.7 : 1,
                }}>
                {newCreating ? '⏳ Création...' : 'Créer le dossier →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {confirmDel && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }} onClick={() => setConfirmDel(null)}>
          <div className="glass-card" style={{ padding: 28, maxWidth: 380, width: '90%', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Supprimer ce dossier ?</div>
            <div style={{ fontSize: 13, color: 'var(--accent-gold)', fontWeight: 600, marginBottom: 16 }}>{confirmDel}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
              Cette action est irréversible. Exportez le dossier en JSON avant de le supprimer si vous souhaitez le conserver.
            </div>
            {deleteError && (
              <div style={{ fontSize: 12, color: '#F87171', marginBottom: 12,
                padding: '8px 12px', borderRadius: 8,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                Erreur : {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => { setConfirmDel(null); setDeleteError('') }}
                disabled={deleting} className="btn-ghost">Annuler</button>
              <button
                onClick={() => void handleDelete(confirmDel!)}
                disabled={deleting}
                style={{
                  padding: '8px 20px', borderRadius: 10, border: 'none',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  background: '#EF4444', color: '#fff', fontWeight: 600, fontSize: 13,
                  opacity: deleting ? 0.6 : 1,
                }}>
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DossiersPage() {
  return <UnlockGate><DossiersContent /></UnlockGate>
}
