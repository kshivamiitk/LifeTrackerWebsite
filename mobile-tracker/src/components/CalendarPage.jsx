// src/components/CalendarPage.jsx
import React, { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { supabase } from '../api/supabaseClient'

export default function CalendarPage({ user }) {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [tasks, setTasks] = useState([])
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadTasksForUserDate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, user?.id])

  async function loadTasksForUserDate() {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('time_from', { ascending: true })
      if (error) throw error
      setTasks(tasksData || [])

      // compute total seconds for these tasks
      if (tasksData && tasksData.length) {
        const taskIds = tasksData.map((t) => t.id)
        const { data: entries, error: entErr } = await supabase
          .from('time_entries')
          .select('duration_seconds, start_at, end_at, task_id')
          .in('task_id', taskIds)
        if (entErr) throw entErr
        let total = 0
        if (entries) {
          entries.forEach((e) => {
            if (e.duration_seconds) total += e.duration_seconds
            else if (e.start_at && !e.end_at) {
              total += Math.round((Date.now() - new Date(e.start_at)) / 1000)
            }
          })
        }
        setTotalSeconds(total)
      } else {
        setTotalSeconds(0)
      }
    } catch (err) {
      console.error('load tasks error', err)
      setTasks([])
      setTotalSeconds(0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Calendar</h2>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="p-2 border rounded" />
      </div>

      <div className="mb-4 text-sm text-slate-500">
        Your total time on {date}: {Math.floor(totalSeconds / 3600)}h {Math.floor((totalSeconds % 3600) / 60)}m
      </div>

      <div className="space-y-3">
        {loading && <div>Loading tasks...</div>}
        {!loading && tasks.length === 0 && <div className="text-slate-500">No tasks for this date.</div>}
        {tasks.map((t) => (
          <div key={t.id} className="card">
            <div className="flex justify-between">
              <div>
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-slate-500">{t.time_from} → {t.time_to} {t.category ? `• ${t.category}` : ''}</div>
              </div>
              <div className="text-sm text-slate-400">{t.status}</div>
            </div>
            <div className="mt-2 text-sm text-slate-600">{t.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
