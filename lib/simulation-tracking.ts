export type SimulationTrackingPayload = Record<string, unknown>;

/**
 * Point d'entrée pour l'envoi des résultats de simulation (Google Sheets, API, etc.).
 * Pour l'instant : journalisation côté client pour vérifier le flux.
 */
export function logSimulationComplete(payload: SimulationTrackingPayload): void {
  const entry = {
    type: 'simulation_complete',
    at: new Date().toISOString(),
    ...payload,
  };
  console.log('[patrimoine] simulation terminée', entry);
}
