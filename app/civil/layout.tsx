'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CivilLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  const navLinks = [
    { name: 'Démembrement', href: '/civil/demembrement' },
    { name: 'Donation', href: '/civil/donation' },
    { name: 'Succession', href: '/civil/succession' },
    { name: 'Audit Expert', href: '/civil/donation/audit' },
  ];

  return (
    <div>
      <nav style={{
        background: 'rgba(8,11,20,0.72)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        position: 'sticky',
        top: 60,
        zIndex: 40,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 44, gap: '0.25rem' }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: '0.3rem 0.85rem',
                  borderRadius: 8,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  color: isActive(link.href) ? '#fff' : 'var(--text-secondary)',
                  background: isActive(link.href) ? 'rgba(59,130,246,0.18)' : 'transparent',
                  border: isActive(link.href) ? '1px solid rgba(59,130,246,0.35)' : '1px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <div style={{ padding: '1.5rem 0' }}>{children}</div>
    </div>
  );
}
