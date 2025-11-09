// frontend/src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from 'react'
import { api, SPACE_TYPES } from '../lib/api.js'

function looksAdmin(me) {
  if (!me) return false
  const lc = v => String(v ?? '').toLowerCase()
  // direct flags
  if (me.is_admin === true) return true
  if (me.admin === true) return true

  // flat role
  if (lc(me.role) === 'admin') return true
  // enum-ish object or nested user.role
  if (lc(me?.user?.role) === 'admin') return true
  if (lc(me?.role?.name) === 'admin') return true
  if (lc(me?.role?.value) === 'admin') return true
  if (lc(me?.role?.type) === 'admin') return true

  // arrays / permissions
  if (Array.isArray(me.roles) && me.roles.map(lc).includes('admin')) return true
  if (Array.isArray(me.permissions) && me.permissions.map(lc).includes('approve_bookings')) return true

  // jwt claims sometimes surface as strings like "Role.admin"
  if (/admin$/.test(lc(me?.role))) return true

  return false
}

export default function Dashboard() {
  const [spaces, setSpaces] = useState([])
  const [bookingsToday, setBookingsToday] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Admin state (boolean, robust detection)
  const [isAdmin, setIsAdmin] = useState(false)
  const [pending, setPending] = useState([])
  const [pendingLoading, setPendingLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // Detect role without breaking anything else
        const me = await api.me().catch(() => null)
        if (mounted) setIsAdmin(looksAdmin(me))

        const s = await api.spaces()
        if (!mounted) return
        const list = Array.isArray(s) ? s : (s?.items || [])
        // remove meeting rooms (unchanged)
        setSpaces(list.filter(sp => sp.type !== 'meeting_room'))

        const today = new Date()
        const yyyy = today.getFullYear()
        const mm = String(today.getMonth() + 1).padStart(2, '0')
        const dd = String(today.getDate()).padStart(2, '0')
        const dateStr = `${yyyy}-${mm}-${dd}`

        const b = await api.bookingsOn(dateStr)
        if (!mounted) return
        // unchanged filter
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

  // Fetch pending if we THINK we’re admin;
  // Safety net: if the call succeeds even when isAdmin=false, we flip it on.
  useEffect(() => {
    let alive = true

    async function loadPending(tryAnyway=false) {
      setPendingLoading(true)
      try {
        const items = await api.pendingBookings()
        if (!alive) return
        if (Array.isArray(items) && items.length >= 0) {
          setPending(items)
          // if backend allowed it, ensure the section is visible
          if (!isAdmin && tryAnyway) setIsAdmin(true)
        }
      } catch {
        if (alive) setPending([])
      } finally {
        if (alive) setPendingLoading(false)
      }
    }

    if (isAdmin) {
      loadPending(false)
    } else {
      // Attempt once; if it 200s, we’ll show the card.
      loadPending(true)
    }

    return () => { alive = false }
  }, [isAdmin])

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
    <section className="grid" style={{ marginTop: 12, marginRight: 15, marginLeft: 15 }}>
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

          {/* Admin-only pending approvals (now robustly detected) */}
          {isAdmin && (
            <div className="card">
              <h3>Pending booking requests</h3>
              {pendingLoading ? (
                <p className="helper">Loading pending requests…</p>
              ) : pending.length === 0 ? (
                <p className="helper">No pending requests.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {pending.map(b => (
                    <li key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <strong>{b.title || 'Booking'}</strong> —{' '}
                        <span className="helper">
                          {b.space?.name || b.space_name || `Space #${b.space_id}`}
                        </span>
                        <div className="helper" style={{ marginTop: 2 }}>
                          {new Date(b.start_utc || b.start).toLocaleString()} →{' '}
                          {new Date(b.end_utc || b.end).toLocaleString()} • attendees:{' '}
                          {b.attendees ?? b.people_count ?? b.num_people ?? 1}
                          {b.status ? ` • status: ${b.status}` : ''}
                        </div>
                      </div>
                      <button
                        className="btn success"
                        onClick={async () => {
                          try {
                            await api.approveBooking(b.id)
                            setPending(list => list.filter(x => x.id !== b.id))
                          } catch (e) {
                            alert(e.message || 'Approve failed')
                          }
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="btn warn"
                        onClick={async () => {
                          try {
                            await api.rejectBooking(b.id)
                            setPending(list => list.filter(x => x.id !== b.id))
                          } catch (e) {
                            alert(e.message || 'Reject failed')
                          }
                        }}
                      >
                        Reject
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function labelize(s) {
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
