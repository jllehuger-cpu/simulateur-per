'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Home, FolderOpen, SearchCheck, BarChart3,
  Settings, LogOut, Shield, Eye, EyeOff, Menu, X,
} from 'lucide-react'
import { useAuth } from '@/lib/use-auth'
import { useIdentiteVisible } from '@/lib/use-identite-visible'
import { identiteDisponible, isCleSessionUnlocked } from '@/lib/crypto'
import { CleBModal } from '@/components/cle-b-modal'

// ─── Types ───────────────────────────────────────────────────
interface NavLink {
  href: string
  label: string
  Icon: React.ElementType
  accent?: 'purple' | 'blue' | 'emerald' | 'gold'
  badge?: (quota: number, used: number) => React.ReactNode
}

// ─── Config liens CGP ────────────────────────────────────────
const NAV_CGP: NavLink[] = [
  { href: '/',           label: 'Accueil',           Icon: Home       },
  { href: '/dossiers',   label: 'Mes dossiers',       Icon: FolderOpen },
  {
    href: '/audit',
    label: 'Audit IA',
    Icon: SearchCheck,
    accent: 'purple',
    badge: (quota, used) => {
      if (quota >= 999999) return null
      const r = Math.max(0, quota - used)
      return (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
          background: r === 0 ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.08)',
          color: r === 0 ? '#F87171' : 'var(--text-muted)',
        }}>
          {r}
        </span>
      )
    },
  },
  { href: '/patrimoine', label: 'Bilan & Succession', Icon: BarChart3, accent: 'gold' },
]

const NAV_CLIENT: NavLink[] = [
  { href: '/client',            label: 'Mon patrimoine', Icon: Home      },
  { href: '/client/financier',  label: 'Mes placements', Icon: BarChart3 },
]

const NAV_PUBLIC: NavLink[] = [
  { href: '/', label: 'Accueil', Icon: Home },
]

// ─── Couleurs accent ────────────────────────────────────────
const ACCENT_COLORS = {
  purple:  { rgb: '139,92,246',  hex: '#A78BFA' },
  blue:    { rgb: '59,130,246',  hex: '#60A5FA' },
  emerald: { rgb: '16,185,129',  hex: '#34D399' },
  gold:    { rgb: '201,168,76',  hex: '#C9A84C' },
}

