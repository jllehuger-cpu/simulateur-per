'use client';

import { AuthGate } from '@/components/auth-gate';
import Link from 'next/link';
import { SimulateurPer } from '@/components/simulators/simulateur-per';

export default function FiscalPerPage() {
  return (
    <AuthGate>
      <>
        {/* Fil d'Ariane */}
        <div style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '0.6rem 1.25rem',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <Link
              href="/fiscal"
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                transition: 'color 0.2s',
              }}
            >
              ← Espace fiscal
            </Link>
          </div>
        </div>

        <SimulateurPer />
      </>
    </AuthGate>
  );
}
