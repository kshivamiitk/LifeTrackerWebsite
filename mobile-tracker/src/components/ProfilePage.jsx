// src/components/ProfilePage.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from '../api/supabaseClient'

export default function ProfilePage({ user, onLogout }) {
  const [stats, setStats] = useState({ total: 0, completed: 0 })

  useEffect(() => {
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchStats() {
    const { data: totalData } = await supabase.from('tasks').select('id').eq('user_id', user.id)
    const { data: completedData } = await supabase.from('tasks').select('id').eq('user_id', user.id).eq('status', 'completed')
    setStats({
      total: totalData ? totalData.length : 0,
      completed: completedData ? completedData.length : 0
    })
  }

  const commitment = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{user.display_name || user.username}</h2>
          <div className="text-xs text-slate-500">@{user.username}</div>
        </div>
        <div>
          <button className="py-2 px-3 rounded border" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="mt-4 card">
        <div className="text-sm text-slate-500">Total tasks</div>
        <div className="text-2xl font-bold">{stats.total}</div>

        <div className="text-sm text-slate-500 mt-3">Completed</div>
        <div className="text-2xl font-bold">{stats.completed}</div>

        <div className="mt-3 text-sm text-slate-500">Commitment</div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden mt-1">
          <div style={{ width: `${commitment}%` }} className="h-3 rounded-full bg-primary" />
        </div>
        <div className="text-xs text-slate-500 mt-1">{commitment}%</div>
      </div>
    </div>
  )
}
