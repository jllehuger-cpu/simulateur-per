'use client'
import { useAuth } from '@/lib/use-auth'

export default function ClientDashboard() {
  const { loading } = useAuth()

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Chargement...
    </div>
  )

  return (
    <div style={{ maxWidth: 800, margin: '60px auto', padding: '0 20px' }}>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600,
        color: 'var(--text-primary)', marginBottom: 8,
      }}>
        Mon espace patrimoine
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
        Bienvenue. Votre conseiller en gestion de patrimoine a partagé votre bilan avec vous.
      </p>

      <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
        <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>🔒</span>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Saisissez votre clé d&apos;accès pour consulter votre patrimoine.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Cette clé vous a été communiquée par votre conseiller.
        </p>
      </div>
    </div>
  )
}
