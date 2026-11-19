import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local (locally) ' +
      'or add them in Vercel → Settings → Environment Variables.',
  )
}

/** The one Supabase client for the whole app. */
export const supabase = createClient(url, key)
