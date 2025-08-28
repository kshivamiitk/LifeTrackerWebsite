// src/components/TaskCard.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from '../api/supabaseClient'
import { parseTimeToSeconds } from '../utils/time'

const PALETTE = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-fuchsia-500'
]

function hashToIndex(str, len) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h) % len
}

export default function TaskCard({ task, onStart, onUpdate, onEdit }) {
  const [timeSpent, setTimeSpent] = useState(0)
  const [status, setStatus] = useState(task.status)

  useEffect(() => {
    loadTimeEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadTimeEntries() {
    try {
      const { data, error } = await supabase.from('time_entries').select('*').eq('task_id', task.id)
      if (error) {
        console.error(error)
        return
      }
      let seconds = 0
      data.forEach((e) => {
        if (e.duration_seconds) seconds += e.duration_seconds
        else if (e.start_at && !e.end_at) {
          seconds += Math.round((Date.now() - new Date(e.start_at)) / 1000)
        }
      })
      setTimeSpent(seconds)
    } catch (err) {
      console.error(err)
    }
  }

  async function markComplete() {
    try {
      const { error } = await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id)
      if (error) throw error
      setStatus('completed')
      onUpdate && onUpdate()
    } catch (err) {
      console.error(err)
      alert('Could not mark complete')
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this task? This will delete its time entries too.')) return
    try {
      await supabase.from('time_entries').delete().eq('task_id', task.id)
      const { error } = await supabase.from('tasks').delete().eq('id', task.id)
      if (error) throw error
      onUpdate && onUpdate()
    } catch (err) {
      console.error('delete failed', err)
      alert('Delete failed')
    }
  }

  const estimatedSeconds = (() => {
    try {
      const s = parseTimeToSeconds(task.time_to) - parseTimeToSeconds(task.time_from)
      return s > 0 ? s : task.estimated_duration_seconds || 0
    } catch {
      return task.estimated_duration_seconds || 0
    }
  })()

  const progressPercent = estimatedSeconds > 0 ? Math.min(100, Math.round((timeSpent / estimatedSeconds) * 100)) : 0
  const colorClass = PALETTE[hashToIndex(task.id || task.title || '', PALETTE.length)]

  return (
    <div className="flex card overflow-hidden">
      <div className={`w-2 ${colorClass}`} />
      <div className="flex-1 p-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-lg font-medium italic">{task.title}</div>
            <div className="text-xs text-slate-500">
              {task.date} • {task.time_from} → {task.time_to} {task.category ? `• ${task.category}` : ''}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-sm ${status === 'completed' ? 'text-green-600' : 'text-slate-600'}`}>{status}</div>
            <div className="text-xs text-slate-400">{timeSpent ? `${timeSpent}s` : '0s'}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div style={{ width: `${progressPercent}%` }} className="h-2 rounded-full bg-primary" />
          </div>
          <div className="text-xs text-slate-500 mt-1">{progressPercent}% of estimated time</div>
        </div>

        <div className="mt-3 flex gap-2">
          <button className="flex-1 py-2 rounded border" onClick={() => onStart && onStart(task)}>
            Start / Resume
          </button>
          <button className="py-2 px-3 rounded border" onClick={() => onEdit && onEdit(task)}>
            Edit
          </button>
          <button className="py-2 px-3 rounded border text-red-600" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
