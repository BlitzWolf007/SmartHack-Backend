import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Dashboard() {
  const { user } = useAuth()
  const [spaces, setSpaces] = useState([])
  const [bookingsMonth, setBookingsMonth] = useState([]) // used for "Starting Soon"
  const [bookingsMonthCount, setBookingsMonthCount] = useState(0) // authoritative DB/aggregate count
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Admin pending approvals
  const [pending, setPending] = useState([])
  const [pendingLoading, setPendingLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    let mounted = true
    ;(async () => {
      try {
        // spaces
        const s = await api.spaces()
        if (!mounted) return
        const list = Array.isArray(s) ? s : s?.items || []
        setSpaces(list.filter(sp => sp.type !== 'meeting_room'))

        // month range for "Starting Soon" (kept for UX)
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
        const endOfMonth   = new Date(now.getFullYear(), now.getMonth()+1, 0, 23, 59, 59, 999)
        const arr = await api.bookingsInRange(startOfMonth.toISOString(), endOfMonth.toISOString())
        if (!mounted) return
        setBookingsMonth(Array.isArray(arr) ? arr : [])

        // authoritative monthly count (DB/stats if available)
        const cnt = await api.bookingsCountForMonth(now.getFullYear(), now.getMonth()+1)
        if (!mounted) return
        setBookingsMonthCount(Number(cnt) || 0)
      } catch (e) {
        if (!mounted) return
        setError(e.message || 'Failed to load dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [user])

  // Admin: pending approvals
  useEffect(() => {
    if (!user || String(user?.role || '').toLowerCase() !== 'admin') return
    let alive = true
    setPendingLoading(true)
    api.pendingBookings()
      .then(items => { if (alive) setPending(Array.isArray(items) ? items : []) })
      .catch(() => { if (alive) setPending([]) })
      .finally(() => { if (alive) setPendingLoading(false) })
    return () => { alive = false }
  }, [user])

  // Occupied space ids in this month (approx)
  const bookedSpaceIds = useMemo(() => {
    const ids = new Set()
    for (const b of bookingsMonth) {
      const sid = b.space_id ?? b.room_id ?? b.space?.id
      if (sid != null) ids.add(String(sid))
    }
    return ids
  }, [bookingsMonth])

  // Bookings starting in next 6h
  const startingSoon = useMemo(() => {
    const now = Date.now()
    const sixHours = 6 * 60 * 60 * 1000
    return bookingsMonth
      .map(b => ({ ...b, start: b.start_utc || b.start_time || b.start || b.startAt }))
      .filter(b => b.start)
      .map(b => ({ ...b, t: new Date(b.start).getTime() }))
      .filter(b => b.t >= now && b.t - now <= sixHours)
      .sort((a, b) => a.t - b.t)
      .slice(0, 5)
  }, [bookingsMonth])

  const rowColors = {
    firstRow: 'rgba(65, 155, 210, 0.7)', // light blue
    secondRow: 'rgba(245, 120, 45, 0.7)', // orange
  }
  const lightGrey = 'rgba(255,255,255,0.7)'

  if (!user) {
    return (
      <div style={{ textAlign: 'center', marginTop: 80, color: '#fff', fontSize: '1.2rem' }}>
        You must log in to view the Dashboard.
      </div>
    )
  }

  return (
    <section
      style={{
        marginTop: 30,
        marginInline: 'auto',
        maxWidth: 1200,
        textAlign: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <header style={{ marginBottom: 35 }}>
        <h2 style={{ margin: 0, fontSize: '2.6rem', fontWeight: 700, color: '#FFFFFF' }}>
          Dashboard
        </h2>
        <p style={{ margin: '8px 0 0 0', fontSize: '1.05rem', color: lightGrey }}>
          Quick glance at capacity and this month’s bookings
        </p>
      </header>

      {loading && <div style={{ color: '#fff' }}>Loading…</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}

      {!loading && !error && (
        <>
          {/* STARTING SOON */}
          <div
            style={{
              backgroundColor: rowColors.firstRow,
              borderRadius: 16,
              padding: 20,
              boxShadow:
                '0 8px 18px rgba(0,0,0,0.25), 0 -2px 10px rgba(255,255,255,0.2) inset',
              marginBottom: 35,
              textAlign: 'left',
              transition: 'transform 0.25s ease, box-shadow 0.25s ease',
              cursor: 'default',
            }}
          >
            <h3
              style={{
                textAlign: 'center',
                fontSize: '1.2rem',
                color: '#FFFFFF',
                opacity: 0.9,
                marginBottom: 14,
              }}
            >
              Starting Soon
            </h3>
            {startingSoon.length === 0 ? (
              <p style={{ textAlign: 'center', color: lightGrey, fontSize: '0.95rem' }}>
                No bookings starting in the next 6 hours.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0, gap: 10 }}>
                {startingSoon.map(b => (
                  <li
                    key={b.id ?? `${b.space_id}-${b.t}`}
                    style={{
                      background: 'rgba(0,0,0,0.05)',
                      padding: '10px 14px',
                      borderRadius: 10,
                      fontSize: '0.95rem',
                      color: '#FFFFFF',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                    }}
                  >
                    <strong>{b.title || 'Booking'}</strong> —{' '}
                    <span style={{ color: lightGrey }}>
                      {new Date(b.t).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span
                      style={{
                        color: lightGrey,
                        display: 'block',
                        marginTop: 2,
                        fontSize: '0.85rem',
                      }}
                    >
                      Space: {b.space?.name || b.space_name || b.space_id || b.room_id}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* SUMMARY (no category cards) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'stretch',
              gap: 60,
              marginBottom: 30,
            }}
          >
            {[
              { title: 'Total Spaces', value: spaces.length },
              { title: 'Bookings This Month', value: bookingsMonthCount }, // authoritative
              {
                title: 'Distinct Spaces Occupied',
                value: bookedSpaceIds.size,
              },
            ].map(card => (
              <div
                key={card.title}
                style={{
                  flex: '1 1 0',
                  background: rowColors.secondRow,
                  borderRadius: 16,
                  padding: '32px 24px',
                  boxShadow:
                    '0 6px 12px rgba(0,0,0,0.2), 0 -1px 6px rgba(255,255,255,0.1) inset',
                  backdropFilter: 'blur(6px)',
                  textAlign: 'center',
                  transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  cursor: 'default',
                  color: '#FFFFFF',
                }}
              >
                <h3 style={{ margin: '0 0 8px 0', fontWeight: 600 }}>{card.title}</h3>
                <p style={{ fontSize: '2.4rem', margin: 0, fontWeight: 700 }}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Admin pending approvals */}
          {String(user?.role || '').toLowerCase() === 'admin' && (
            <div
              style={{
                marginTop: 20,
                backgroundColor: 'rgba(0,0,0,0.25)',
                borderRadius: 16,
                padding: 20,
                boxShadow: '0 8px 18px rgba(0,0,0,0.25)',
                textAlign: 'left',
              }}
            >
              <h3 style={{ color: '#fff', marginTop: 0, textAlign: 'center' }}>
                Pending booking requests
              </h3>

              {pendingLoading ? (
                <p style={{ color: lightGrey, textAlign: 'center' }}>Loading pending requests…</p>
              ) : pending.length === 0 ? (
                <p style={{ color: lightGrey, textAlign: 'center' }}>No pending requests.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {pending.map(b => (
                    <li
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 10,
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 10,
                        padding: '12px 14px',
                        color: '#fff',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <strong>{b.title || 'Booking'}</strong>{' '}
                        <span style={{ color: lightGrey }}>
                          — {b.space?.name || b.space_name || `Space #${b.space_id}`}
                        </span>
                        <div style={{ color: lightGrey, fontSize: '0.9rem', marginTop: 2 }}>
                          {new Date(b.start_utc || b.start).toLocaleString()} →{' '}
                          {new Date(b.end_utc || b.end).toLocaleString()} • attendees:{' '}
                          {b.attendees ?? b.people_count ?? b.num_people ?? 1}
                          {b.status ? ` • status: ${b.status}` : ''}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await api.approveBooking(b.id)
                            setPending(list => list.filter(x => x.id !== b.id))
                          } catch (e) {
                            alert(e.message || 'Approve failed')
                          }
                        }}
                        style={{
                          background: '#2ecc71',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await api.rejectBooking(b.id)
                            setPending(list => list.filter(x => x.id !== b.id))
                          } catch (e) {
                            alert(e.message || 'Reject failed')
                          }
                        }}
                        style={{
                          background: '#e67e22',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontWeight: 600,
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
