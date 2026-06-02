// ─────────────────────────────────────────────────────────
//  ALIAS — Génération et gestion des dossiers anonymisés
//  Stockage : localStorage chiffré AES-256-GCM + Supabase optionnel
// ─────────────────────────────────────────────────────────

import { DossierPatrimonial, STORAGE_KEY } from './types'
import { getCleSession, chiffrer, dechiffrer } from './crypto'
import { sauvegarderDossierDB, supprimerDossierDB } from './db-dossiers'
import { sauvegarderMeta } from './db-identite'

interface StoredEntry {
  alias: string
  chiffre: string
  iv: string
}

// ── Génération d'alias (sync — compteur séparé non chiffré) ──
export function genererAlias(): string {
  if (typeof window === 'undefined') return `DOS-${new Date().getFullYear()}-001`
  const year = new Date().getFullYear()
  const counterKey = `cgp_counter_${year}`
  const next = parseInt(localStorage.getItem(counterKey) ?? '0') + 1
  localStorage.setItem(counterKey, String(next))
  return `DOS-${year}-${String(next).padStart(3, '0')}`
}

// ── CRUD localStorage chiffré ─────────────────────────────
export async function listerDossiers(): Promise<DossierPatrimonial[]> {
  if (typeof window === 'undefined') return []
  const cle = getCleSession()
  if (!cle) throw new Error('Session verrouillée')
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const entries = JSON.parse(raw) as StoredEntry[]
    const results = await Promise.all(
      entries.map(async ({ chiffre, iv }) => {
        try {
          const json = await dechiffrer(chiffre, iv, cle)
          return JSON.parse(json) as DossierPatrimonial
        } catch {
          return null
        }
      })
    )
    return results.filter(Boolean) as DossierPatrimonial[]
  } catch {
    return []
  }
}

export async function getDossier(alias: string): Promise<DossierPatrimonial | null> {
  const all = await listerDossiers()
  return all.find(d => d.alias === alias) ?? null
}

export async function sauvegarderDossier(dossier: DossierPatrimonial): Promise<void> {
  const cle = getCleSession()
  if (!cle) throw new Error('Session verrouillée')
  const json = JSON.stringify(dossier)
  const { chiffre, iv } = await chiffrer(json, cle)
  let entries: StoredEntry[] = []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) entries = JSON.parse(raw) as StoredEntry[]
  } catch { /* start fresh */ }
  entries = entries.filter(e => e.alias !== dossier.alias)
  entries.push({ alias: dossier.alias, chiffre, iv })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  try {
    await sauvegarderDossierDB(dossier.alias, chiffre, iv, dossier.audit_result)
    console.log('[Supabase] ✅ sync OK:', dossier.alias)
  } catch (err) {
    console.error('[Supabase] ❌ sync failed:', JSON.stringify(err))
  }
  try {
    await sauvegarderMeta(dossier.alias, dossier as unknown as Record<string, unknown>)
  } catch (err) {
    console.warn('[Meta] sync failed silently:', err)
  }
}

export async function supprimerDossier(alias: string): Promise<void> {
  const cle = getCleSession()
  if (!cle) throw new Error('Session verrouillée')
  let entries: StoredEntry[] = []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) entries = JSON.parse(raw) as StoredEntry[]
  } catch { /* */ }
  entries = entries.filter(e => e.alias !== alias)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  try {
    await supprimerDossierDB(alias)
  } catch { /* */ }
}

export function nouveauDossier(): DossierPatrimonial {
  const now = new Date().toISOString()
  return {
    alias: genererAlias(),
    created_at: now,
    updated_at: now,
    identite: {
      enfants: [],
      objectifs: [],
    },
    revenus: {
      taux_cotisations_client: 0.22,
      taux_cotisations_conjoint: 0.22,
    },
    biens_immo: [],
    produits_financiers: [],
    prevoyance: {},
  }
}

