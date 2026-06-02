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
let _cleSession: CryptoKey | null = null
export function setCleSession(cle: CryptoKey) { _cleSession = cle }
export function getCleSession(): CryptoKey | null { return _cleSession }
export function clearCleSession() { _cleSession = null }

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
