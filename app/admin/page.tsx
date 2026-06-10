'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'

interface AdminUser {
  id: string
  email: string
  role: string
  status: string
  api_used: number
  api_quota: number
  api_quota_reset_at: string | null
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  active:  'Actif',
  pending: 'En attente',
  blocked: 'Bloqué',
}

const STATUS_COLOR: Record<string, string> = {
  active:  '#34D399',
  pending: '#FBBF24',
  blocked: '#F87171',
}

const ROLE_LABEL: Record<string, string> = {
  admin:             'Admin',
  cgp:               'CGP',
  client:            'Client',
  expert_comptable:  'Expert-comptable',
}

export default function AdminPage() {
  const router = useRouter()
  const { profil, loading: authLoading } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingQuota, setEditingQuota] = useState<{ id: string; value: string } | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && profil?.role !== 'admin') {
      router.push('/dossiers')
    }
  }, [authLoading, profil, router])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const json = await res.json() as { users?: AdminUser[]; error?: string }
      if (json.error) { setError(json.error); return }
      setUsers(json.users ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && profil?.role === 'admin') {
      void fetchUsers()
    }
  }, [authLoading, profil, fetchUsers])

  const updateUser = async (id: string, updates: { status?: string; api_quota?: number; role?: string }) => {
    setSaving(id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, updates }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (json.error) { setError(json.error); return }
      await fetchUsers()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(null)
    }
  }

  const saveQuota = async (id: string, value: string) => {
    const quota = parseInt(value, 10)
    if (isNaN(quota) || quota < 0) return
    await updateUser(id, { api_quota: quota })
    setEditingQuota(null)
  }

  if (authLoading || (!authLoading && profil?.role !== 'admin')) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Chargement...</div>
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px', maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
          🛡️ Administration
        </h1>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          {users.length} utilisateur{users.length > 1 ? 's' : ''} enregistré{users.length > 1 ? 's' : ''}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Chargement...</div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Email', 'Statut', 'Rôle', 'Audits utilisés', 'Quota', 'Inscrit le', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--text-muted)'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{
                  borderBottom: i < users.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: saving === u.id ? 'rgba(255,255,255,0.02)' : 'transparent',
                }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{u.email}</td>

                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 600,
                      color: STATUS_COLOR[u.status] ?? 'var(--text-muted)',
                      background: `${STATUS_COLOR[u.status] ?? '#94A3B8'}15`,
                      border: `1px solid ${STATUS_COLOR[u.status] ?? '#94A3B8'}30`,
                    }}>
                      {STATUS_LABEL[u.status] ?? u.status}
                    </span>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={u.role}
                      onChange={e => void updateUser(u.id, { role: e.target.value })}
                      disabled={saving === u.id}
                      style={{
                        background: 'var(--bg-surface-md)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: 6, padding: '4px 8px', fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="cgp">CGP</option>
                      <option value="client">Client</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {u.api_used ?? 0}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    {editingQuota?.id === u.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="number"
                          value={editingQuota.value}
                          onChange={e => setEditingQuota({ id: u.id, value: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void saveQuota(u.id, editingQuota.value)
                            if (e.key === 'Escape') setEditingQuota(null)
                          }}
                          style={{
                            width: 64, padding: '4px 8px', borderRadius: 6,
                            border: '1px solid rgba(99,102,241,0.4)',
                            background: 'rgba(99,102,241,0.08)',
                            color: 'var(--text-primary)', fontSize: 13,
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => void saveQuota(u.id, editingQuota.value)}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#6366F1', color: '#fff', fontWeight: 600 }}
                        >✓</button>
                        <button
                          onClick={() => setEditingQuota(null)}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)' }}
                        >✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingQuota({ id: u.id, value: String(u.api_quota ?? 10) })}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: 'var(--text-secondary)', fontSize: 13, padding: 0,
                          textDecoration: 'underline dotted',
                        }}
                      >
                        {u.api_quota ?? 10}
                      </button>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    {u.created_at ? fmtDate(u.created_at) : '—'}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {u.status === 'pending' && (
                        <button
                          onClick={() => void updateUser(u.id, { status: 'active' })}
                          disabled={saving === u.id}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11,
                            background: 'rgba(52,211,153,0.12)', color: '#34D399', fontWeight: 600,
                          }}
                        >
                          Activer
                        </button>
                      )}
                      {u.status === 'active' && (
                        <button
                          onClick={() => void updateUser(u.id, { status: 'blocked' })}
                          disabled={saving === u.id}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11,
                            background: 'rgba(239,68,68,0.08)', color: '#F87171', fontWeight: 600,
                          }}
                        >
                          Bloquer
                        </button>
                      )}
                      {u.status === 'blocked' && (
                        <button
                          onClick={() => void updateUser(u.id, { status: 'active' })}
                          disabled={saving === u.id}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11,
                            background: 'rgba(52,211,153,0.12)', color: '#34D399', fontWeight: 600,
                          }}
                        >
                          Débloquer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
