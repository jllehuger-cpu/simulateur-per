import Link from 'next/link';

export default function FiscalPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
            Accueil
          </Link>
          <span className="text-sm text-slate-500">Aspect fiscal</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900">Aspect fiscal</h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Outils et ressources pour visualiser l&apos;impact fiscal de vos choix (PER, défiscalisation,
          etc.).
        </p>
        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <li>
            <Link
              href="/fiscal/per"
              className="group block h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-slate-900 group-hover:text-blue-700">
                Simulateur PER
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Estimez l&apos;économie d&apos;impôt et l&apos;effet de seuil sur votre TMI.
              </p>
              <span className="mt-3 inline-block text-sm font-medium text-blue-600">
                Ouvrir le simulateur →
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/fiscal/declaration-revenus"
              className="group block h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-slate-900 group-hover:text-blue-700">
                Aide à la Déclaration
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Optimisez vos frais réels et vérifiez vos réductions d&apos;impôts.
              </p>
              <span className="mt-3 inline-block text-sm font-medium text-blue-600">
                Accéder à l&apos;assistant →
              </span>
            </Link>
          </li>
        </ul>
      </main>
    </div>
  );
}
