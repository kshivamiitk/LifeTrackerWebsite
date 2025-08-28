// src/api/timerService.js
import { supabase } from './supabaseClient'

/**
 * Timer service: robust, authoritative aggregates and CRUD for time_entries.
 *
 * getAggregate(taskId) returns:
 *  { baseSeconds, runningEntry, entries, warnings }
 *
 * baseSeconds: sum of duration_seconds for completed entries (end_at IS NOT NULL)
 * runningEntry: the single latest running entry (end_at IS NULL) or null
 * entries: full list ordered ascending by start_at
 * warnings: array of warning strings for the caller (e.g., multiple running entries)
 */

export async function listEntries(taskId) {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('task_id', taskId)
    .order('start_at', { ascending: true })
  return { data, error }
}

export async function createEntry(taskId) {
  // Re-check running entries. If one exists return it; if many exist, return latest and warn.
  const { data: runningRows, error: fetchErr } = await supabase
    .from('time_entries')
    .select('*')
    .eq('task_id', taskId)
    .is('end_at', null)
    .order('start_at', { ascending: true })

  if (fetchErr) return { data: null, created: false, error: fetchErr, warnings: ['fetch-running-failed'] }

  if (runningRows && runningRows.length > 0) {
    // return the latest running entry (last in ascending order)
    const last = runningRows[runningRows.length - 1]
    const warnings = runningRows.length > 1 ? [`multiple_running_entries:${runningRows.length}`] : []
    return { data: last, created: false, error: null, warnings }
  }

  // create new entry
  const start_at = new Date().toISOString()
  const { data, error } = await supabase.from('time_entries').insert({ task_id: taskId, start_at }).select('*').maybeSingle()
  return { data, created: !error && !!data, error, warnings: [] }
}

export async function stopEntry(entryId, endAtIso = null) {
  const end_at = endAtIso || new Date().toISOString()

  // fetch existing entry first
  const { data: existing, error: fetchErr } = await supabase.from('time_entries').select('*').eq('id', entryId).maybeSingle()
  if (fetchErr) return { data: null, error: fetchErr }
  if (!existing) return { data: null, error: new Error('Entry not found') }

  // compute duration_seconds deterministically on client side
  const duration_seconds = Math.max(
    0,
    Math.round((new Date(end_at).getTime() - new Date(existing.start_at).getTime()) / 1000)
  )

  const { data, error } = await supabase
    .from('time_entries')
    .update({ end_at, duration_seconds })
    .eq('id', entryId)
    .select('*')
    .maybeSingle()

  return { data, error }
}

export async function updateEntry(entryId, updates = {}) {
  const payload = { ...updates }
  if (updates.start_at && updates.end_at && !('duration_seconds' in updates)) {
    payload.duration_seconds = Math.max(
      0,
      Math.round((new Date(updates.end_at).getTime() - new Date(updates.start_at).getTime()) / 1000)
    )
  }
  const { data, error } = await supabase.from('time_entries').update(payload).eq('id', entryId).select('*').maybeSingle()
  return { data, error }
}

export async function deleteEntry(entryId) {
  const { error } = await supabase.from('time_entries').delete().eq('id', entryId)
  return { error }
}

export async function getAggregate(taskId) {
  // load full list (we will compute base from completed rows only)
  const { data: entries, error: entriesErr } = await supabase
    .from('time_entries')
    .select('*')
    .eq('task_id', taskId)
    .order('start_at', { ascending: true })

  if (entriesErr) {
    return { baseSeconds: 0, runningEntry: null, entries: [], warnings: ['entries_fetch_error'], error: entriesErr }
  }

  // running rows are those with end_at null
  const runningRows = entries.filter((r) => r.end_at === null || r.end_at === undefined)

  // pick latest runningEntry if any (the one with max start_at)
  let runningEntry = null
  const warnings = []
  if (runningRows.length === 1) {
    runningEntry = runningRows[0]
  } else if (runningRows.length > 1) {
    // pick the latest by start_at and warn — multiple running rows are problematic
    runningEntry = runningRows.reduce((a, b) => (new Date(a.start_at) > new Date(b.start_at) ? a : b))
    warnings.push(`multiple_running_entries:${runningRows.length}`)
  }

  // Compute baseSeconds only from entries that are completed (end_at present) AND duration_seconds present.
  // This avoids accidentally counting running rows or duplicated calculations.
  let baseSeconds = 0
  entries.forEach((r) => {
    if (r.end_at && typeof r.duration_seconds === 'number') {
      baseSeconds += r.duration_seconds || 0
    }
  })

  return { baseSeconds, runningEntry, entries: entries || [], warnings }
}
