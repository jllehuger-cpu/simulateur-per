import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log('[Supabase] URL:', supabaseUrl?.slice(0, 40))
console.log('[Supabase] KEY:', supabaseAnon?.slice(0, 20))

// Nouvelle clé publishable (sb_publishable_...) — remplace l'ancienne anon key
export const supabase = createClient(supabaseUrl, supabaseAnon)
