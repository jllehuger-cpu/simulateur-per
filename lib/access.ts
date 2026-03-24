/** Code d'accès temporaire aux espaces thématiques (client-side). */
export const SECTION_ACCESS_CODE = 'CONSEIL2026';

export type SectionKey = 'civil' | 'fiscal' | 'financier';

export function sectionStorageKey(section: SectionKey): string {
  return `patrimoine-auth:${section}`;
}
