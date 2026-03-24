import { SectionAuthGate } from '@/components/section-auth-gate';

export default function FiscalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SectionAuthGate
      sectionKey="fiscal"
      title="Espace fiscal"
      description="Optimisation légale, dispositifs déductibles et impacts sur le revenu imposable."
    >
      {children}
    </SectionAuthGate>
  );
}
