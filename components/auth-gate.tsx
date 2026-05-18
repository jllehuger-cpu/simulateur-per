'use client';

import { useState, useEffect, useRef } from 'react';
import { verifyPassword } from '@/lib/auth';

const STORAGE_KEY = 'auth:verified';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ok = sessionStorage.getItem(STORAGE_KEY) === 'true';
    setVerified(ok);
  }, []);

  useEffect(() => {
    if (verified === false) inputRef.current?.focus();
  }, [verified]);

  if (verified === null) return null;

  if (!verified) {
    const handleSubmit = (e?: React.FormEvent) => {
      e?.preventDefault();
      if (verifyPassword(input)) {
        sessionStorage.setItem(STORAGE_KEY, 'true');
        setVerified(true);
      } else {
        setError(true);
        setInput('');
        inputRef.current?.focus();
      }
    };

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}>
        <div className="glass-card" style={{
          maxWidth: 420, width: '100%',
          padding: '2.5rem 2rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: '1rem' }}>🔐</div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.4rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 0.5rem',
          }}>
            Accès sécurisé
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
            Saisissez le mot de passe pour accéder à ce simulateur.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input
              ref={inputRef}
              type="password"
              value={input}
              onChange={e => { setInput(e.target.value); setError(false); }}
              placeholder="Mot de passe"
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 8,
                border: error ? '1.5px solid #EF4444' : '1.5px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {error && (
              <p style={{ color: '#EF4444', fontSize: '0.85rem', margin: 0 }}>
                Mot de passe incorrect. Veuillez réessayer.
              </p>
            )}
            <button
              type="submit"
              style={{
                padding: '0.75rem',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent-blue)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              Accéder →
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