// ─── Composant ───────────────────────────────────────────────
export function Navbar() {
  const pathname               = usePathname()
  const [open, setOpen]        = useState(false)
  const [showCleB, setShowCleB] = useState(false)
  const { user, profil }       = useAuth(false)
  const { visible: idVis, toggle: toggleId } = useIdentiteVisible()
  const role                   = profil?.role ?? 'cgp'

  const navLinks = user
    ? (role === 'client' ? NAV_CLIENT : NAV_CGP)
    : NAV_PUBLIC

  const quota = profil?.api_quota ?? 0
  const used  = profil?.api_used  ?? 0

  const displayName = profil?.nom || user?.email || ''
  const initials = displayName
    ? displayName.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase()
    : ''

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname?.startsWith(href) ?? false
  }

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(8,11,20,0.80)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '0 1.25rem', height: 60,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: '1.5rem',
      }}>

        {/* ── 1. LOGO ─────────────────────────────────────── */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', flexShrink: 0 }}>
          <span style={{
            width: 33, height: 33, borderRadius: 9,
            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.8rem', fontWeight: 800, color: '#fff',
            boxShadow: '0 0 16px rgba(99,102,241,0.45)',
            letterSpacing: '-0.02em',
          }}>
            AP
          </span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.95rem', fontWeight: 650,
            color: 'var(--text-primary)', letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
          }}>
            Audit Patrimoine
          </span>
        </Link>

        {/* ── 2. NAV CENTRE (desktop) ─────────────────────── */}
        <nav className="nav-desktop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {navLinks.map(({ href, label, Icon, accent, badge }) => {
            const active = isActive(href)
            const ac     = accent ? ACCENT_COLORS[accent] : ACCENT_COLORS.blue
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 13px', borderRadius: 9,
                  fontSize: '0.84rem', fontWeight: active ? 600 : 450,
                  textDecoration: 'none',
                  color: active ? '#fff' : accent ? ac.hex : 'var(--text-secondary)',
                  background: active ? `rgba(${ac.rgb},0.16)` : 'transparent',
                  border: active ? `1px solid rgba(${ac.rgb},0.3)` : '1px solid transparent',
                  transition: 'all 0.18s',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    ;(e.currentTarget as HTMLAnchorElement).style.background = `rgba(${ac.rgb},0.08)`
                    ;(e.currentTarget as HTMLAnchorElement).style.color = active ? '#fff' : '#e2e8f0'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    ;(e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLAnchorElement).style.color = accent ? ac.hex : 'var(--text-secondary)'
                  }
                }}
              >
                <Icon size={15} style={{ flexShrink: 0, opacity: active ? 1 : 0.8 }} />
                {label}
                {accent === 'purple' && !active && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 4, background: 'rgba(139,92,246,0.2)', color: '#A78BFA', letterSpacing: '0.05em' }}>
                    IA
                  </span>
                )}
                {badge && profil && badge(quota, used)}
              </Link>
            )
          })}
        </nav>

        {/* ── 3. ACTIONS DROITE ────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {user ? (
            <>
              {/* Badge Admin */}
              {profil?.role === 'admin' && (
                <Link href="/admin" style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 9px', borderRadius: 7,
                  fontSize: 11, fontWeight: 600, textDecoration: 'none',
                  color: '#A78BFA', background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.25)',
                }}>
                  <Shield size={12} />
                  Admin
                </Link>
              )}

              {/* Bouton visibilité identités */}
              {role !== 'client' && identiteDisponible() && (
                <button
                  onClick={toggleId}
                  title={idVis ? 'Masquer les identités' : 'Afficher les identités'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 9px', borderRadius: 7, cursor: 'pointer',
                    background: idVis ? 'rgba(127,119,221,0.14)' : 'transparent',
                    border: idVis ? '1px solid rgba(127,119,221,0.4)' : '1px solid rgba(255,255,255,0.1)',
                    transition: 'all 0.18s',
                  }}
                >
                  {idVis
                    ? <Eye size={13} style={{ color: '#7B77DD' }} />
                    : <EyeOff size={13} style={{ color: 'var(--text-muted)' }} />
                  }
                  <span style={{ fontSize: 10, fontWeight: 600, color: idVis ? '#7B77DD' : 'var(--text-muted)' }}>
                    {idVis ? 'ON' : 'OFF'}
                  </span>
                </button>
              )}

              {/* Badge utilisateur connecté */}
              <div title={`${displayName} · Connecté`} className="nav-user-badge" style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '3px 10px 3px 3px', borderRadius: 20,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: '#fff',
                }}>
                  {initials}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                  maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {displayName}
                </span>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: '#34D399', boxShadow: '0 0 6px rgba(52,211,153,0.7)',
                }} />
              </div>

              {/* Clé B (identité) */}
              {role !== 'client' && isCleSessionUnlocked() && (
                <button
                  onClick={() => setShowCleB(true)}
                  title="Gérer la Clé B (identité)"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: 7,
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    transition: 'all 0.18s', fontSize: 14,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
                >
                  🔑
                </button>
              )}

              {/* Settings */}
              <Link href="/settings" title="Paramètres" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 7,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-muted)', textDecoration: 'none',
                transition: 'all 0.18s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)' }}
              >
                <Settings size={14} />
              </Link>

              {/* Logout */}
              <a href="/api/auth/logout" title="Déconnexion" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 7,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-muted)', textDecoration: 'none',
                transition: 'all 0.18s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLAnchorElement).style.color = '#F87171'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(239,68,68,0.25)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.1)' }}
              >
                <LogOut size={14} />
              </a>
            </>
          ) : (
            <Link href="/login" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8,
              fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.03em',
              color: 'var(--text-secondary)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              textDecoration: 'none',
              transition: 'all 0.18s',
            }}>
              <Shield size={13} />
              Se connecter
            </Link>
          )}

          {/* Burger mobile */}
          <button
            type="button"
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setOpen(v => !v)}
            className="nav-burger"
            style={{
              display: 'none',
              alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36,
              background: open ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.18s',
            }}
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {/* ── Menu mobile dropdown ─────────────────────────────── */}
      {open && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '10px 18px 16px',
          background: 'rgba(8,11,20,0.95)',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {navLinks.map(({ href, label, Icon, accent }) => {
            const active = isActive(href)
            const ac     = accent ? ACCENT_COLORS[accent] : ACCENT_COLORS.blue
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 13px', borderRadius: 9,
                  fontSize: '0.9rem', fontWeight: 500,
                  textDecoration: 'none',
                  color: active ? '#fff' : accent ? ac.hex : 'var(--text-secondary)',
                  background: active ? `rgba(${ac.rgb},0.15)` : 'transparent',
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}

          {/* Divider + profil + actions mobile */}
          {user && (
            <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px' }}>
                <span style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff',
                }}>
                  {initials}
                </span>
                <span style={{
                  flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {displayName}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#34D399' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', boxShadow: '0 0 6px rgba(52,211,153,0.7)' }} />
                  Connecté
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href="/settings" onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Settings size={13} /> Paramètres
                </Link>
                <a href="/api/auth/logout" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, fontSize: 13, color: '#F87171', textDecoration: 'none', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <LogOut size={13} /> Déconnexion
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .nav-desktop    { display: none !important; }
          .nav-burger     { display: flex !important; }
          .nav-user-badge { display: none !important; }
        }
      `}</style>

      {showCleB && <CleBModal onClose={() => setShowCleB(false)} />}
    </header>
  )
}
