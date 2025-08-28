// src/components/DiaryPage.jsx
import React, { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { getDiary, upsertDiary, deleteDiary, listDiariesForMonth } from '../api/diaryService'
import { durationHuman } from '../utils/time' // optional helper if you want human durations
dayjs.extend(relativeTime)

/**
 * DiaryPage — modular diary per day
 *
 * Features:
 * - Pick date (prev/next buttons & date input)
 * - Create / update / delete diary for the selected date
 * - Autosave drafts to localStorage with debounce (so closing doesn't lose work)
 * - Monthly list/preview (left column on larger screens; collapses nicely on mobile)
 * - Mobile-first styling (Tailwind classes) and graceful fallback CSS assumed in your index.css
 *
 * Props:
 * - user (object with id required)
 *
 * Notes:
 * - Diary content stored in `diaries` table with columns (id, user_id, diary_date, content)
 * - Uses `YYYY-MM-DD` date string format.
 */
export default function DiaryPage({ user }) {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [content, setContent] = useState('')
  const [diaryRow, setDiaryRow] = useState(null) // existing DB row for the picked date
  const [loading, setLoading] = useState(false)
  const [monthEntries, setMonthEntries] = useState([])
  const [yearMonth, setYearMonth] = useState({ year: dayjs().year(), month: dayjs().month() + 1 }) // month: 1-12

  // autosave draft localStorage key
  const draftKey = `dltr_diary_draft_${user?.id || 'anon'}_${date}`
  const autosaveTimer = useRef(null)
  const [savingDraft, setSavingDraft] = useState(false)

  // load diary for selected date
  async function loadDiaryFor(dateStr) {
    if (!user?.id) {
      setDiaryRow(null)
      setContent('')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await getDiary(user.id, dateStr)
      if (error) throw error
      setDiaryRow(data || null)
      // load draft if exists, else load DB content
      const draft = localStorage.getItem(`dltr_diary_draft_${user.id}_${dateStr}`)
      if (draft != null) {
        setContent(draft)
      } else {
        setContent((data && data.content) || '')
      }
    } catch (err) {
      console.error('loadDiaryFor error', err)
      setDiaryRow(null)
      setContent('')
    } finally {
      setLoading(false)
    }
  }

  // load diaries for current month (for list/preview)
  async function loadMonthEntries(year, month) {
    if (!user?.id) return
    try {
      const { data, error } = await listDiariesForMonth(user.id, year, month)
      if (error) throw error
      setMonthEntries(data || [])
    } catch (err) {
      console.error('loadMonthEntries error', err)
      setMonthEntries([])
    }
  }

  useEffect(() => {
    loadDiaryFor(date)
    loadMonthEntries(yearMonth.year, yearMonth.month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, user?.id, yearMonth.year, yearMonth.month])

  // date navigation helpers
  function gotoPrev() {
    const prev = dayjs(date).subtract(1, 'day').format('YYYY-MM-DD')
    setDate(prev)
    // if changed month adjust month view
    const d = dayjs(prev)
    setYearMonth({ year: d.year(), month: d.month() + 1 })
  }
  function gotoNext() {
    const next = dayjs(date).add(1, 'day').format('YYYY-MM-DD')
    setDate(next)
    const d = dayjs(next)
    setYearMonth({ year: d.year(), month: d.month() + 1 })
  }

  // autosave draft (debounced)
  useEffect(() => {
    // save on content change after 700ms
    clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, content)
        setSavingDraft(true)
        setTimeout(() => setSavingDraft(false), 700)
      } catch (e) {
        console.warn('autosave failed', e)
      }
    }, 700)
    return () => clearTimeout(autosaveTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, date, user?.id])

  // Save (create or update) diary to DB — clears local draft
  async function handleSave() {
    if (!user?.id) {
      alert('You must be logged in to save diary.')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await upsertDiary(user.id, date, content)
      if (error) throw error
      setDiaryRow(data || null)
      // clear local draft
      try {
        localStorage.removeItem(draftKey)
      } catch {}
      // refresh month list
      loadMonthEntries(dayjs(date).year(), dayjs(date).month() + 1)
      alert('Diary saved.')
    } catch (err) {
      console.error('handleSave error', err)
      alert('Could not save diary — check console')
    } finally {
      setLoading(false)
    }
  }

  // Delete diary for selected date
  async function handleDelete() {
    if (!diaryRow?.id) {
      alert('No diary to delete for this date.')
      return
    }
    if (!confirm('Delete diary for this date? This cannot be undone.')) return
    setLoading(true)
    try {
      const { error } = await deleteDiary(diaryRow.id)
      if (error) throw error
      setDiaryRow(null)
      setContent('')
      try {
        localStorage.removeItem(draftKey)
      } catch {}
      loadMonthEntries(dayjs(date).year(), dayjs(date).month() + 1)
      alert('Diary deleted.')
    } catch (err) {
      console.error('handleDelete error', err)
      alert('Could not delete diary — check console')
    } finally {
      setLoading(false)
    }
  }

  // clear local draft (keeps DB intact)
  function discardDraft() {
    if (!confirm('Discard local draft for this date?')) return
    try {
      localStorage.removeItem(draftKey)
      setContent(diaryRow?.content || '')
      alert('Draft discarded (DB remains).')
    } catch (e) {
      console.warn('discard draft error', e)
    }
  }

  // quick-select a date from month list
  function selectDateFromList(dstr) {
    setDate(dstr)
    const d = dayjs(dstr)
    setYearMonth({ year: d.year(), month: d.month() + 1 })
    // loadDiaryFor will be triggered by date effect
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Left column: month list/preview (collapses on small screens) */}
      <aside className="w-full md:w-72">
        <div className="card p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Calendar — {yearMonth.year}-{String(yearMonth.month).padStart(2, '0')}</div>
            <div className="flex gap-1">
              <button
                className="px-2 py-1 rounded border"
                onClick={() => {
                  const m = dayjs(`${yearMonth.year}-${String(yearMonth.month).padStart(2, '0')}-01`).subtract(1, 'month')
                  setYearMonth({ year: m.year(), month: m.month() + 1 })
                }}
                aria-label="Previous month"
              >
                ‹
              </button>
              <button
                className="px-2 py-1 rounded border"
                onClick={() => {
                  const m = dayjs(`${yearMonth.year}-${String(yearMonth.month).padStart(2, '0')}-01`).add(1, 'month')
                  setYearMonth({ year: m.year(), month: m.month() + 1 })
                }}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
          </div>

          <div className="text-sm text-slate-600 mb-2">Diary entries this month</div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {monthEntries.length === 0 && <div className="text-slate-500">No diaries this month</div>}
            {monthEntries.map((m) => (
              <button
                key={m.id}
                onClick={() => selectDateFromList(m.diary_date)}
                className="w-full text-left p-2 rounded hover:bg-slate-50 flex items-start gap-2"
                aria-pressed={m.diary_date === date}
              >
                <div className="w-14 text-xs text-slate-500">{dayjs(m.diary_date).format('MMM D')}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{(m.content || '').slice(0, 80) || '—'}</div>
                  <div className="text-xs text-slate-400">{(m.content || '').length > 80 ? '…' : ''}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-3">
          <div className="text-sm text-slate-600 mb-2">Quick navigation</div>
          <div className="flex gap-2">
            <button className="flex-1 py-2 rounded border" onClick={() => { setDate(dayjs().format('YYYY-MM-DD')); setYearMonth({ year: dayjs().year(), month: dayjs().month() + 1 }) }}>
              Today
            </button>
            <button className="py-2 px-3 rounded border" onClick={() => { setDate(dayjs(date).format('YYYY-MM-DD')); }}>
              Go
            </button>
          </div>
        </div>
      </aside>

      {/* Main column: editor for selected date */}
      <main className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-slate-500">Selected date</div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 rounded border" onClick={gotoPrev} aria-label="Previous day">‹ Prev</button>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  const d = e.target.value
                  if (d) {
                    setDate(d)
                    const dd = dayjs(d)
                    setYearMonth({ year: dd.year(), month: dd.month() + 1 })
                  }
                }}
                className="p-2 border rounded"
                aria-label="Diary date"
              />
              <button className="px-2 py-1 rounded border" onClick={gotoNext} aria-label="Next day">Next ›</button>
              <div className="text-sm text-slate-400 ml-3">{dayjs(date).format('dddd, MMM D, YYYY')}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500 mr-2">Draft saved:</div>
            <div className="text-sm text-slate-600">{savingDraft ? 'saving…' : 'saved'}</div>
            <button className="px-3 py-2 rounded border" onClick={handleSave} aria-disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
            <button className="px-3 py-2 rounded border text-red-600" onClick={handleDelete}>Delete</button>
            <button className="px-3 py-2 rounded border" onClick={discardDraft}>Discard draft</button>
          </div>
        </div>

        <div className="card p-3 mb-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your diary for this day…"
            className="w-full min-h-[40vh] p-3 border rounded resize-vertical"
            aria-label="Diary content"
          />
        </div>

        <div className="text-sm text-slate-500">
          Tips: your draft is auto-saved locally. Use Save to persist to Supabase. Use the left panel to jump between days in the month.
        </div>
      </main>
    </div>
  )
}
