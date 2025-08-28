// src/components/BottomNav.jsx
import React from 'react'

const items = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'users', label: 'Users', icon: '🔎' },
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'teams', label: 'Teams', icon: '👥' },
  { id: 'diary', label: 'Diary', icon: '📓' }
]

export default function BottomNav({ active, setActive }) {
  return (
    <nav
      className="fixed bottom-4 left-4 right-4 z-50 bg-white rounded-2xl p-2 shadow-lg flex justify-between items-center"
      role="toolbar"
      aria-label="Primary navigation"
    >
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => setActive(it.id)}
          className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg focus:outline-none ${
            active === it.id ? 'bg-slate-100' : ''
          }`}
          aria-pressed={active === it.id}
        >
          <div aria-hidden style={{ fontSize: 18 }}>
            {it.icon}
          </div>
          <div style={{ fontSize: 11 }} className="mt-1">
            {it.label}
          </div>
        </button>
      ))}
    </nav>
  )
}
