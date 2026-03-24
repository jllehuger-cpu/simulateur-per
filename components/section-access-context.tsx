'use client';

import { createContext, useContext } from 'react';

type SectionAccessContextValue = {
  password: string;
};

const SectionAccessContext = createContext<SectionAccessContextValue>({
  password: '',
});

export function SectionAccessProvider({
  password,
  children,
}: {
  password: string;
  children: React.ReactNode;
}) {
  return (
    <SectionAccessContext.Provider value={{ password }}>
      {children}
    </SectionAccessContext.Provider>
  );
}

export function useSectionAccessPassword(): string {
  return useContext(SectionAccessContext).password;
}
