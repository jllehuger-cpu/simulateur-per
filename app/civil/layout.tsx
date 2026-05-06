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
      <nav className="bg-white border-b border-slate-200 sticky top-[60px] z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center h-12 gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  isActive(link.href) ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <div className="py-6">{children}</div>
    </div>
  );
}