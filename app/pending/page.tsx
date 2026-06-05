'use client'
import { useRouter } from 'next/navigation'
import { seDeconnecter } from '@/lib/auth-supabase'

export default function PendingPage() {
  const router = useRouter()

  const handleLogout = async () => {
    await seDeconnecter()
    router.push('/login')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: 24
    }}>
      <div className="glass-card" style={{
        padding: 48, maxWidth: 460, width: '100%',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🕐</div>
        <h1 style={{
          fontSize: 22, fontWeight: 700, marginBottom: 12,
          letterSpacing: '-0.02em'
        }}>Demande d&apos;accès en attente</h1>
        <p style={{
          fontSize: 14, color: 'var(--text-secondary)',
          lineHeight: 1.7, marginBottom: 12
        }}>
          Votre compte a bien été créé. Un administrateur doit valider
          votre accès avant que vous puissiez utiliser la plateforme.
        </p>
        <p style={{
          fontSize: 13, color: 'var(--text-muted)',
          lineHeight: 1.6, marginBottom: 32
        }}>
          Vous recevrez un email dès que votre accès sera activé.
        </p>
        <button
          onClick={() => void handleLogout()}
          className="btn-ghost"
          style={{ fontSize: 13 }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
