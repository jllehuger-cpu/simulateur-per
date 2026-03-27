'use client';

import { SectionAccessProvider } from '@/components/section-access-context';
import { type SectionKey } from '@/lib/access';

type Props = {
  sectionKey: SectionKey;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function SectionAuthGate({
  sectionKey: _sectionKey,
  title: _title,
  description: _description = 'Saisissez le code fourni par votre conseiller pour accéder à cet espace.',
  children,
}: Props) {
  return <SectionAccessProvider password="">{children}</SectionAccessProvider>;
}
