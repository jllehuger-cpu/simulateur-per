'use client';

import Link from 'next/link';

const simulateurs = [
  {
    href: '/fiscal/per',
    icon: '💰',
    title: 'Simulateur PER',
    description: "Estimez l'économie d'impôt et l'effet de seuil sur votre TMI.",
    badge: 'Retraite',
    gradient: 'linear-gradient(135deg, #3B82F6, #4F46E5)',
  },
  {
    href: '/fiscal/ir',
    icon: '🧮',
    title: 'Simulateur IR',
    description: 'Calculez votre impôt sur le revenu, quotient familial et tranche marginale d\'imposition.',
    badge: 'IR',
    gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
  },
  {
    href: '/fiscal/declaration-revenus',
    icon: '📋',
    title: 'Aide à la Déclaration',
    description: 'Optimisez vos frais réels et vérifiez vos réductions d\'impôts.',
    badge: 'Déclaration',
    gradient: 'linear-gradient(135deg, #10B981, #0D9488)',
  },
];

export default function FiscalPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 1.25rem' }}>
      <div style={{ marginBottom: '3rem' }}>
        <p style={{
          fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem',
        }}>
          Audit Patrimoine · Axe fiscal
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          margin: 0,
        }}>
          Aspect fiscal
        </h1>
        <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 520 }}>
          Optimisation légale, dispositifs déductibles et impacts sur le revenu imposable. Sélectionnez un simulateur.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {simulateurs.map(s => (
          <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
            <div
              className="glass-card"
              style={{ padding: 0, overflow: 'hidden', transition: 'transform 0.2s, border-color 0.2s', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'}
            >
              <div style={{
                height: 80,
                background: s.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
              }}>
                {s.icon}
              </div>
              <div style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.2rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}>
                    {s.title}
                  </h2>
                  <span className="badge badge-blue" style={{ flexShrink: 0, marginLeft: 8 }}>{s.badge}</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {s.description}
                </p>
                <div style={{ marginTop: '1rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Accéder <span style={{ transition: 'transform 0.2s' }}>→</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
