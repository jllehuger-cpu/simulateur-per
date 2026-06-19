'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { DossierPatrimonial, Partage } from '@/lib/types'
import { dechiffrerSnapshotClient, verifierPermissionEdition } from '@/lib/partage-cle'
import { analyserSuccession, REGIME_LABELS } from '@/lib/calcul-succession'

// ── Types internes ────────────────────────────────────────────────────────────

interface PartagePublic {
  id: string
  dossier_alias: string
  snapshot_chiffre: string | null
  snapshot_iv: string | null
  permissions: Partage['permissions']
  champs_editables: string[]
  status: string
  client_email: string | null
}

type TabId = 'identite' | 'famille' | 'patrimoine' | 'succession'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'identite',    label: 'Identité',   icon: '👤' },
  { id: 'famille',     label: 'Famille',    icon: '👨‍👩‍👧' },
  { id: 'patrimoine',  label: 'Patrimoine', icon: '💰' },
  { id: 'succession',  label: 'Succession', icon: '⚖️' },
]

// ── Helpers UI ────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="glass-card" style={{ padding: '1.25rem', ...style }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
      color: 'var(--accent-blue)', textTransform: 'uppercase' as const,
      borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8,
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function FieldRow({ label, value, editable, onChange }: {
  label: string
  value: string | undefined
  editable: boolean
  onChange?: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)',
        marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {label}
        {editable && <span style={{ fontSize: 10, color: 'var(--accent-emerald)', fontWeight: 600 }}>✏️ modifiable</span>}
      </div>
      {editable && onChange ? (
        <input
          className="glass-input"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          style={{ fontSize: 14 }}
        />
      ) : (
        <div style={{ fontSize: 14, color: 'var(--text-primary)', padding: '8px 10px',
          background: 'rgba(255,255,255,0.03)', borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.05)',
          opacity: value ? 1 : 0.4 }}>
          {value || '—'}
        </div>
      )}
    </div>
  )
}

function ListRow({ title, subtitle, right, rightSub }: {
  title: string; subtitle?: string; right?: string; rightSub?: string
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '8px 12px', marginBottom: 6,
      background: 'rgba(255,255,255,0.03)', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</div>}
      </div>
      {right && (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-gold)' }}>{right}</div>
          {rightSub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rightSub}</div>}
        </div>
      )}
    </div>
  )
}

// ── Onglet Famille ────────────────────────────────────────────────────────────

const LIEN_ENFANT_LABELS: Record<string, string> = {
  commun: 'Enfant commun', client_seul: 'Enfant du client', conjoint_seul: 'Enfant du conjoint',
}
const SITUATION_ENFANT_LABELS: Record<string, string> = {
  mineur: 'Mineur', etudiant: 'Étudiant', actif: 'Actif', marie: 'Marié(e)',
}

function FamilleTab({ dossier }: { dossier: DossierPatrimonial }) {
  const id = dossier.identite
  const sf = id.situation_familiale ?? 'celibataire'
  const aConjoint = ['marie', 'pacse', 'concubin'].includes(sf)
  const enfants = id.enfants ?? []
  const ascendantsVivants = (id.ascendants ?? []).filter(a => a.situation === 'vivant')
  const freresSoeurs = id.freres_soeurs ?? []

  return (
    <>
      {aConjoint && (
        <Card style={{ marginBottom: 16 }}>
          <SectionTitle>Conjoint</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FieldRow label="Âge du conjoint" value={id.age_conjoint ? `${id.age_conjoint} ans` : undefined} editable={false} />
            {id.statut_pro_conjoint && (
              <FieldRow label="Situation professionnelle" value={id.statut_pro_conjoint.replace(/_/g, ' ')} editable={false} />
            )}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>Enfants ({enfants.length})</SectionTitle>
        {enfants.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun enfant renseigné</div>
        ) : (
          enfants.map(e => (
            <ListRow
              key={e.id}
              title={`${LIEN_ENFANT_LABELS[e.lien] ?? e.lien} · ${e.age} ans`}
              subtitle={SITUATION_ENFANT_LABELS[e.situation] ?? e.situation}
            />
          ))
        )}
      </Card>

      {ascendantsVivants.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionTitle>Ascendants vivants ({ascendantsVivants.length})</SectionTitle>
          {ascendantsVivants.map(a => (
            <ListRow key={a.id} title={a.lien.replace(/_/g, ' ')} subtitle={a.age ? `${a.age} ans` : undefined} />
          ))}
        </Card>
      )}

      {freresSoeurs.length > 0 && (
        <Card>
          <SectionTitle>Frères &amp; sœurs ({freresSoeurs.length})</SectionTitle>
          {freresSoeurs.map(fs => (
            <ListRow key={fs.id} title={fs.alias || 'Frère / Sœur'} subtitle={`${fs.age} ans`} />
          ))}
        </Card>
      )}
    </>
  )
}

