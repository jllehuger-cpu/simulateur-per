import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('dossiers').select('alias').limit(1)
  return Response.json({ data, error })
}
