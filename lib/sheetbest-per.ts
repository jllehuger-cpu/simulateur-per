/**
 * Archivage des saisies simulateur PER (Sheet.best → Google Sheets).
 * Surcharge possible via NEXT_PUBLIC_SHEETBEST_PER_URL.
 */
export const SHEETBEST_PER_ARCHIVE_URL =
  process.env.NEXT_PUBLIC_SHEETBEST_PER_URL ??
  'https://api.sheetbest.com/sheets/3987f30b-7a1a-49ac-876e-c0b2058c032c';

/** Clés alignées sur les colonnes du tableur. */
export type PerSheetArchiveRow = {
  Date_Heure: string;
  password: string;
  age: number;
  Revenu_Annuel: number;
  Versement_PER: number;
  Economie_Impot: number;
};

export function formatDateHeureFr(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function postPerRowToSheetbest(row: PerSheetArchiveRow): Promise<void> {
  const res = await fetch(SHEETBEST_PER_ARCHIVE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
}