// ── Onglet Succession ─────────────────────────────────────────────────────────

function SuccessionTab({ dossier }: { dossier: DossierPatrimonial }) {
  const analyse = useMemo(() => analyserSuccession(dossier, 'client'), [dossier])
  const regime = dossier.identite.regime_matrimonial

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>Synthèse succession (simulation)</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
          <FieldRow label="Masse successorale estimée" value={`${Math.round(analyse.masseSuccessorale).toLocaleString('fr-FR')} €`} editable={false} />
          <FieldRow label="Réserve héréditaire" value={`${analyse.reserve}%`} editable={false} />
        </div>
        {regime && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Régime matrimonial : {REGIME_LABELS[regime]}
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>Héritiers</SectionTitle>
        {analyse.heritiers.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun héritier identifié</div>
        ) : (
          analyse.heritiers.map(h => (
            <ListRow
              key={h.id}
              title={h.label}
              subtitle={h.notes.join(' · ')}
              right={`${(analyse.montantsEuros[h.id] ?? 0).toLocaleString('fr-FR')} €`}
              rightSub={`${h.partPP}% PP`}
            />
          ))
        )}
      </Card>

      {analyse.alertes.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionTitle>Points d&apos;attention</SectionTitle>
          {analyse.alertes.map((a, i) => (
            <div key={i} style={{ fontSize: 12, color: '#FCD34D', marginBottom: 6, lineHeight: 1.5 }}>⚠️ {a}</div>
          ))}
        </Card>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        ℹ️ Simulation indicative basée sur le droit commun français — ne remplace pas une consultation notariale.
      </div>
    </>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function PageClientDossier() {
  const params      = useParams()
  const searchParams = useSearchParams()
  const alias  = params.alias as string
  const token  = searchParams.get('token') ?? ''

  const [partage,  setPartage]  = useState<PartagePublic | null>(null)
  const [dossier,  setDossier]  = useState<DossierPatrimonial | null>(null)
  const [phrase,   setPhrase]   = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [fetching, setFetching] = useState(true)
  const [tab,      setTab]      = useState<TabId>('identite')

  // Modifications locales non encore soumises
  const [edits, setEdits] = useState<Record<string, { ancien: string; nouveau: string }>>({})
  const [saving, setSaving]    = useState(false)
  const [saveOk, setSaveOk]    = useState(false)

  // 1. Charger le partage depuis l'API (sans auth)
  useEffect(() => {
    if (!token) { setFetching(false); return }
    fetch(`/api/partage?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((data: PartagePublic & { error?: string }) => {
        if (data.error) { setError(data.error); setFetching(false); return }
        setPartage(data)
        setFetching(false)
      })
      .catch(() => { setError('Impossible de contacter le serveur'); setFetching(false) })
  }, [token])

  // 2. Déverrouiller avec la phrase
  const handleDeverrouiller = useCallback(async () => {
    if (!partage?.snapshot_chiffre || !partage?.snapshot_iv) {
      setError('Snapshot introuvable — contactez votre conseiller')
      return
    }
    if (!phrase.trim()) { setError('Saisissez la phrase d\'accès'); return }
    setLoading(true); setError('')
    try {
      const d = await dechiffrerSnapshotClient(partage.snapshot_chiffre, partage.snapshot_iv, phrase.trim())
      setDossier(d)
      // Activer le partage si encore 'pending'
      if (partage.status === 'pending') {
        fetch(`/api/partage?token=${encodeURIComponent(token)}`, { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ champ: '__activate__', nouvelle_valeur: 'active' }) })
          .catch(() => {}) // best effort
      }
    } catch {
      setError('Phrase incorrecte — vérifiez les 3 mots fournis par votre conseiller')
    } finally {
      setLoading(false)
    }
  }, [partage, phrase, token])

  // 3. Modifier un champ
  const handleEdit = (champ: string, nouveau: string) => {
    const actuel = getChampValue(dossier!, champ)
    setEdits(prev => ({ ...prev, [champ]: { ancien: actuel ?? '', nouveau } }))
    setDossier(prev => {
      if (!prev) return prev
      return setChampValue(JSON.parse(JSON.stringify(prev)), champ, nouveau)
    })
  }

  // 4. Enregistrer les modifications
  const handleSauvegarder = async () => {
    if (!Object.keys(edits).length) return
    setSaving(true); setSaveOk(false)
    try {
      for (const [champ, { ancien, nouveau }] of Object.entries(edits)) {
        const r = await fetch(`/api/partage?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ champ, ancienne_valeur: ancien, nouvelle_valeur: nouveau }),
        })
        if (!r.ok) {
          const err = await r.json()
          throw new Error(err.error ?? 'Erreur serveur')
        }
      }
      setEdits({})
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // 5. Déconnexion — efface les données chargées en mémoire (pas de stockage serveur/local)
  const handleDeconnexion = () => {
    setDossier(null)
    setPhrase('')
    setEdits({})
    setError('')
    setTab('identite')
  }

  // ── Rendu : loading ──
  if (fetching) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Vérification du lien…
      </div>
    )
  }

  // ── Rendu : token invalide ──
  if (!token || (!partage && !fetching)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-card" style={{ maxWidth: 420, textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⛔</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Lien invalide ou expiré</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {error || 'Ce lien de partage est introuvable. Demandez un nouveau lien à votre conseiller.'}
          </div>
        </div>
      </div>
    )
  }

  // ── Rendu : écran de déverrouillage ──
  if (!dossier) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-card" style={{ maxWidth: 440, width: '100%', padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🔐</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
              Accès à votre dossier patrimonial
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
              Saisissez les 3 mots de passe fournis par votre conseiller.<br />
              Exemple : <em style={{ color: 'var(--accent-gold)' }}>soleil-montagne-42</em>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Phrase d&apos;accès (3 mots)
            </label>
            <input
              className="glass-input"
              type="text"
              value={phrase}
              onChange={e => setPhrase(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && void handleDeverrouiller()}
              placeholder="mot1-mot2-99"
              autoFocus
              style={{ fontSize: 16, letterSpacing: '0.05em' }}
            />
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

          <button
            onClick={() => void handleDeverrouiller()}
            disabled={loading || !phrase.trim()}
            style={{
              width: '100%', padding: '10px 0',
              background: loading || !phrase.trim()
                ? 'rgba(255,255,255,0.05)'
                : 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.12))',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 10, color: loading || !phrase.trim() ? 'var(--text-muted)' : '#34D399',
              fontWeight: 600, fontSize: 14, cursor: loading || !phrase.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳ Vérification…' : '🔓 Accéder à mon dossier'}
          </button>

          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, textAlign: 'center' }}>
            Vos données restent chiffrées et ne transitent pas sur le réseau.
          </div>
        </div>
      </div>
    )
  }

  // ── Rendu : dossier déverrouillé ──
  const partageX = partage!
  const canEdit  = (champ: string) => verifierPermissionEdition(partageX as unknown as import('@/lib/types').Partage, champ)
  const hasEdits = Object.keys(edits).length > 0

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Link href="/" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Retour
          </Link>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            Mon dossier patrimonial
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {alias} ·{' '}
            {partageX.permissions === 'edit_partial'
              ? <span style={{ color: 'var(--accent-emerald)' }}>✏️ Lecture &amp; écriture (champs limités)</span>
              : <span style={{ color: 'var(--accent-blue)' }}>👁 Consultation uniquement</span>
            }
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasEdits && (
            <button
              onClick={() => void handleSauvegarder()}
              disabled={saving}
              style={{
                padding: '8px 18px', borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(16,185,129,0.15))',
                border: '1px solid rgba(16,185,129,0.4)',
                color: '#34D399', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              {saving ? '⏳ Envoi…' : `💾 Envoyer (${Object.keys(edits).length})`}
            </button>
          )}
          <button
            onClick={() => window.print()}
            style={{
              padding: '8px 14px', borderRadius: 10,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--text-secondary)', fontWeight: 500, fontSize: 13, cursor: 'pointer',
            }}
          >
            🖨️ PDF
          </button>
          <button
            onClick={handleDeconnexion}
            style={{
              padding: '8px 14px', borderRadius: 10,
              background: 'transparent', border: '1px solid rgba(239,68,68,0.2)',
              color: '#FCA5A5', fontWeight: 500, fontSize: 13, cursor: 'pointer',
            }}
          >
            🚪 Déconnexion
          </button>
        </div>
      </div>

      {saveOk && (
        <div style={{ fontSize: 13, color: 'var(--accent-emerald)', marginBottom: 16 }}>
          ✅ Modifications transmises au conseiller
        </div>
      )}

      {error && (
        <div style={{
          fontSize: 13, color: '#FCA5A5', marginBottom: 16,
          padding: '10px 14px', background: 'rgba(239,68,68,0.08)',
          borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)',
        }}>
          ❌ {error}
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '0.625rem 1.125rem', background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: '0.875rem', fontWeight: tab === t.id ? 700 : 400, whiteSpace: 'nowrap',
            color: tab === t.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
            borderBottom: `2px solid ${tab === t.id ? 'var(--accent-blue)' : 'transparent'}`,
            marginBottom: -1, transition: 'color 0.15s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Onglet Identité */}
      {tab === 'identite' && (() => {
        const id = dossier.identite
        const sf = id.situation_familiale ?? 'celibataire'
        const SF_LABELS: Record<string, string> = {
          celibataire: 'Célibataire', marie: 'Marié(e)', pacse: 'Pacsé(e)',
          concubin: 'Concubin(e)', divorce: 'Divorcé(e)', veuf: 'Veuf / Veuve',
        }
        return (
          <>
            <Card style={{ marginBottom: 16 }}>
              <SectionTitle>Situation personnelle</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FieldRow label="Situation familiale" value={SF_LABELS[sf] ?? sf} editable={false} />
                <FieldRow label="Âge" value={id.age_client ? `${id.age_client} ans` : undefined} editable={false} />
                {id.regime_matrimonial && (
                  <FieldRow label="Régime matrimonial" value={id.regime_matrimonial.replace(/_/g, ' ')} editable={false} />
                )}
                {id.statut_pro_client && (
                  <FieldRow label="Situation professionnelle" value={id.statut_pro_client.replace(/_/g, ' ')} editable={false} />
                )}
              </div>
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <SectionTitle>Objectifs patrimoniaux</SectionTitle>
              <FieldRow
                label="Projet imminent"
                value={id.projet_imminent}
                editable={canEdit('identite.projet_imminent')}
                onChange={canEdit('identite.projet_imminent') ? v => handleEdit('identite.projet_imminent', v) : undefined}
              />
              {(id.objectifs ?? []).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Objectifs
                    {canEdit('identite.objectifs') && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent-emerald)' }}>✏️ modifiable</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(id.objectifs ?? []).map(obj => (
                      <span key={obj} style={{
                        fontSize: 12, padding: '4px 10px', borderRadius: 20,
                        background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                        color: 'var(--accent-blue)',
                      }}>{obj}</span>
                    ))}
                  </div>
                </div>
              )}
              <FieldRow
                label="Commentaire"
                value={id.objectifs_commentaire}
                editable={canEdit('identite.objectifs_commentaire')}
                onChange={canEdit('identite.objectifs_commentaire') ? v => handleEdit('identite.objectifs_commentaire', v) : undefined}
              />
            </Card>

            <Card>
              <SectionTitle>Notes &amp; informations complémentaires</SectionTitle>
              {canEdit('identite.notes_famille') ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Notes famille <span style={{ fontSize: 10, color: 'var(--accent-emerald)' }}>✏️ modifiable</span>
                  </div>
                  <textarea
                    className="glass-input"
                    rows={4}
                    value={id.notes_famille ?? ''}
                    onChange={e => handleEdit('identite.notes_famille', e.target.value)}
                    style={{ resize: 'vertical', lineHeight: 1.5, fontSize: 13 }}
                    placeholder="Informations complémentaires pour votre conseiller…"
                  />
                </div>
              ) : (
                <FieldRow label="Notes" value={id.notes_famille} editable={false} />
              )}
            </Card>
          </>
        )
      })()}

      {/* Onglet Famille */}
      {tab === 'famille' && <FamilleTab dossier={dossier} />}

      {/* Onglet Patrimoine — lecture seule */}
      {tab === 'patrimoine' && (
        <>
          {dossier.biens_immo.length === 0 && dossier.produits_financiers.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>Aucun patrimoine renseigné</div>
          )}
          {dossier.biens_immo.length > 0 && (
            <Card style={{ marginBottom: 16 }}>
              <SectionTitle>Patrimoine immobilier (lecture seule)</SectionTitle>
              {dossier.biens_immo.map(b => (
                <ListRow
                  key={b.id}
                  title={b.type}
                  subtitle={b.localisation || '—'}
                  right={b.valeur_venale > 0 ? b.valeur_venale.toLocaleString('fr-FR') + ' €' : '—'}
                  rightSub="valeur vénale"
                />
              ))}
            </Card>
          )}

          {dossier.produits_financiers.length > 0 && (
            <Card>
              <SectionTitle>Épargne &amp; placements (lecture seule)</SectionTitle>
              {dossier.produits_financiers.map(p => (
                <ListRow
                  key={p.id}
                  title={p.type}
                  subtitle={p.etablissement || '—'}
                  right={p.valeur_actuelle > 0 ? p.valeur_actuelle.toLocaleString('fr-FR') + ' €' : '—'}
                  rightSub="encours"
                />
              ))}
            </Card>
          )}
        </>
      )}

      {/* Onglet Succession */}
      {tab === 'succession' && <SuccessionTab dossier={dossier} />}

      {/* Disclaimer */}
      <div style={{
        fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6,
        padding: '12px 16px', marginTop: 16,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
      }}>
        📋 Ce dossier est une copie chiffrée partagée par votre conseiller à la date du partage.
        Les données affichées peuvent différer du dossier actualisé.
        Les modifications que vous enregistrez sont transmises à votre conseiller pour validation.
      </div>
    </div>
  )
}

// ── Helpers pour accéder/modifier les champs imbriqués ───────────────────────

function getChampValue(dossier: DossierPatrimonial, champ: string): string | undefined {
  const parts = champ.split('.')
  let cur: unknown = dossier
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : (cur != null ? String(cur) : undefined)
}

function setChampValue(dossier: DossierPatrimonial, champ: string, valeur: string): DossierPatrimonial {
  const parts = champ.split('.')
  let cur: Record<string, unknown> = dossier as unknown as Record<string, unknown>
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}
    cur = cur[parts[i]] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = valeur
  return dossier
}
