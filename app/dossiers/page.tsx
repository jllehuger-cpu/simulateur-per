'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DossierPatrimonial } from '@/lib/types'
import {
  listerDossiers, supprimerDossier, nouveauDossier,
  sauvegarderDossier, importerDossierJSON, exporterDossierExcel,
} from '@/lib/dossiers'
import { identiteDisponible } from '@/lib/crypto'
import { lireToutes, sauvegarderIdentite, IdentiteProspect } from '@/lib/db-identite'
import { UnlockGate } from '@/components/unlock-gate'
import { useAuth } from '@/lib/use-auth'

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
  const { loading: authLoading } = useAuth()
  const [dossiers,   setDossiers]   = useState<DossierPatrimonial[]>([])
  const [search,     setSearch]     = useState('')
  const [confirmDel,    setConfirmDel]    = useState<string | null>(null)
  const [identites,     setIdentites]     = useState<Map<string, IdentiteProspect>>(new Map())
  const [modalId,       setModalId]       = useState<string | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newInitiale,   setNewInitiale]   = useState('')

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

  useEffect(() => {
    void reload()
    void reloadIdentites()
  }, [reload, reloadIdentites])

  if (authLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Chargement...</div>

  const handleNew = async () => {
    const lettre = newInitiale.trim().charAt(0).toUpperCase()
    const d = nouveauDossier(lettre || undefined)
    await sauvegarderDossier(d)
    setShowNewDialog(false)
    setNewInitiale('')
    router.push(`/saisie?alias=${d.alias}`)
  }

  const handleDelete = async (alias: string) => {
    await supprimerDossier(alias)
    setConfirmDel(null)
    void reload()
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
            const pat      = patrimoine(d)
            const hasAudit = !!d.audit_result
            const identite = identites.get(d.alias)
            const nomAffiche = identite
              ? `${identite.prenom} ${identite.nom}`
              : null
            return (
              <div key={d.alias} className="glass-card" style={{
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 16,
                cursor: 'pointer', transition: 'all 0.2s'
              }}
                onClick={() => router.push(`/saisie?alias=${d.alias}`)}
              >
                {/* Icône statut */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  background: hasAudit ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${hasAudit ? 'rgba(16,185,129,0.25)' : 'var(--border-glass)'}`,
                }}>
                  {hasAudit ? '✅' : '📝'}
                </div>

                {/* Infos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {nomAffiche ? (
                      <>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {nomAffiche}
                          {identites.get(d.alias)?.prenom_conjoint && identites.get(d.alias)?.nom_conjoint && (
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                              {' '}&amp; {identites.get(d.alias)!.prenom_conjoint} {identites.get(d.alias)!.nom_conjoint!.toUpperCase()}
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 12 }}>
                    <span>Modifié le {fmtDate(d.updated_at)}</span>
                    {d.biens_immo.length > 0 && <span>🏢 {d.biens_immo.length} bien{d.biens_immo.length > 1 ? 's' : ''}</span>}
                    {d.produits_financiers.length > 0 && <span>📈 {d.produits_financiers.length} produit{d.produits_financiers.length > 1 ? 's' : ''}</span>}
                  </div>
                </div>

                {/* Patrimoine net */}
                {pat > 0 && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-emerald)' }}>{fmt(pat)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>patrimoine net</div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
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

      {/* Dialog nouvelle initiale */}
      {showNewDialog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
          backdropFilter: 'blur(4px)',
        }} onClick={() => { setShowNewDialog(false); setNewInitiale('') }}>
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

            {/* Boutons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowNewDialog(false); setNewInitiale('') }}
                className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>
                Annuler
              </button>
              <button onClick={() => void handleNew()}
                disabled={!newInitiale.trim()}
                style={{
                  padding: '8px 22px', borderRadius: 8, border: 'none',
                  cursor: newInitiale.trim() ? 'pointer' : 'not-allowed',
                  background: newInitiale.trim()
                    ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))'
                    : 'rgba(255,255,255,0.05)',
                  color: newInitiale.trim() ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600, fontSize: 13,
                  transition: 'all 0.2s',
                }}>
                Créer le dossier →
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
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDel(null)} className="btn-ghost">Annuler</button>
              <button onClick={() => void handleDelete(confirmDel!)} style={{
                padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: '#EF4444', color: '#fff', fontWeight: 600, fontSize: 13
              }}>Supprimer</button>
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
