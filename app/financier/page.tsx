import Link from 'next/link';

export default function FinancierPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
            Accueil
          </Link>
          <span className="text-sm text-slate-500">Aspect financier</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900">Aspect financier</h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Préparez ici vos modules sur l&apos;horizon de placement, la diversification et le suivi de
          performance. Les simulateurs dédiés pourront compléter cet espace.
        </p>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">Contenu à venir.</p>
        </div>
      </main>
    </div>
  );
}
