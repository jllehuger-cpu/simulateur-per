Tu travailles sur le projet simulateur-patrimoine (Next.js 16, React 19, TypeScript strict, Tailwind 4).
Voici 4 tâches à réaliser dans l'ordre. Ne passe à la suivante qu'une fois la précédente terminée et vérifiée.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TÂCHE 1 — CORRIGER LES SECTIONS VIDES DE L'AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Dans `app/audit/page.tsx`, la fonction qui parse la réponse Claude en sections
cherche des marqueurs précis qui ne correspondent plus au nouveau prompt.

Localise la fonction de parsing (cherche `bilan_financier`, `zones_risque`, `recommandations`).
Remplace la logique de découpage par celle-ci :

```ts
function parseAuditSections(raw: string): AuditSections {
  // Marqueurs à détecter (insensible à la casse, avec ou sans emoji)
  const markers = {
    bilan_civil:      /#{1,3}\s*.*?(profil|bilan civil|situation civil)/i,
    bilan_fiscal:     /#{1,3}\s*.*?(fiscal|revenus|fiscalit)/i,
    bilan_financier:  /#{1,3}\s*.*?(bilan financier|patrimoine|actif|passif)/i,
    zones_risque:     /#{1,3}\s*.*?(risque|zone)/i,
    recommandations:  /#{1,3}\s*.*?(pr.conisation|recommandation|action|synth)/i,
  }

  const lines = raw.split('\n')
  const sectionStarts: { key: keyof AuditSections; line: number }[] = []

  lines.forEach((line, idx) => {
    for (const [key, regex] of Object.entries(markers)) {
      if (regex.test(line)) {
        // N'ajouter que si pas déjà détecté pour cette clé
        if (!sectionStarts.find(s => s.key === key)) {
          sectionStarts.push({ key: key as keyof AuditSections, line: idx })
        }
      }
    }
  })

  sectionStarts.sort((a, b) => a.line - b.line)

  const result: AuditSections = {
    bilan_civil: '', bilan_fiscal: '', bilan_financier: '',
    zones_risque: '', recommandations: '', raw
  }

  sectionStarts.forEach((section, idx) => {
    const start = section.line
    const end = sectionStarts[idx + 1]?.line ?? lines.length
    result[section.key] = lines.slice(start, end).join('\n').trim()
  })

  // Fallback : si aucune section détectée, tout mettre dans bilan_financier
  const hasContent = Object.entries(result)
    .filter(([k]) => k !== 'raw')
    .some(([, v]) => (v as string).length > 0)
  if (!hasContent) {
    result.bilan_financier = raw
  }

  return result
}
```

Vérifie que `AuditSections` a bien les 5 clés + `raw`.
Teste en lançant un audit depuis `/saisie` — les 3 sections doivent s'afficher.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TÂCHE 2 — EXPORT EXCEL DEPUIS UN DOSSIER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Dans `lib/dossiers.ts`, ajouter une fonction `exporterDossierExcel(dossier: DossierPatrimonial): void`
qui génère un fichier .xlsx à partir du JSON du dossier, téléchargeable côté client.

Utiliser uniquement des APIs browser natives (pas de librairie externe).
Stratégie : générer un CSV multi-feuilles simulé en HTML table, converti en .xls (format SYLK ou HTML-Excel).
C'est compatible Excel sans dépendance npm.

Format du fichier généré `${dossier.alias}_export.xls` :
- Feuille 1 "Identité" : tous les champs de `dossier.identite` (clé | valeur)
- Feuille 2 "Revenus" : tous les champs de `dossier.revenus`
- Feuille 3 "Immobilier" : une ligne par bien (colonnes = clés de BienImmo)
- Feuille 4 "Financier" : une ligne par produit (colonnes = clés de ProduitFinancier)
- Feuille 5 "Prévoyance" : tous les champs de `dossier.prevoyance`

Implémentation HTML-Excel (fonctionne nativement dans Excel) :
```ts
export function exporterDossierExcel(dossier: DossierPatrimonial): void {
  // Construire le HTML avec plusieurs feuilles via <table> séparées par des noms de feuille
  // Utiliser le format URI data:application/vnd.ms-excel
  // Une feuille = une <table> précédée d'un <tr> avec le nom de la feuille
  // Télécharger via un lien <a> temporaire
}
```

Dans `app/dossiers/page.tsx`, ajouter un bouton "↓ Excel" à côté de chaque dossier dans la liste,
qui appelle `exporterDossierExcel(dossier)`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TÂCHE 3 — MIGRATION SUPABASE + SCHÉMA BDD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Installer le client Supabase :
```bash
npm install @supabase/supabase-js
```

Créer `lib/supabase.ts` :
```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnon)
```

Créer `lib/db-dossiers.ts` — fonctions CRUD Supabase qui REMPLACENT le localStorage
pour la persistance longue durée (le localStorage reste en cache local) :

