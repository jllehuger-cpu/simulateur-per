import { SectionAuthGate } from '@/components/section-auth-gate';

export default function CivilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SectionAuthGate
      sectionKey="civil"
      title="Espace civil"
      description="Doctrine du patrimoine, transmission, organisation personnelle et successions."
    >
      {children}
    </SectionAuthGate>
  );
}
