// src/api/diaryService.js
import { supabase } from './supabaseClient'
import dayjs from 'dayjs'

/**
 * Diary service: CRUD for per-user, per-day diary entries.
 * Uses diary_date in 'YYYY-MM-DD' (date-only) format.
 *
 * Exports:
 * - getDiary(userId, dateString)
 * - upsertDiary(userId, dateString, content)
 * - deleteDiary(id)
 * - listDiariesForMonth(userId, year, month) -> entries for calendar month
 */

export async function getDiary(userId, dateString) {
  if (!userId || !dateString) return { data: null, error: new Error('Missing args') }
  const { data, error } = await supabase
    .from('diaries')
    .select('*')
    .eq('user_id', userId)
    .eq('diary_date', dateString)
    .maybeSingle()
  return { data, error }
}

export async function upsertDiary(userId, dateString, content) {
  if (!userId || !dateString) return { data: null, error: new Error('Missing args') }
  // Try to find existing
  const { data: existing, error: findErr } = await supabase
    .from('diaries')
    .select('*')
    .eq('user_id', userId)
    .eq('diary_date', dateString)
    .maybeSingle()
  if (findErr) return { data: null, error: findErr }

  if (existing && existing.id) {
    const { data, error } = await supabase
      .from('diaries')
      .update({ content })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle()
    return { data, error }
  } else {
    const { data, error } = await supabase
      .from('diaries')
      .insert({ user_id: userId, diary_date: dateString, content })
      .select('*')
      .maybeSingle()
    return { data, error }
  }
}

export async function deleteDiary(id) {
  if (!id) return { error: new Error('Missing id') }
  const { error } = await supabase.from('diaries').delete().eq('id', id)
  return { error }
}

/**
 * List diaries for a given month for the user.
 * year: full year (e.g., 2025), month: 1-12
 * Returns array of rows: { id, diary_date, content }
 */
export async function listDiariesForMonth(userId, year, month) {
  if (!userId || !year || !month) return { data: [], error: new Error('Missing args') }
  const start = dayjs.utc(`${year}-${String(month).padStart(2, '0')}-01`).format('YYYY-MM-DD')
  const end = dayjs.utc(start).endOf('month').format('YYYY-MM-DD')
  const { data, error } = await supabase
    .from('diaries')
    .select('id, diary_date, content')
    .eq('user_id', userId)
    .gte('diary_date', start)
    .lte('diary_date', end)
    .order('diary_date', { ascending: true })
  return { data, error }
}
