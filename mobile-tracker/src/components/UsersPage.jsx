// src/components/UsersPage.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from '../api/supabaseClient'
import dayjs from 'dayjs'

export default function UsersPage({ user }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [tasks, setTasks] = useState([])

  async function search() {
    const username = query.trim().toLowerCase()
    if (!username) return setResults([])
    const { data } = await supabase.from('app_users').select('id,username,display_name').ilike('username', `%${username}%`)
    setResults(data || [])
  }

  useEffect(() => {
    (async () => {
      if (!selectedUser) return
      const { data } = await supabase.from('tasks').select('*').eq('user_id', selectedUser.id).eq('date', date)
      setTasks(data || [])
    })()
  }, [selectedUser, date])

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Users</h2>
      <div className="flex gap-2 mb-3">
        <input className="flex-1 p-2 border rounded" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search username" />
        <button className="btn" onClick={search}>Search</button>
      </div>

      <div className="space-y-2 mb-4">
        {results.map((r) => (
          <button key={r.id} className="w-full card text-left" onClick={() => setSelectedUser(r)}>
            <div className="font-medium">{r.display_name || r.username}</div>
            <div className="text-xs text-slate-500">{r.username}</div>
          </button>
        ))}
      </div>

      {selectedUser && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-semibold">{selectedUser.display_name || selectedUser.username}</div>
              <div className="text-xs text-slate-500">Tasks on</div>
            </div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="p-2 border rounded" />
          </div>

          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="card">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-slate-500">{t.time_from} → {t.time_to}</div>
                  </div>
                  <div className="text-sm text-slate-400">{t.status}</div>
                </div>
              </div>
            ))}
            {tasks.length === 0 && <div className="text-slate-500">No tasks for this date</div>}
          </div>
        </div>
      )}
    </div>
  )
}
