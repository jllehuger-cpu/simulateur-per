'use client';

import Link from 'next/link';

export default function CivilHomePage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-black text-slate-900 mb-2">PÔLE CIVIL</h1>
        <p className="text-slate-500">Sélectionnez l'outil d'ingénierie patrimoniale souhaité</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Carte Démembrement */}
        <Link href="/civil/demembrement" className="group p-8 bg-white rounded-3xl border-2 border-slate-100 hover:border-blue-500 transition-all shadow-sm">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
            <span className="text-2xl group-hover:scale-110 transition-transform">⚖️</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Démembrement</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Comparez l'usufruit fiscal (Art. 669 CGI) et l'usufruit économique selon les tables INSEE.
          </p>
        </Link>

        {/* Carte Donation */}
        <Link href="/civil/donation" className="group p-8 bg-white rounded-3xl border-2 border-slate-100 hover:border-blue-500 transition-all shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 transition-colors">
            <span className="text-2xl group-hover:scale-110 transition-transform">🎁</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Donation</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Simulez les droits de mutation, les abattements et la progressivité du barème.
          </p>
        </Link>
      </div>
    </div>
  );
}