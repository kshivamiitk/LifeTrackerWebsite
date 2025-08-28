// src/components/Dashboard.jsx
import React, { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { supabase } from '../api/supabaseClient'
import TaskCard from './TaskCard'
import TaskForm from './TaskForm'
import TimerOverlay from './TimerOverlay'

export default function Dashboard({ user }) {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [activeTask, setActiveTask] = useState(null)
  const [taskToEdit, setTaskToEdit] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, categoryFilter, query])

  async function loadTasks() {
    setLoading(true)
    try {
      // Query tasks for this user and date, with optional filters
      let builder = supabase.from('tasks').select('*').eq('user_id', user.id).eq('date', date).order('time_from', { ascending: true })
      if (categoryFilter) builder = builder.ilike('category', `%${categoryFilter}%`)
      if (query) builder = builder.ilike('title', `%${query}%`)
      const { data, error } = await builder
      if (error) throw error
      setTasks(data || [])
    } catch (err) {
      console.error('loadTasks', err)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  function refresh() {
    loadTasks()
  }

  function handleStart(task) {
    setActiveTask(task)
  }

  function handleEdit(task) {
    setTaskToEdit(task)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // split tasks
  const created = tasks // every task is "created" by or assigned to this user
  const pending = tasks.filter((t) => t.status !== 'completed')
  const completed = tasks.filter((t) => t.status === 'completed')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Tasks — {date}</h2>
          <div className="text-xs text-slate-500">Create / Pending / Completed</div>
        </div>

        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="p-2 border rounded" />
          <button className="py-2 px-3 rounded border" onClick={() => { setShowForm((s) => !s); setTaskToEdit(null) }}>
            {showForm ? 'Close' : 'New Task'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-3 flex gap-2">
        <input className="flex-1 p-2 border rounded" placeholder="Search title..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <input className="w-40 p-2 border rounded" placeholder="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} />
      </div>

      {/* Create/Edit */}
      {showForm && (
        <section className="mb-4">
          <div className="mb-2 font-semibold">{taskToEdit ? 'Edit Task' : 'Create Task'}</div>
          <TaskForm
            user={user}
            date={date}
            onCreate={() => { refresh(); setShowForm(false); setTaskToEdit(null) }}
            taskToEdit={taskToEdit}
            onCancel={() => { setTaskToEdit(null); setShowForm(false) }}
          />
        </section>
      )}

      {/* Created (all tasks for the date) */}
      <section className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">All tasks <span className="text-xs text-slate-500">({created.length})</span></div>
        </div>
        <div className="space-y-3">
          {loading && <div>Loading...</div>}
          {!loading && created.length === 0 && <div className="text-slate-500">No tasks for this date</div>}
          {created.map((t) => (
            <TaskCard key={t.id} task={t} onStart={handleStart} onUpdate={refresh} onEdit={handleEdit} />
          ))}
        </div>
      </section>

      {/* Pending */}
      <section className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Pending <span className="text-xs text-slate-500">({pending.length})</span></div>
        </div>
        <div className="space-y-3">
          {pending.length === 0 && <div className="text-slate-500">No pending tasks</div>}
          {pending.map((t) => (
            <TaskCard key={t.id} task={t} onStart={handleStart} onUpdate={refresh} onEdit={handleEdit} />
          ))}
        </div>
      </section>

      {/* Completed */}
      <section className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Completed <span className="text-xs text-slate-500">({completed.length})</span></div>
        </div>
        <div className="space-y-3">
          {completed.length === 0 && <div className="text-slate-500">No completed tasks</div>}
          {completed.map((t) => (
            <TaskCard key={t.id} task={t} onStart={handleStart} onUpdate={refresh} onEdit={handleEdit} />
          ))}
        </div>
      </section>

      {activeTask && (
        <TimerOverlay
          user={user}
          task={activeTask}
          onClose={() => {
            setActiveTask(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}
