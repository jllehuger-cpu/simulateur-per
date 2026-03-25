import Link from 'next/link';
import { SimulateurPer } from '@/components/simulators/simulateur-per';

export default function FiscalPerPage() {
  return (
    <>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl justify-start px-4 py-3">
          <Link
            href="/fiscal"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Retour à l&apos;espace fiscal
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-2xl px-4 py-4">
        <h1 className="text-xl font-semibold text-slate-900">
          Option B (Expert) - Simulateur PER
        </h1>
      </div>
      <SimulateurPer />
    </>
  );
}
