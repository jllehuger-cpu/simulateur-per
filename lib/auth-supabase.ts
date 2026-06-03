import { supabase } from './supabase'

export interface UserProfile {
  id: string
  email: string
  role: 'admin' | 'cgp' | 'expert_comptable'
  nom?: string
  cabinet?: string
}

export async function envoyerMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    }
  })
  if (error) throw error
}

export async function seDeconnecter(): Promise<void> {
  await supabase.auth.signOut()
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
