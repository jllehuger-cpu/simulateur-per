import Link from 'next/link';

const sections = [
  {
    href: '/civil',
    title: 'Aspect civil',
    subtitle: 'Organisation, transmission et protection',
    accent: 'from-violet-500 to-fuchsia-600',
    icon: (
      <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
  },
  {
    href: '/fiscal',
    title: 'Aspect fiscal',
    subtitle: 'Optimisation légale et impacts sur vos impôts',
    accent: 'from-blue-500 to-cyan-500',
    icon: (
      <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    href: '/financier',
    title: 'Aspect financier',
    subtitle: 'Allocation, rendement et horizon de placement',
    accent: 'from-emerald-500 to-teal-600',
    icon: (
      <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    ),
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="relative overflow-hidden bg-slate-900">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(59,130,246,0.35), transparent 45%), radial-gradient(circle at 80% 0%, rgba(168,85,247,0.3), transparent 40%)',
          }}
        />
        <header className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">
            Conseil patrimonial
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Une approche structurée de votre patrimoine
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300">
            Civil, fiscal et financier : trois axes pour clarifier vos enjeux et préparer vos décisions
            avec votre conseiller.
          </p>
        </header>
      </div>

      <main className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="-mt-16 grid gap-6 md:grid-cols-3 lg:-mt-24">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/60 transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div
                className={`flex h-24 items-center justify-center bg-gradient-to-br ${section.accent}`}
              >
                <div className="rounded-xl bg-white/15 p-3 ring-1 ring-white/30 backdrop-blur-sm">
                  {section.icon}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h2 className="text-xl font-bold text-slate-900 group-hover:text-blue-700">
                  {section.title}
                </h2>
                <p className="mt-2 flex-1 text-sm text-slate-600">{section.subtitle}</p>
                <span className="mt-6 inline-flex items-center text-sm font-semibold text-blue-600">
                  Accéder
                  <span className="ml-1 transition group-hover:translate-x-0.5">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>

        <section className="mt-16 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:p-10">
          <h2 className="text-lg font-bold text-slate-900">Accès sécurisé par espace</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Chaque section thématique est protégée par un code d&apos;accès commun (démonstration).
            Vous serez invité à le saisir avant d&apos;afficher le contenu.
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        Informations à caractère général — ne constituent pas un conseil personnalisé.
      </footer>
    </div>
  );
}
