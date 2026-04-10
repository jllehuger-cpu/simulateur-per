'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CivilLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  const navLinks = [
    { name: 'Démembrement', href: '/civil/demembrement' },
    { name: 'Donation', href: '/civil/donation' },
    { name: 'Succession', href: '/civil/succession' },
    { name: 'Audit Expert', href: '/civil/donation/audit' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xs">L</div>
                <span className="text-slate-900 font-bold tracking-tight text-lg">LABS <span className="text-slate-400 font-light">PATRIMONIAL</span></span>
              </div>
              
              <div className="flex gap-2">
                {navLinks.map((link) => (
                  <Link 
                    key={link.href}
                    href={link.href} 
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      isActive(link.href) ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>
      <div className="py-6">{children}</div>
    </div>
  );
}