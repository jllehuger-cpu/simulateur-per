'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SectionAccessProvider } from '@/components/section-access-context';
import {
  SECTION_ACCESS_CODE,
  type SectionKey,
  sectionPasswordStorageKey,
  sectionStorageKey,
} from '@/lib/access';

type Props = {
  sectionKey: SectionKey;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function SectionAuthGate({
  sectionKey,
  title,
  description = 'Saisissez le code fourni par votre conseiller pour accéder à cet espace.',
  children,
}: Props) {
  const [phase, setPhase] = useState<'check' | 'locked' | 'unlocked'>('check');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [accessPassword, setAccessPassword] = useState('');

  useEffect(() => {
    try {
      const ok =
        typeof window !== 'undefined' &&
        sessionStorage.getItem(sectionStorageKey(sectionKey)) === '1';
      if (ok) {
        setAccessPassword(
          sessionStorage.getItem(sectionPasswordStorageKey(sectionKey)) ?? ''
        );
        setPhase('unlocked');
      } else {
        setPhase('locked');
      }
    } catch {
      setPhase('locked');
    }
  }, [sectionKey]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (trimmed === SECTION_ACCESS_CODE) {
      try {
        sessionStorage.setItem(sectionStorageKey(sectionKey), '1');
        sessionStorage.setItem(sectionPasswordStorageKey(sectionKey), trimmed);
      } catch {
        // sessionStorage indisponible (navigation privée stricte, etc.)
      }
      setAccessPassword(trimmed);
      setPhase('unlocked');
      return;
    }
    setError('Code incorrect. Vérifiez votre saisie ou contactez votre conseiller.');
  }

  if (phase === 'check') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <p className="text-sm text-slate-600">Chargement…</p>
      </div>
    );
  }

  if (phase === 'locked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Accès restreint
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{description}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor={`access-${sectionKey}`}
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Code d&apos;accès
              </label>
              <input
                id={`access-${sectionKey}`}
                type="password"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••••"
              />
            </div>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Accéder
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            <Link href="/" className="text-blue-600 hover:underline">
              Retour à l&apos;accueil
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <SectionAccessProvider password={accessPassword}>{children}</SectionAccessProvider>
  );
}
