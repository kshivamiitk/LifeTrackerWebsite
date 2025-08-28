// src/components/App.jsx
import React, { useEffect, useState } from 'react'
import Auth from './Auth'
import BottomNav from './BottomNav'
import Dashboard from './Dashboard'
import CalendarPage from './CalendarPage'
import UsersPage from './UsersPage'
import ProfilePage from './ProfilePage'
import TeamsPage from './TeamsPage'
import DiaryPage from './DiaryPage'
import { loadUserFromLocalToken, supabase } from '../api/supabaseClient'

export default function App() {
  const [user, setUser] = useState(null)
  const [active, setActive] = useState('dashboard') // 'dashboard' | 'calendar' | 'users' | 'profile' | 'teams' | 'diary'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const result = await loadUserFromLocalToken()
      if (result?.user) setUser(result.user)
      setLoading(false)
    }
    init()

    // Optional: listener for auth changes if you use Edge Function/Server-side later
  }, [])

  async function handleLogout() {
    localStorage.removeItem('dlt_session_token')
    setUser(null)
    setActive('dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loader mb-4" />
          <div>Loading...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Auth onSignedIn={(u) => setUser(u)} />
  }

  return (
    <div className="app min-h-screen bg-slate-50">
      <main className="px-4 pt-4 pb-28">
        {active === 'dashboard' && <Dashboard user={user} />}
        {active === 'calendar' && <CalendarPage user={user} />}
        {active === 'users' && <UsersPage user={user} />}
        {active === 'profile' && <ProfilePage user={user} onLogout={handleLogout} />}
        {active === 'teams' && <TeamsPage user={user} />}
        {active === 'diary' && <DiaryPage user={user} />}
      </main>

      <BottomNav active={active} setActive={setActive} />
    </div>
  )
}