// ── Normalisation → JSON pour le prompt Claude ───────────
export function normaliserPourPrompt(d: DossierPatrimonial): string {
  const r = d.revenus

  const tauxC  = r.taux_cotisations_client  ?? 0.22
  const tauxCo = r.taux_cotisations_conjoint ?? 0.22
  // Épargne salariale soumise à 7% CSG/CRDS uniquement (pas les cotisations sociales)
  const netSalaireClient   = ((r.salaire_base_brut_client   ?? 0) + (r.primes_brut_client   ?? 0)) * (1 - tauxC)
                            + (r.epargne_salariale_brut_client ?? 0) * (1 - 0.07)
  const netSalaireConjoint = ((r.salaire_base_brut_conjoint ?? 0) + (r.primes_brut_conjoint ?? 0)) * (1 - tauxCo)
                            + (r.epargne_salariale_brut_conjoint ?? 0) * (1 - 0.07)

  const totalFinancier  = d.produits_financiers.reduce((s, p) => s + (p.valeur_actuelle ?? 0), 0)
  const totalImmoValeur = d.biens_immo.reduce((s, b) => s + (b.valeur_venale ?? 0), 0)
  const totalCRD        = d.biens_immo.reduce((s, b) => s + (b.crd ?? 0), 0)

  return JSON.stringify({
    alias: d.alias,
    identite: { ...d.identite },
    revenus: {
      ...r,
      _net_salaire_client_calcule:   Math.round(netSalaireClient),
      _net_salaire_conjoint_calcule: Math.round(netSalaireConjoint),
    },
    biens_immo:          d.biens_immo,
    produits_financiers: d.produits_financiers,
    prevoyance:          d.prevoyance,
    _synthese: {
      patrimoine_immo_brut:  totalImmoValeur,
      total_crd:             totalCRD,
      patrimoine_immo_net:   totalImmoValeur - totalCRD,
      patrimoine_financier:  totalFinancier,
      patrimoine_brut_total: totalImmoValeur + totalFinancier,
      patrimoine_net_total:  totalImmoValeur + totalFinancier - totalCRD,
    },
  }, null, 2)
}

// ── Export JSON (téléchargement local) ───────────────────
export function exporterDossierJSON(dossier: DossierPatrimonial): void {
  const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${dossier.alias}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Import JSON ───────────────────────────────────────────
export function importerDossierJSON(file: File): Promise<DossierPatrimonial> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (!data.alias) throw new Error('Fichier invalide : alias manquant')
        resolve(data as DossierPatrimonial)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsText(file)
  })
}

// ── Export Excel — SpreadsheetML (multi-feuilles, natif Excel) ──
export function exporterDossierExcel(dossier: DossierPatrimonial): void {
  const esc = (v: unknown): string => {
    let s = ''
    if (v == null) s = ''
    else if (typeof v === 'object') s = JSON.stringify(v)
    else s = String(v)
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  const cell = (v: unknown) =>
    `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`

  const kvSheet = (name: string, obj: Record<string, unknown>) => {
    const rows = Object.entries(obj)
      .map(([k, v]) => `<Row>${cell(k)}${cell(v)}</Row>`)
      .join('\n')
    return `<Worksheet ss:Name="${esc(name)}"><Table>\n<Row>${cell('Clé')}${cell('Valeur')}</Row>\n${rows}\n</Table></Worksheet>`
  }

  const tableSheet = (name: string, items: Record<string, unknown>[]) => {
    if (!items.length) {
      return `<Worksheet ss:Name="${esc(name)}"><Table>\n<Row>${cell('Aucune donnée')}</Row>\n</Table></Worksheet>`
    }
    const headers   = Object.keys(items[0])
    const headerRow = `<Row>${headers.map(h => cell(h)).join('')}</Row>`
    const dataRows  = items.map(item =>
      `<Row>${headers.map(h => cell(item[h])).join('')}</Row>`
    ).join('\n')
    return `<Worksheet ss:Name="${esc(name)}"><Table>\n${headerRow}\n${dataRows}\n</Table></Worksheet>`
  }

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${kvSheet('Identité',   dossier.identite   as Record<string, unknown>)}
${kvSheet('Revenus',    dossier.revenus     as Record<string, unknown>)}
${tableSheet('Immobilier', dossier.biens_immo          as unknown as Record<string, unknown>[])}
${tableSheet('Financier',  dossier.produits_financiers as unknown as Record<string, unknown>[])}
${kvSheet('Prévoyance', dossier.prevoyance  as Record<string, unknown>)}
</Workbook>`

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${dossier.alias}_export.xls`
  a.click()
  URL.revokeObjectURL(url)
}
