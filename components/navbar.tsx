'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/use-auth';
import { seDeconnecter } from '@/lib/auth-supabase';

const NAV_LINKS_AUTH: { href: string; label: string; icon: string; accent?: boolean }[] = [
  { href: '/audit',      label: 'Audit IA',       icon: '🔍', accent: true },
  { href: '/dossiers',   label: 'Dossiers',        icon: '📁' },
  { href: '/saisie',     label: 'Nouvelle saisie', icon: '✏️' },
];

const NAV_LINKS_PUBLIC: { href: string; label: string; icon: string; accent?: boolean }[] = [
  { href: '/civil',      label: 'Civil',           icon: '⚖️' },
  { href: '/fiscal',     label: 'Fiscal',          icon: '📊' },
  { href: '/financier',  label: 'Financier',       icon: '💼' },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, profil } = useAuth(false);
  const navLinks = user ? [...NAV_LINKS_AUTH, ...NAV_LINKS_PUBLIC] : NAV_LINKS_PUBLIC;

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(8,11,20,0.72)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 1.25rem',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#fff',
              boxShadow: '0 0 14px rgba(99,102,241,0.5)',
              flexShrink: 0,
            }}
          >
            AP
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            Audit Patrimoine
          </span>
        </Link>

        {/* Nav desktop */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
          className="hidden-mobile"
        >
          {navLinks.map((link) => {
            const active = pathname?.startsWith(link.href);
            const accentColor = link.accent ? '#8B5CF6' : '#3B82F6';
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.85rem',
                  borderRadius: 8,
                  fontSize: '0.875rem',
                  fontWeight: link.accent ? 700 : 500,
                  textDecoration: 'none',
                  color: active ? '#fff' : link.accent ? '#A78BFA' : 'var(--text-secondary)',
                  background: active ? `rgba(${link.accent ? '139,92,246' : '59,130,246'},0.18)` : 'transparent',
                  border: active ? `1px solid rgba(${link.accent ? '139,92,246' : '59,130,246'},0.35)` : '1px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: '0.8rem' }}>{link.icon}</span>
                {link.label}
                {link.accent && !active && (
                  <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: 4, background: 'rgba(139,92,246,0.2)', color: accentColor, fontWeight: 700, letterSpacing: '0.04em' }}>
                    IA
                  </span>
                )}
                {link.href === '/audit' && (() => {
                  const q = profil?.api_quota ?? 0;
                  const u = profil?.api_used ?? 0;
                  if (!profil || q >= 999999) return null;
                  const r = Math.max(0, q - u);
                  const c = r === 0 ? '#F87171' : 'var(--text-muted)';
                  return (
                    <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: 4, background: r === 0 ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.08)', color: c, fontWeight: 700 }}>
                      {r}
                    </span>
                  );
                })()}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {profil?.role === 'admin' && (
                <Link
                  href="/admin"
                  style={{
                    padding: '4px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                    textDecoration: 'none',
                    color: '#A78BFA',
                    background: 'rgba(139,92,246,0.1)',
                    border: '1px solid rgba(139,92,246,0.25)',
                  }}
                >
                  🛡️ Admin
                </Link>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {user.email}
              </span>
              <button
                onClick={async () => {
                  await seDeconnecter();
                  router.push('/login');
                }}
                className="btn-ghost"
                style={{ fontSize: 11, padding: '4px 10px' }}
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1rem',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: 'var(--text-secondary)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                textDecoration: 'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Se connecter
            </Link>
          )}

          {/* Burger mobile */}
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
            className="show-mobile"
          >
            {menuOpen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.07)',
            padding: '0.75rem 1.25rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          {navLinks.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 8,
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  color: active ? '#fff' : link.accent ? '#A78BFA' : 'var(--text-secondary)',
                  background: active ? `rgba(${link.accent ? '139,92,246' : '59,130,246'},0.15)` : 'transparent',
                }}
              >
                <span>{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .hidden-mobile { display: none !important; }
          .show-mobile   { display: flex !important; }
        }
      `}</style>
    </header>
  );
}

