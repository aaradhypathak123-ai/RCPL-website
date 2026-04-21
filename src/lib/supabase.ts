import { createClient } from '@supabase/supabase-js'

// @supabase/supabase-js v2.102.1 — supports both legacy JWT (eyJ...)
// and the new Publishable Key format (sb_publishable_...).
// Pass VITE_SUPABASE_ANON_KEY as-is; no format conversion needed.

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl)     console.error('[Supabase] VITE_SUPABASE_URL is not set in .env.local')
if (!supabaseAnonKey) console.error('[Supabase] VITE_SUPABASE_ANON_KEY is not set in .env.local')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
