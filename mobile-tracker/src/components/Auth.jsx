// src/components/Auth.jsx
import React, { useState } from 'react'
import { supabase } from '../api/supabaseClient'
import bcrypt from 'bcryptjs'

/**
 * Auth component (client-side prototype).
 *
 * Two modes:
 * - Quick prototype (client-side hashing + create app_users and sessions using anon key).
 *   This is NOT SECURE for production but useful to prototype quickly.
 *
 * - Optional production: call your server/Edge Function (see optional Edge Function code)
 *   to perform signup/login using a service role key. Swap out the client logic below
 *   with POST requests to your function.
 *
 * Security note is shown in UI as well.
 */

export default function Auth({ onSignedIn }) {
  const [mode, setMode] = useState('login') // login | signup
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function createSessionForUser(userId) {
    const token = cryptoRandomToken()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString() // 14 days
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt
      })
      .select('id, token')
      .maybeSingle()

    if (error) throw error
    return data
  }

  function cryptoRandomToken() {
    const arr = new Uint8Array(32)
    crypto.getRandomValues(arr)
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  async function handleSignup(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const usernameClean = username.trim().toLowerCase()
      if (!usernameClean || !password) throw new Error('username and password required')

      // Hash client-side (quick prototype). In production, move hashing to server.
      const salt = bcrypt.genSaltSync(10)
      const passwordHash = bcrypt.hashSync(password, salt)

      // create app_users row
      const { data: userData, error: insertErr } = await supabase
        .from('app_users')
        .insert({
          username: usernameClean,
          password_hash: passwordHash,
          display_name: displayName || usernameClean
        })
        .select('id, username, display_name')
        .maybeSingle()

      if (insertErr) throw insertErr

      // create session row
      const session = await createSessionForUser(userData.id)
      // store token locally
      localStorage.setItem('dlt_session_token', session.token)

      onSignedIn({ id: userData.id, username: userData.username, display_name: userData.display_name })
    } catch (err) {
      console.error(err)
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const usernameClean = username.trim().toLowerCase()
      if (!usernameClean || !password) throw new Error('username and password required')

      // fetch user record
      const { data: userRecord, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', usernameClean)
        .maybeSingle()

      if (error) throw error
      if (!userRecord) throw new Error('Invalid username or password')

      const matches = bcrypt.compareSync(password, userRecord.password_hash)
      if (!matches) throw new Error('Invalid username or password')

      // create a new session and store token
      const session = await (async () => {
        const token = cryptoRandomToken()
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString()
        const { data, error } = await supabase
          .from('sessions')
          .insert({ user_id: userRecord.id, token, expires_at: expiresAt })
          .select('id, token')
          .maybeSingle()
        if (error) throw error
        return data
      })()

      localStorage.setItem('dlt_session_token', session.token)

      onSignedIn({ id: userRecord.id, username: userRecord.username, display_name: userRecord.display_name })
    } catch (err) {
      console.error(err)
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md card">
        <h1 className="text-2xl font-semibold mb-2">Daily Life Tracker</h1>
        <p className="text-sm text-slate-500 mb-4">
          Mobile-first tracker. <strong>Prototype auth:</strong> username + password. See security notes below.
        </p>

        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 py-2 rounded ${mode === 'login' ? 'bg-primary text-white' : 'bg-slate-100'}`}
            onClick={() => setMode('login')}
            aria-pressed={mode === 'login'}
          >
            Login
          </button>
          <button
            className={`flex-1 py-2 rounded ${mode === 'signup' ? 'bg-primary text-white' : 'bg-slate-100'}`}
            onClick={() => setMode('signup')}
            aria-pressed={mode === 'signup'}
          >
            Signup
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
          <label className="block text-sm mb-1">Username</label>
          <input
            className="w-full p-2 rounded mb-3 border"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username (no email)"
          />
          {mode === 'signup' && (
            <>
              <label className="block text-sm mb-1">Display name (optional)</label>
              <input
                className="w-full p-2 rounded mb-3 border"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How you'd like to appear"
              />
            </>
          )}

          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            className="w-full p-2 rounded mb-4 border"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
          />

          {error && <div className="text-red-600 mb-2">{error}</div>}

          <button type="submit" className="w-full btn" disabled={loading}>
            {loading ? 'Working...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

        <div className="mt-4 text-xs text-slate-500">
          <strong>Security note:</strong> This client-side hashing + anon-key flow is for quick prototyping only. It exposes ability to create users/sessions with your anon key, and password hashing on the client is not recommended. For production, use the optional Edge Function (server-side) and enable Row Level Security (RLS) policies. See the README and provided Edge Function code for a recommended secure flow.
        </div>
      </div>
    </div>
  )
}
