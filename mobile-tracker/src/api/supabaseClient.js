// src/api/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

/**
 * Utility: load user from local session token stored in localStorage (key: dlt_session_token)
 * It queries sessions -> app_users using Supabase client (anon).
 * Returns { user, session } or null.
 */
export async function loadUserFromLocalToken() {
  const token = localStorage.getItem('dlt_session_token')
  if (!token) return null

  const { data, error } = await supabase
    .from('sessions')
    .select('*, app_users(*)')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    console.error('Error loading session', error)
    return null
  }
  if (!data) return null
  return { session: data, user: data.app_users }
}
