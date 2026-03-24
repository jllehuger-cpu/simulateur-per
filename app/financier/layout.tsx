import { SectionAuthGate } from '@/components/section-auth-gate';

export default function FinancierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SectionAuthGate
      sectionKey="financier"
      title="Espace financier"
      description={
        "Allocation d'actifs, rendement, risque et soutien à la décision d'investissement."
      }
    >
      {children}
    </SectionAuthGate>
  );
}
