// src/components/TaskForm.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from '../api/supabaseClient'
import dayjs from 'dayjs'

const PRESET_CATEGORIES = ['programming', 'sports', 'academics', 'music', 'assignments', 'other']

export default function TaskForm({ user, date: initialDate, onCreate, taskToEdit, onCancel }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(initialDate || dayjs().format('YYYY-MM-DD'))
  const [timeFrom, setTimeFrom] = useState('09:00')
  const [timeTo, setTimeTo] = useState('10:00')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [teams, setTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [teamMembers, setTeamMembers] = useState([])
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [estHours, setEstHours] = useState(0)
  const [estMinutes, setEstMinutes] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadTeams()
    if (taskToEdit) fillFromTask(taskToEdit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskToEdit])

  async function loadTeams() {
    const { data, error } = await supabase.from('teams').select('*').order('created_at', { ascending: false })
    if (error) {
      console.error('load teams', error)
      return
    }
    setTeams(data || [])
  }

  // load members for a team — ensures we return an array of user objects { id, username, display_name }
  async function loadTeamMembers(teamId) {
    if (!teamId) {
      setTeamMembers([])
      return
    }
    // fetch team_members with the related app_users if relationship exists
    const { data, error } = await supabase
      .from('team_members')
      .select('id, user_id, app_users(id,username,display_name)')
      .eq('team_id', teamId)
    if (error) {
      console.error('load team members', error)
      setTeamMembers([])
      return
    }

    // normalize to user objects
    const members = (data || []).map((row) => {
      const uu = row.app_users || { id: row.user_id }
      return { id: uu.id, username: uu.username, display_name: uu.display_name }
    })
    setTeamMembers(members)
  }

  function fillFromTask(t) {
    setTitle(t.title || '')
    setDescription(t.description || '')
    setDate(t.date || initialDate || dayjs().format('YYYY-MM-DD'))
    setTimeFrom(t.time_from || '09:00')
    setTimeTo(t.time_to || '10:00')
    setCategory(t.category || '')
    setSelectedTeamId(t.team_id || '')
    setEstHours(Math.floor((t.estimated_duration_seconds || 0) / 3600))
    setEstMinutes(Math.floor(((t.estimated_duration_seconds || 0) % 3600) / 60))
    if (t.team_id) loadTeamMembers(t.team_id)
  }

  function toggleMemberSelection(memberId) {
    setSelectedMemberIds((prev) => {
      if (prev.includes(memberId)) return prev.filter((p) => p !== memberId)
      return [...prev, memberId]
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const finalCategory = category === 'other' ? (customCategory || 'other') : category || (customCategory || '')
      const estimated_seconds = Math.round(Number(estHours || 0) * 3600 + Number(estMinutes || 0) * 60)

      if (taskToEdit && taskToEdit.id) {
        const updates = {
          title,
          description,
          date,
          time_from: timeFrom,
          time_to: timeTo,
          category: finalCategory,
          team_id: selectedTeamId || null,
          estimated_duration_seconds: estimated_seconds || null
        }
        const { error } = await supabase.from('tasks').update(updates).eq('id', taskToEdit.id)
        if (error) throw error
        onCreate && onCreate()
        onCancel && onCancel()
        setLoading(false)
        return
      }

      // If assigning to members -> create a task per member
      if (selectedMemberIds.length > 0) {
        const inserts = selectedMemberIds.map((memberId) => ({
          user_id: memberId,
          team_id: selectedTeamId || null,
          title: title || 'Untitled',
          description,
          date,
          time_from: timeFrom,
          time_to: timeTo,
          category: finalCategory,
          estimated_duration_seconds: estimated_seconds || null,
          status: 'pending'
        }))
        const { error } = await supabase.from('tasks').insert(inserts)
        if (error) throw error
        setTitle('')
        setSelectedMemberIds([])
        onCreate && onCreate()
        setLoading(false)
        return
      }

      // Normal create for current user
      const { error } = await supabase.from('tasks').insert({
        user_id: user.id,
        team_id: selectedTeamId || null,
        title: title || 'Untitled',
        description,
        date,
        time_from: timeFrom,
        time_to: timeTo,
        category: finalCategory,
        estimated_duration_seconds: estimated_seconds || null,
        status: 'pending'
      })
      if (error) throw error
      setTitle('')
      onCreate && onCreate()
    } catch (err) {
      console.error('create task failed', err)
      alert(err.message || 'Task create failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="card mb-4" onSubmit={handleSubmit}>
      <div className="flex gap-2 mb-2">
        <input className="flex-1 p-2 border rounded" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
        <select className="p-2 border rounded" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Category</option>
          {PRESET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {category === 'other' && (
        <input className="w-full p-2 mb-2 border rounded" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Custom category" />
      )}

      <label className="text-sm">Date</label>
      <input type="date" className="w-full p-2 mb-2 border rounded" value={date} onChange={(e) => setDate(e.target.value)} />

      <div className="flex gap-2 mb-2">
        <input type="time" className="flex-1 p-2 border rounded" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
        <input type="time" className="flex-1 p-2 border rounded" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
      </div>

      <label className="text-sm">Estimated (hrs / mins)</label>
      <div className="flex gap-2 mb-2">
        <input type="number" min="0" className="w-1/2 p-2 border rounded" value={estHours} onChange={(e) => setEstHours(e.target.value)} placeholder="Hours" />
        <input type="number" min="0" max="59" className="w-1/2 p-2 border rounded" value={estMinutes} onChange={(e) => setEstMinutes(e.target.value)} placeholder="Minutes" />
      </div>

      <label className="text-sm">Team (optional)</label>
      <select
        className="w-full p-2 mb-2 border rounded"
        value={selectedTeamId || ''}
        onChange={async (e) => {
          const teamId = e.target.value || ''
          setSelectedTeamId(teamId)
          await loadTeamMembers(teamId)
          setSelectedMemberIds([])
        }}
      >
        <option value="">None</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {teamMembers && teamMembers.length > 0 && (
        <div className="mb-2">
          <div className="text-sm text-slate-500 mb-1">Assign to team members (create task copies)</div>
          <div className="grid grid-cols-2 gap-2">
            {teamMembers.map((m) => (
              <label key={m.id} className="flex items-center gap-2 p-2 border rounded">
                <input type="checkbox" checked={selectedMemberIds.includes(m.id)} onChange={() => toggleMemberSelection(m.id)} />
                <div>
                  <div className="text-sm">{m.display_name || m.username}</div>
                  <div className="text-xs text-slate-500">@{m.username}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="text-sm">Description</label>
      <textarea className="w-full p-2 mb-3 border rounded" value={description} onChange={(e) => setDescription(e.target.value)} />

      <div className="flex gap-2">
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Saving...' : taskToEdit ? 'Update Task' : 'Create Task'}
        </button>
        {taskToEdit && (
          <button type="button" className="py-2 px-3 rounded border" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