```ts
// Schéma de la table Supabase (à créer manuellement dans le dashboard Supabase) :
// CREATE TABLE dossiers (
//   alias        TEXT PRIMARY KEY,
//   created_at   TIMESTAMPTZ DEFAULT now(),
//   updated_at   TIMESTAMPTZ DEFAULT now(),
//   data_chiffre TEXT NOT NULL,   -- JSON chiffré AES-256-GCM côté client
//   iv           TEXT NOT NULL,   -- Vecteur d'initialisation (base64)
//   audit_result TEXT,            -- Résultat audit en clair (pas de données perso)
//   has_audit    BOOLEAN DEFAULT false
// );

export async function sauvegarderDossierDB(alias: string, dataChiffre: string, iv: string, auditResult?: string) { }
export async function listerDossiersDB(): Promise<{ alias: string; updated_at: string; has_audit: boolean }[]> { }
export async function getDossierDB(alias: string): Promise<{ data_chiffre: string; iv: string; audit_result?: string } | null> { }
export async function supprimerDossierDB(alias: string): Promise<void> { }
```

Ajouter dans `.env.local` (indiquer juste les noms de variables, pas les valeurs) :
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TÂCHE 4 — CHIFFREMENT AES-256-GCM CÔTÉ CLIENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Créer `lib/crypto.ts` — chiffrement/déchiffrement via Web Crypto API (natif browser, zéro dépendance) :

```ts
// La clé de chiffrement est dérivée d'un mot de passe saisi par le CGP
// Elle ne quitte JAMAIS le navigateur — Supabase ne voit que du texte chiffré

const SALT = 'heritum-cgp-v1' // fixe, public — la sécurité vient du mot de passe

export async function deriverCle(motDePasse: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(motDePasse), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(SALT), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function chiffrer(data: string, cle: CryptoKey): Promise<{ chiffre: string; iv: string }> {
  const enc = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const buffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, enc.encode(data))
  return {
    chiffre: btoa(String.fromCharCode(...new Uint8Array(buffer))),
    iv: btoa(String.fromCharCode(...iv))
  }
}

export async function dechiffrer(chiffre: string, iv: string, cle: CryptoKey): Promise<string> {
  const dec = new TextDecoder()
  const buffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Uint8Array.from(atob(iv), c => c.charCodeAt(0)) },
    cle,
    Uint8Array.from(atob(chiffre), c => c.charCodeAt(0))
  )
  return dec.decode(buffer)
}

// Stocker la clé dérivée en mémoire session (jamais en localStorage)
let _cleSession: CryptoKey | null = null
export function setCleSession(cle: CryptoKey) { _cleSession = cle }
export function getCleSession(): CryptoKey | null { return _cleSession }
export function clearCleSession() { _cleSession = null }
```

Créer `components/unlock-gate.tsx` — composant qui demande le mot de passe CGP au démarrage :
- S'affiche devant `/dossiers` et `/saisie` si la clé de session n'est pas définie
- Champ mot de passe + bouton "Déverrouiller"
- Au submit : appelle `deriverCle(password)` → `setCleSession(cle)` → affiche l'enfant
- Design glassmorphism dark cohérent avec le reste du projet

Modifier `lib/dossiers.ts` pour que `sauvegarderDossier` et `listerDossiers` :
1. Chiffrent le JSON du dossier avec `getCleSession()` avant de le mettre en localStorage ET en Supabase
2. Déchiffrent à la lecture
3. Si `getCleSession()` est null → lever une erreur "Session verrouillée"

Ajouter dans `app/dossiers/page.tsx` et `app/saisie/page.tsx` :
```tsx
import { UnlockGate } from '@/components/unlock-gate'
// Wrapper le contenu de la page :
return <UnlockGate>{/* contenu existant */}</UnlockGate>
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VÉRIFICATION FINALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. `npx tsc --noEmit` → zéro erreur
2. `npm run dev` → pas d'erreur console
3. `/dossiers` → UnlockGate s'affiche, saisir un mot de passe → accès
4. Créer un dossier → rempli en 7 étapes → générer audit → les 5 sections s'affichent
5. Depuis la liste dossiers → bouton "↓ Excel" → fichier téléchargé
6. Vérifier dans Supabase dashboard que la ligne est insérée avec `data_chiffre` non lisible

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARCHITECTURE RÉSULTANTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Supabase ne stocke que :
- L'alias (DOS-2025-001) → pas de donnée personnelle
- Le JSON patrimonial chiffré AES-256-GCM → illisible sans le mot de passe CGP
- Le résultat de l'audit en clair → pas de donnée personnelle (montants anonymisés)

La table de correspondance alias ↔ nom réel reste exclusivement chez le CGP
(fichier local chiffré ou tête du CGP).