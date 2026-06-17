// Chiffrement AES-256-GCM côté client — zéro dépendance externe
// La clé ne quitte JAMAIS le navigateur

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
    true,   // exportable pour dérivation HMAC par dossier
    ['encrypt', 'decrypt']
  )
}

/**
 * Dérive une clé AES-256 unique pour un dossier via HMAC(clé maître, alias).
 * Rapide car la clé maître est déjà forte (pas besoin de PBKDF2).
 */
export async function deriverCleDossier(cleMaitre: CryptoKey, alias: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const masterBytes = await crypto.subtle.exportKey('raw', cleMaitre)
  const hmacKey = await crypto.subtle.importKey(
    'raw', masterBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const derivedBytes = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(alias))
  return crypto.subtle.importKey(
    'raw', derivedBytes, { name: 'AES-GCM', length: 256 },
    true,   // exportable pour le partage client
    ['encrypt', 'decrypt']
  )
}

const MOTS_PARTAGE = [
  'soleil', 'montagne', 'riviere', 'etoile', 'jardin', 'ocean', 'colline', 'prairie',
  'aurore', 'cascade', 'nuage', 'foret', 'sentier', 'vallee', 'source', 'horizon',
  'aube', 'brise', 'clairiere', 'dune', 'eclat', 'falaise', 'glacier', 'herbe',
  'iris', 'jade', 'kayak', 'lac', 'marais', 'nectar', 'oasis', 'palme',
  'quartz', 'rosee', 'sable', 'tempete', 'univers', 'vague', 'wagon', 'xenon',
  'yacht', 'zenith', 'abricot', 'bambou', 'cerise', 'dahlia', 'erable', 'figue',
  'genoise', 'hibiscus', 'indigo', 'jasmin', 'kiwi', 'lavande', 'mangue', 'noisette',
  'olive', 'pivoine', 'raisin', 'safran', 'tulipe', 'vanille', 'acacia', 'bouton',
]

export async function genererPhrasePartage(cleDossier: CryptoKey): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.exportKey('raw', cleDossier))
  const mot1 = MOTS_PARTAGE[bytes[0] % MOTS_PARTAGE.length]
  const mot2 = MOTS_PARTAGE[bytes[1] % MOTS_PARTAGE.length]
  const nombre = (bytes[2] % 90) + 10
  return `${mot1}-${mot2}-${nombre}`
}

export async function phraseVersCleDossier(phrase: string): Promise<CryptoKey> {
  return deriverCle(phrase + '_partage')
}

export async function exporterCle(cle: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', cle)
}

export async function importerCle(bytes: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', bytes, { name: 'AES-GCM', length: 256 },
    true, ['encrypt', 'decrypt']
  )
}

export async function chiffrer(data: string, cle: CryptoKey): Promise<{ chiffre: string; iv: string }> {
  const enc = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const buffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, enc.encode(data))
  return {
    chiffre: btoa(String.fromCharCode(...new Uint8Array(buffer))),
    iv: btoa(String.fromCharCode(...iv)),
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

// Clé de session en mémoire (jamais en localStorage)
// Le FLAG en sessionStorage ne contient aucune donnée sensible — seul le statut
// "déverrouillé dans cet onglet" est mémorisé. Il disparaît à la fermeture du tab.
const SESSION_FLAG = '_cleSession_flag'

let _cleSession: CryptoKey | null = null

export function setCleSession(cle: CryptoKey): void {
  _cleSession = cle
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_FLAG, 'unlocked')
  }
}

export function getCleSession(): CryptoKey | null { return _cleSession }

export function clearCleSession(): void {
  _cleSession = null
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_FLAG)
  }
}

/** Retourne true si la clé est en mémoire OU si l'onglet était déjà déverrouillé
 *  (flag sessionStorage). Après un hard refresh, key=null mais flag peut être présent :
 *  UnlockGate détectera ce cas via useEffect et re-demandera la clé. */
export function isCleSessionUnlocked(): boolean {
  if (_cleSession !== null) return true
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(SESSION_FLAG) === 'unlocked'
}

// Clé identité — séparée de la clé patrimoine
let _cleIdentiteSession: CryptoKey | null = null

export function setCleIdentiteSession(cle: CryptoKey) {
  _cleIdentiteSession = cle
}
export function getCleIdentiteSession(): CryptoKey | null {
  return _cleIdentiteSession
}
export function clearCleIdentiteSession() {
  _cleIdentiteSession = null
}
export function identiteDisponible(): boolean {
  return _cleIdentiteSession !== null
}

// Dériver les deux clés en une seule passe
export async function deriverDeuxCles(
  motDePassePatrimoine: string,
  motDePasseIdentite: string
): Promise<{ clePatrimoine: CryptoKey; cleIdentite: CryptoKey }> {
  const [clePatrimoine, cleIdentite] = await Promise.all([
    deriverCle(motDePassePatrimoine),
    deriverCle(motDePasseIdentite + '_identite')
  ])
  return { clePatrimoine, cleIdentite }
}
