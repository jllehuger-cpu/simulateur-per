import { getSupabase } from './supabase'

const supabase = getSupabase()

export interface UserProfile {
  id: string
  email: string
  role: 'admin' | 'cgp' | 'expert_comptable'
  status?: 'pending' | 'active' | 'blocked'
  nom?: string
  cabinet?: string
  api_used?: number
  api_quota?: number
  api_quota_reset_at?: string
  created_at?: string
}

export async function envoyerMagicLink(email: string): Promise<void> {
  const redirectUrl = `${window.location.origin}/auth/callback`
  console.log('[AUTH] emailRedirectTo:', redirectUrl)
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
    }
  })
  if (error) throw error
}

export async function seDeconnecter(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch (err) {
    console.error('[AUTH] Erreur signOut (ignorée):', err)
  }
  // Toujours rediriger, même si signOut a échoué
  // Hard redirect pour que le middleware re-vérifie la session (soft nav ne suffit pas)
  window.location.href = '/login'
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getProfil(): Promise<UserProfile | null> {
  const user = await getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return data as UserProfile | null
}

export async function updateProfil(updates: Partial<UserProfile>): Promise<void> {
  const user = await getUser()
  if (!user) throw new Error('Non connecté')

  await supabase.from('user_profiles')
    .update({ ...updates, last_login: new Date().toISOString() })
    .eq('id', user.id)
}

export function onAuthChange(
  callback: (user: { id: string; email: string } | null) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      callback({ id: session.user.id, email: session.user.email ?? '' })
    } else {
      callback(null)
    }
  })
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUpWithPassword(email: string, password: string, nom?: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nom } },
  })
  if (error) throw error
}

export async function resetPassword(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/auth/callback?type=recovery`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
