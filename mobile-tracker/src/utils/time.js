// src/utils/time.js
export function toISODateString(date) {
    const d = new Date(date)
    return d.toISOString().split('T')[0]
  }
  
  export function secondsBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 1000)
  }
  
  /**
   * Parse time range strings "HH:MM" into seconds-of-day
   */
  export function parseTimeToSeconds(t) {
    if (!t) return 0
    const [h, m] = t.split(':').map(Number)
    return (h || 0) * 3600 + (m || 0) * 60
  }
  
  export function durationHuman(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h) return `${h}h ${m}m`
    if (m) return `${m}m ${s}s`
    return `${s}s`
  }
  