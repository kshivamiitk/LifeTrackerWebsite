// src/components/TeamsPage.jsx
import React, { useEffect, useState } from 'react'
import { supabase } from '../api/supabaseClient'

export default function TeamsPage({ user }) {
  const [teams, setTeams] = useState([])
  const [name, setName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [usernameToAdd, setUsernameToAdd] = useState('')

  useEffect(() => {
    loadTeams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadTeams() {
    const { data } = await supabase.from('teams').select('*').order('created_at', { ascending: false })
    setTeams(data || [])
  }

  async function createTeam(e) {
    e.preventDefault()
    if (!name) return
    const { data, error } = await supabase.from('teams').insert({ name }).select('*').maybeSingle()
    if (error) return console.error(error)
    // add current user as member
    await supabase.from('team_members').insert({ team_id: data.id, user_id: user.id })
    loadTeams()
    setName('')
  }

  async function addMember() {
    if (!selectedTeam || !usernameToAdd) return
    const { data: found } = await supabase.from('app_users').select('id').eq('username', usernameToAdd).maybeSingle()
    if (!found) return alert('User not found')
    await supabase.from('team_members').insert({ team_id: selectedTeam.id, user_id: found.id })
    alert('Member added')
    setUsernameToAdd('')
  }

  async function removeMember(memberId) {
    await supabase.from('team_members').delete().eq('id', memberId)
    alert('Member removed')
  }

  async function loadMembers(team) {
    const { data } = await supabase
      .from('team_members')
      .select('id, app_users(id,username,display_name)')
      .eq('team_id', team.id)
    return data || []
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Teams</h2>

      <form onSubmit={createTeam} className="flex gap-2 mb-3">
        <input className="flex-1 p-2 border rounded" value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" />
        <button className="btn">Create</button>
      </form>

      <div className="space-y-2">
        {teams.map((t) => (
          <div className="card" key={t.id}>
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-slate-500">created {new Date(t.created_at).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <button
                  className="py-1 px-2 rounded border"
                  onClick={async () => {
                    const members = await loadMembers(t)
                    setSelectedTeam({ ...t, members })
                  }}
                >
                  Members
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedTeam && (
        <div className="mt-4 card">
          <div className="flex justify-between items-center mb-2">
            <div className="font-semibold">{selectedTeam.name}</div>
            <button className="py-1 px-2 rounded border" onClick={() => setSelectedTeam(null)}>
              Close
            </button>
          </div>

          <div className="mb-2">
            <div className="text-xs text-slate-500">Add member by username</div>
            <div className="flex gap-2 mt-2">
              <input value={usernameToAdd} onChange={(e) => setUsernameToAdd(e.target.value)} className="flex-1 p-2 border rounded" />
              <button className="btn" onClick={addMember}>Add</button>
            </div>
          </div>

          <div className="space-y-2">
            {selectedTeam.members && selectedTeam.members.length ? (
              selectedTeam.members.map((m) => (
                <div className="flex items-center justify-between" key={m.id}>
                  <div>
                    <div className="font-medium">{m.app_users.display_name || m.app_users.username}</div>
                    <div className="text-xs text-slate-500">{m.app_users.username}</div>
                  </div>
                  <div>
                    <button className="py-1 px-2 rounded border" onClick={() => removeMember(m.id)}>Remove</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-500">No members</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
