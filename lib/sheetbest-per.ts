/**
 * Archivage des saisies simulateur PER (Sheet.best → Google Sheets).
 * Surcharge possible via NEXT_PUBLIC_SHEETBEST_PER_URL.
 */
export const SHEETBEST_PER_ARCHIVE_URL =
  'https://api.sheetbest.com/sheets/3987f30b-7a1a-49ac-876e-c0b2058c032c';

/** Clés alignées sur les colonnes du tableur. */
export type PerSheetArchiveRow = {
  Date_Heure: string;
  password: string;
  age: number;
  Statut_Fiscal: string;
  // Legacy (colonne existante) : base utilisée historiquement
  Revenu_Annuel: number;
  // Nouveaux champs (outil d'expertise fiscale)
  Revenu_Fiscal_de_Reference: number;
  Nombre_Parts_Fiscales: number;
  Revenu_Brut_Global: number;
  Plafond_Deductibilite_PER_2026: number;
  // Noms de colonnes simplifiés (ajoutés dans le fichier Excel)
  RFR: number;
  Nombre_Parts: number;
  Revenu_Brut: number;
  Plafond_PER: number;
  Versement_PER: number;
  // Plafonnement du quotient familial (approximation pédagogique)
  Plafonnement_QF_Cap_DemiPart_Supplementaire_EUR: number;
  Plafonnement_QF_Cap_Avant_EUR: number;
  Plafonnement_QF_Cap_Apres_EUR: number;
  Plafonnement_QF_Actif_Avant: number; // 0/1 pour Sheets
  Plafonnement_QF_Actif_Apres: number; // 0/1 pour Sheets
  // Economies sur l'impôt sur le revenu uniquement (hors CEHR)
  Economie_Impot: number;
  // CEHR (estimée)
  CEHR_Avant: number;
  CEHR_Apres: number;
  Economie_CEHR: number;
  // Economie totale estimée (IR + CEHR)
  Economie_Totale: number;
  // Impôt théorique (IR uniquement)
  Impot_IR_Avant: number;
  Impot_IR_Apres: number;
  // Impôt théorique (IR + CEHR)
  Impot_Theorique_Total_Avant: number;
  Impot_Theorique_Total_Apres: number;
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
