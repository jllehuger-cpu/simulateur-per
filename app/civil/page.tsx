import Link from 'next/link';

export default function CivilPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
            Accueil
          </Link>
          <span className="text-sm text-slate-500">Aspect civil</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900">Aspect civil</h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Cet espace regroupera vos contenus sur la structuration patrimoniale, la protection de vos
          proches et la préparation de la transmission. Ajoutez vos guides, FAQ ou rendez-vous ici.
        </p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* CARTE DEMEMBREMENT */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-400 transition-colors">
              <h3 className="text-xl font-bold text-slate-800 mb-2">Démembrement de propriété</h3>
              <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                Évaluez la répartition entre Usufruit et Nue-Propriété selon le barème fiscal (Art. 669 CGI).
              </p>
              <Link 
                href="/civil/demembrement" 
                className="text-blue-600 font-semibold hover:text-blue-800 inline-flex items-center"
              >
                Lancer le simulateur →
              </Link>
            </div>

            {/* CARTE FUTURE (Succession/Donation par ex) */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 italic text-sm">
              Autres simulateurs civils à venir...
            </div>
          </div>
      </main>
    </div>
  );
}
