import { useEffect, useMemo, useState } from 'react'
import { api, SPACE_TYPES } from '../lib/api.js'

export default function Dashboard() {
  const [spaces, setSpaces] = useState([])
  const [bookingsToday, setBookingsToday] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const s = await api.spaces()
        if (!mounted) return
        const list = Array.isArray(s) ? s : (s?.items || [])
        // remove meeting rooms
        setSpaces(list.filter(sp => sp.type !== 'meeting_room'))

        const today = new Date()
        const yyyy = today.getFullYear()
        const mm = String(today.getMonth() + 1).padStart(2, '0')
        const dd = String(today.getDate()).padStart(2, '0')
        const dateStr = `${yyyy}-${mm}-${dd}`

        const b = await api.bookingsOn(dateStr)
        if (!mounted) return
        // optionally filter out bookings tied to meeting rooms
        setBookingsToday(
          (Array.isArray(b) ? b : []).filter(
            bk =>
              (bk.space?.type ?? bk.type) !== 'meeting_room' &&
              (bk.space_type ?? '') !== 'meeting_room'
          )
        )
      } catch (e) {
        if (!mounted) return
        setError(e.message || 'Failed to load dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const bookedSpaceIds = useMemo(() => {
    const ids = new Set()
    for (const b of bookingsToday) {
      const sid = b.space_id ?? b.room_id ?? b.space?.id
      if (sid != null) ids.add(String(sid))
    }
    return ids
  }, [bookingsToday])

  const totalsByType = useMemo(() => {
    const map = {}
    for (const t of SPACE_TYPES.filter(t => t !== 'meeting_room')) map[t] = 0
    for (const s of spaces) map[s.type] = (map[s.type] || 0) + 1
    return map
  }, [spaces])

  const startingSoon = useMemo(() => {
    const now = Date.now()
    const sixHours = 6 * 60 * 60 * 1000
    const arr = bookingsToday
      .map(b => ({ ...b, start: b.start_utc || b.start_time || b.start || b.startAt }))
      .filter(b => b.start)
      .map(b => ({ ...b, t: new Date(b.start).getTime() }))
      .filter(b => b.t >= now && b.t - now <= sixHours)
      .sort((a, b) => a.t - b.t)
      .slice(0, 5)
    return arr
  }, [bookingsToday])

  return (
    <section className="grid" style={{ marginTop: 12 }}>
      <header className="grid" style={{ gap: 6 }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <p className="helper">Quick glance at today’s capacity and bookings.</p>
      </header>

      {loading && <div className="card">Loading…</div>}
      {error && <div className="badge yellow">{error}</div>}

      {!loading && !error && (
        <>
          <div className="grid cols-3" style={{ gap: 12 }}>
            <div className="card">
              <h3>Total spaces</h3>
              <p style={{ fontSize: '2rem', margin: 0 }}>{spaces.length}</p>
            </div>
            <div className="card">
              <h3>Bookings today</h3>
              <p style={{ fontSize: '2rem', margin: 0 }}>{bookingsToday.length}</p>
            </div>
            <div className="card">
              <h3>Estimated available</h3>
              <p style={{ fontSize: '2rem', margin: 0 }}>
                {Math.max(0, spaces.length - bookedSpaceIds.size)}
              </p>
              <p className="helper" style={{ marginTop: 6 }}>
                Distinct spaces without any booking today.
              </p>
            </div>
          </div>

          <div className="grid cols-3" style={{ gap: 12 }}>
            {SPACE_TYPES.filter(t => t !== 'meeting_room').map(t => (
              <div key={t} className="card">
                <h4 style={{ marginTop: 0 }}>{labelize(t)}</h4>
                <p style={{ fontSize: '1.5rem', margin: 0 }}>{totalsByType[t] ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Starting soon</h3>
            {startingSoon.length === 0 ? (
              <p className="helper">No bookings starting in the next 6 hours.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {startingSoon.map(b => (
                  <li key={b.id ?? `${b.space_id}-${b.t}`}>
                    <strong>{b.title || 'Booking'}</strong> —{' '}
                    {new Date(b.t).toLocaleTimeString()} —{' '}
                    <span className="helper">
                      Space: {b.space?.name || b.space_name || b.space_id || b.room_id}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function labelize(s) {
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
