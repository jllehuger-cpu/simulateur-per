'use client';

import Link from 'next/link';

const simulateurs = [
  {
    href: '/civil/demembrement',
    icon: '⚖️',
    title: 'Démembrement',
    description: "Usufruit fiscal (Art. 669 CGI) vs usufruit économique selon les tables INSEE.",
    badge: 'Transmission',
    color: '#6366F1',
    gradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
  },
  {
    href: '/civil/donation',
    icon: '🎁',
    title: 'Donation',
    description: 'Droits de mutation, abattements et progressivité du barème.',
    badge: 'Fiscal',
    color: '#10B981',
    gradient: 'linear-gradient(135deg, #10B981, #0D9488)',
  },
  {
    href: '/civil/succession',
    icon: '📜',
    title: 'Succession',
    description: 'Droits de succession, dévolution légale et réserve héréditaire.',
    badge: 'Transmission',
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)',
  },
  {
    href: '/civil/clause-beneficiaire',
    icon: '📝',
    title: 'Clause bénéficiaire',
    description: 'Générez une clause personnalisée et juridiquement robuste en 5 étapes.',
    badge: 'Rédaction',
    color: '#4338CA',
    gradient: 'linear-gradient(135deg, #6366F1, #4338CA)',
  },
  {
    href: '/civil/personnes-protegees',
    icon: '🛡️',
    title: 'Personnes protégées',
    description: 'Mineurs · Curatelle · Tutelle · MPF — Régimes, actes autorisés et assurance-vie.',
    badge: 'Protection',
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B, #B45309)',
  },
  {
    href: '/fiscal/succession-av',
    icon: '🏦',
    title: 'Assurance-vie',
    description: 'Rachat fiscal, articles 990i et 757B, imposition des capitaux décès.',
    badge: '990i / 757B',
    color: '#EC4899',
    gradient: 'linear-gradient(135deg, #EC4899, #BE185D)',
  },
];

const documents = [
  {
    href: '/expert',
    icon: '📊',
    title: 'Audit Expert',
    description: 'Analyse complète de votre situation patrimoniale.',
    color: '#6366F1',
  },
];

export default function CivilHomePage() {
  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', padding: '3rem 1.25rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '3rem' }}>
        <p style={{
          fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem',
        }}>
          Audit Patrimoine
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2rem, 4vw, 3rem)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          margin: 0,
        }}>
          Pôle Civil
        </h1>
        <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 520 }}>
          Organisation, transmission et protection patrimoniale.
        </p>
      </div>

      {/* Section 1 — Simulateurs */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.8rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          margin: '0 0 1.25rem',
        }}>
          Simulateurs
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: '1.25rem',
        }}>
          {simulateurs.map(s => (
            <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
              <div
                className="glass-card sim-card"
                style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', '--card-color': s.color } as React.CSSProperties}
              >
                <div style={{
                  height: 72,
                  background: s.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                }}>
                  {s.icon}
                </div>
                <div style={{ padding: '1.125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <h3 style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.05rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      margin: 0,
                    }}>
                      {s.title}
                    </h3>
                    <span className="badge badge-blue" style={{ flexShrink: 0, marginLeft: 8, fontSize: '0.7rem' }}>{s.badge}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 0.875rem' }}>
                    {s.description}
                  </p>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: s.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Accéder →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Section 2 — Documents */}
      <section>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.8rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          margin: '0 0 1.25rem',
        }}>
          Documents
        </h2>
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
          {documents.map(d => (
            <Link key={d.href} href={d.href} style={{ textDecoration: 'none', flex: '0 0 auto', minWidth: 260 }}>
              <div
                className="glass-card"
                style={{
                  padding: '1.25rem 1.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  borderLeft: `3px solid ${d.color}`,
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: 28 }}>{d.icon}</div>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: '0 0 0.25rem',
                  }}>
                    {d.title}
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
                    {d.description}
                  </p>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: d.color }}>Accéder →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <style>{`
        .sim-card {
          transition: transform 0.2s, border-color 0.2s;
        }
        .sim-card:hover {
          transform: translateY(-3px);
          border-color: var(--card-color, var(--accent-blue)) !important;
        }
      `}</style>
    </div>
  );
}
