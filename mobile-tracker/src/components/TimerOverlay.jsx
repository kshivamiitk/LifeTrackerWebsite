// src/components/TimerOverlay.jsx
import React, { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { durationHuman } from '../utils/time'
import * as timerService from '../api/timerService'
import { supabase } from '../api/supabaseClient'

/**
 * TimerOverlay (simple, target-driven, resume-exactly behavior)
 *
 * Behavior:
 *  - You MUST set a target (hours/minutes) before pressing Start (this matches your "allot at the very beginning").
 *  - On Start (or Resume) we:
 *     1. Read authoritative aggregate: baseSeconds (sum of completed durations) and runningEntry (if any).
 *     2. Compute remaining = target - baseSeconds.
 *     3. If remaining <= 0 => auto-finish the task (it's already fulfilled).
 *     4. Create a new running time_entries row (or reuse existing run) and start the ticker.
 *  - On Stop we finalize the running entry (end_at + duration_seconds), then reload aggregate.
 *  - On Resume we repeat Start steps; because baseSeconds includes previous stopped segments, remaining will be exactly where you left it.
 *
 * Target persistence:
 *  - Local: saved to localStorage under key `dltr_timer_target_${task.id}` so closing overlay/page still resumes target.
 *  - Optional: if you check "Save as task target" it will also write to tasks.estimated_duration_seconds.
 *
 * This file intentionally avoids editing/deleting entries UI to match your "no editing" requirement.
 */

export default function TimerOverlay({ user, task, onClose }) {
  const tickerRef = useRef(null)

  // authoritative state
  const [entries, setEntries] = useState([])
  const [runningEntry, setRunningEntry] = useState(null)
  const baseRef = useRef(0) // authoritative sum of completed durations

  // display & UI
  const [displaySeconds, setDisplaySeconds] = useState(0) // shows remaining (countdown) while in target mode
  const [isRunning, setIsRunning] = useState(false)
  const [loading, setLoading] = useState(false)

  // target state (seconds). null = no target set yet
  const [targetSeconds, setTargetSeconds] = useState(null)
  const [inputHours, setInputHours] = useState(0)
  const [inputMinutes, setInputMinutes] = useState(0)
  const [persistTargetToTask, setPersistTargetToTask] = useState(false)

  // small guards
  const finishingRef = useRef(false)
  const autoFinishRef = useRef(true)

  // localStorage key helper
  const storageKey = `dltr_timer_target_${task.id}`

  // helper: format HH:MM:SS
  function formatHMS(sec) {
    const s = Math.max(0, Math.floor(sec))
    const hh = Math.floor(s / 3600)
    const mm = Math.floor((s % 3600) / 60)
    const ss = s % 60
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }

  // Compute display value (remaining) for a given runningEntry and authoritative base and target
  function computeRemaining(entry, base, target) {
    const runningSegment = entry && entry.start_at && !entry.end_at ? Math.round((Date.now() - new Date(entry.start_at)) / 1000) : 0
    const elapsed = base + runningSegment
    const rem = Math.max(0, (target || 0) - elapsed)
    return { remaining: rem, elapsed, runningSegment }
  }

  // Load target from localStorage (prefer localStorage over DB so user doesn't have to save)
  function loadLocalTarget() {
    try {
      const v = localStorage.getItem(storageKey)
      if (v != null) {
        const n = Number(v)
        if (!Number.isNaN(n) && n > 0) {
          setTargetSeconds(n)
          // derive displayed breakdown optionally
        }
      } else if (task && task.estimated_duration_seconds) {
        setTargetSeconds(task.estimated_duration_seconds)
      }
    } catch (e) {
      // ignore localStorage issues
    }
  }

  // Save target to localStorage (so resume works even if not persisted to DB)
  function saveLocalTarget(seconds) {
    try {
      if (seconds == null) localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, String(seconds))
    } catch (e) {}
  }

  // Authoritative reload: uses timerService.getAggregate (baseSeconds computed only from completed entries)
  async function reloadAggregate() {
    setLoading(true)
    try {
      const agg = await timerService.getAggregate(task.id)
      baseRef.current = agg.baseSeconds || 0
      setRunningEntry(agg.runningEntry || null)
      setEntries(agg.entries || [])
      setIsRunning(Boolean(agg.runningEntry))
      // If we have a target, compute remaining and start ticker that uses the captured base & running entry
      if (targetSeconds != null) {
        const { remaining } = computeRemaining(agg.runningEntry, baseRef.current, targetSeconds)
        setDisplaySeconds(remaining)
        startTicker(agg.runningEntry, baseRef.current, targetSeconds)
      } else {
        // no target set => show elapsed (but your requested behavior asks for countdown at beginning,
        // so we mostly operate in countdown mode)
        const elapsed = baseRef.current + (agg.runningEntry && agg.runningEntry.start_at && !agg.runningEntry.end_at ? Math.round((Date.now() - new Date(agg.runningEntry.start_at)) / 1000) : 0)
        setDisplaySeconds(elapsed)
        startTicker(agg.runningEntry, baseRef.current, null)
      }
    } catch (err) {
      console.error('reloadAggregate failed', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // initial load for target and aggregate
    loadLocalTarget()
    reloadAggregate()
    return () => clearInterval(tickerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id])

  // Ticker that captures the authoritative base and entry (no stale closure)
  function startTicker(entry, base, target) {
    clearInterval(tickerRef.current)
    // immediate set
    if (target != null) {
      const { remaining } = computeRemaining(entry, base, target)
      setDisplaySeconds(remaining)
    } else {
      const elapsed = base + (entry && entry.start_at && !entry.end_at ? Math.round((Date.now() - new Date(entry.start_at)) / 1000) : 0)
      setDisplaySeconds(elapsed)
    }
    tickerRef.current = setInterval(() => {
      if (target != null) {
        const { remaining } = computeRemaining(entry, base, target)
        setDisplaySeconds(remaining)
      } else {
        const elapsed = base + (entry && entry.start_at && !entry.end_at ? Math.round((Date.now() - new Date(entry.start_at)) / 1000) : 0)
        setDisplaySeconds(elapsed)
      }
    }, 400)
  }

  // Ensure user sets a target before Start (because you requested allot at very beginning)
  function getEffectiveTarget() {
    // explicit target state has priority
    if (targetSeconds != null && Number.isFinite(targetSeconds)) return targetSeconds
    // fallback to localStorage (loadLocalTarget called on mount, so this should be covered)
    try {
      const v = localStorage.getItem(storageKey)
      if (v != null) {
        const n = Number(v)
        if (Number.isFinite(n) && n > 0) return n
      }
    } catch (e) {}
    // fallback to task estimated_duration_seconds
    if (task && task.estimated_duration_seconds) return Number(task.estimated_duration_seconds)
    return null
  }

  // Start / Resume flow (critical: re-read authoritative base BEFORE creating a new running entry)
  async function handleStart() {
    setLoading(true)
    try {
      const effectiveTarget = getEffectiveTarget()
      if (!effectiveTarget) {
        alert('Please set a target duration (hours/minutes) before starting.')
        setLoading(false)
        return
      }

      // read authoritative aggregate (base + running) BEFORE creating an entry
      const agg = await timerService.getAggregate(task.id)
      const authoritativeBase = agg.baseSeconds || 0

      // compute remaining BEFORE creating a new entry (so we know if already done)
      const remainingBefore = Math.max(0, effectiveTarget - authoritativeBase)
      if (remainingBefore <= 0) {
        // already completed — mark task finished
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id)
        await reloadAggregate()
        setLoading(false)
        return
      }

      // createEntry will return existing running one if someone already started; if created=false we reuse it
      const { data: maybeRunning, created, error, warnings } = await timerService.createEntry(task.id)
      if (error) throw error
      if (warnings && warnings.length) console.warn('createEntry warnings', warnings)

      // after creation (or reuse), we MUST use authoritativeBase (from before) plus the returned running entry as closure values
      setRunningEntry(maybeRunning || null)
      setIsRunning(Boolean(maybeRunning))
      // start ticker using authoritative base + the returned running entry (ensures resume adds base)
      startTicker(maybeRunning || null, authoritativeBase, effectiveTarget)

      // persist target locally so reopen will keep it
      saveLocalTarget(effectiveTarget)
      setTargetSeconds(effectiveTarget)

      // optional: persist to task if checkbox is checked (user choice)
      if (persistTargetToTask) {
        try {
          const { error: err } = await supabase.from('tasks').update({ estimated_duration_seconds: effectiveTarget }).eq('id', task.id)
          if (err) console.warn('persist target to task failed', err)
        } catch (e) {
          console.warn('persist target to task error', e)
        }
      }
    } catch (err) {
      console.error('handleStart error', err)
      alert('Could not start/resume timer — check console')
    } finally {
      setLoading(false)
    }
  }

  // Stop: finalize running entry then reload authoritative aggregate (so resume picks up base)
  async function handleStop() {
    if (!runningEntry) return
    setLoading(true)
    try {
      await timerService.stopEntry(runningEntry.id)
      // reload agg (this sets baseRef.current)
      await reloadAggregate()
    } catch (err) {
      console.error('handleStop error', err)
      alert('Could not stop timer — check console')
    } finally {
      setLoading(false)
    }
  }

  // Finish: stop if running then mark completed
  async function handleFinish() {
    setLoading(true)
    try {
      if (runningEntry) await timerService.stopEntry(runningEntry.id)
      const { error } = await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id)
      if (error) throw error
      await reloadAggregate()
      // do not clear local target automatically — user may want to reuse it
      onClose && onClose()
    } catch (err) {
      console.error('handleFinish error', err)
      alert('Could not finish task — check console')
    } finally {
      setLoading(false)
    }
  }

  // Set target from inputs (not persisted unless user checks the box)
  function setTargetFromInputs() {
    const hrs = Number(inputHours || 0)
    const mins = Number(inputMinutes || 0)
    const seconds = Math.max(0, Math.round(hrs * 3600 + mins * 60))
    if (!seconds) {
      alert('Please enter a positive target.')
      return
    }
    setTargetSeconds(seconds)
    saveLocalTarget(seconds)
    // compute immediate display based on current aggregate
    const elapsedNow = baseRef.current + (runningEntry && runningEntry.start_at && !runningEntry.end_at ? Math.round((Date.now() - new Date(runningEntry.start_at)) / 1000) : 0)
    const remainingNow = Math.max(0, seconds - elapsedNow)
    setDisplaySeconds(remainingNow)
    // optional persist to task if asked for
    if (persistTargetToTask) {
      supabase.from('tasks').update({ estimated_duration_seconds: seconds }).eq('id', task.id).catch((e) => console.warn('persist target failed', e))
    }
  }

  // Clear local target (doesn't touch DB)
  function clearTarget() {
    setTargetSeconds(null)
    saveLocalTarget(null)
    setInputHours(0)
    setInputMinutes(0)
    // reload aggregate to show elapsed mode
    reloadAggregate()
  }

  // computed small n indicator for UX
  const remainingNow = targetSeconds != null ? Math.max(0, targetSeconds - (baseRef.current + (runningEntry && runningEntry.start_at && !runningEntry.end_at ? Math.round((Date.now() - new Date(runningEntry.start_at)) / 1000) : 0))) : null
  const nIndicator = remainingNow != null ? `${formatHMS(remainingNow)} (${remainingNow}s)` : null

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col p-4" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">Task</div>
          <div className="text-xl font-semibold">{task.title}</div>
        </div>

        <div className="flex gap-2">
          <button
            className="py-2 px-3 rounded border"
            onClick={() => {
              clearInterval(tickerRef.current)
              onClose && onClose()
            }}
          >
            Close
          </button>
          <button className="py-2 px-3 rounded border" onClick={reloadAggregate} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start mt-6 overflow-auto">
        {/* Big countdown display (target mode) or elapsed if no target */}
        <div className="text-6xl md:text-7xl font-mono mb-2">
          {targetSeconds != null ? formatHMS(Math.max(0, remainingNow)) : formatHMS(displaySeconds)}
        </div>
        <div className="text-sm text-slate-500 mb-4">{targetSeconds != null ? 'Remaining' : 'Elapsed'}</div>

        {/* n indicator */}
        {nIndicator && <div className="mb-3 px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-700">n: {nIndicator}</div>}

        {/* Controls */}
        <div className="w-full max-w-md card p-3 mb-4">
          <div className="flex gap-2 mb-3">
            {!isRunning ? (
              <button className="btn flex-1" onClick={handleStart} disabled={loading}>
                {loading ? '...' : 'Start / Resume'}
              </button>
            ) : (
              <button className="py-2 px-3 rounded border flex-1" onClick={handleStop} disabled={loading}>
                {loading ? '...' : 'Stop'}
              </button>
            )}

            <button className="py-2 px-3 rounded border" onClick={handleFinish} disabled={loading}>
              Finish
            </button>
          </div>

          <div className="text-xs text-slate-500 mb-2">Set countdown target (hours / minutes) — required before Start</div>
          <div className="flex gap-2 mb-2">
            <input type="number" min="0" className="flex-1 p-2 border rounded" value={inputHours} onChange={(e) => setInputHours(e.target.value)} placeholder="Hours" />
            <input type="number" min="0" max="59" className="flex-1 p-2 border rounded" value={inputMinutes} onChange={(e) => setInputMinutes(e.target.value)} placeholder="Minutes" />
          </div>

          <div className="flex gap-2 mb-2">
            <button className="py-2 px-3 rounded border" onClick={setTargetFromInputs}>
              Set Target
            </button>
            <button className="py-2 px-3 rounded border" onClick={clearTarget}>
              Clear Target
            </button>
            <label className="flex items-center gap-2 ml-2 text-xs">
              <input type="checkbox" checked={persistTargetToTask} onChange={(e) => setPersistTargetToTask(e.target.checked)} />
              <span>Save as task target</span>
            </label>
          </div>

          <div className="text-xs text-slate-500">Target persists locally (so resume after closing works). Optionally save to task.</div>
        </div>

        {/* Simple entries view for debugging (no edit) */}
        <div className="w-full max-w-md">
          <div className="font-semibold mb-2">Time entries (latest first)</div>
          {[...entries].reverse().map((e) => (
            <div key={e.id} className="card mb-2 p-3 flex justify-between items-center">
              <div>
                <div className="text-sm">Start: {e.start_at ? dayjs(e.start_at).format('YYYY-MM-DD HH:mm:ss') : '—'}</div>
                <div className="text-xs text-slate-500">End: {e.end_at ? dayjs(e.end_at).format('YYYY-MM-DD HH:mm:ss') : 'running'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{e.duration_seconds ? durationHuman(e.duration_seconds) : e.start_at && !e.end_at ? durationHuman(Math.round((Date.now() - new Date(e.start_at)) / 1000)) : '—'}</div>
                <div className="text-xs text-slate-400 mt-2">{e.id.slice(0, 6)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
