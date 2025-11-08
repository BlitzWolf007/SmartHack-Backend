import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'

function extractPeople(b){
  const keys = ['people_count','num_people','attendees','participants','people','headcount','pax']
  for (const k of keys) if (b?.[k] != null) return Number(b[k])
  if (b?.meta) {
    for (const k of keys) if (b.meta[k] != null) return Number(b.meta[k])
    if (b.meta.people != null) return Number(b.meta.people)
  }
  if (b?.details) {
    for (const k of keys) if (b.details[k] != null) return Number(b.details[k])
  }
  return undefined
}

export default function MyBookings(){
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelingId, setCancelingId] = useState(null)

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        const data = await api.myBookings()
        if (!mounted) return
        setItems(Array.isArray(data) ? data : [])
      }catch(e){
        if (!mounted) return
        setError(e.message || 'Failed to load bookings')
      }finally{
        if (mounted) setLoading(false)
      }
    })()
    return ()=>{ mounted=false }
  },[])

  async function cancel(id){
    if (!id) return
    const yes = confirm('Cancel this booking?')
    if (!yes) return
    setCancelingId(id)
    try{
      await api.deleteBooking(id)
      // remove from list locally
      setItems(prev => prev.filter(b => (b.id ?? b.booking_id) !== id))
    }catch(e){
      setError(e.message || 'Cancel failed')
    }finally{
      setCancelingId(null)
    }
  }

  return (
    <section className="grid" style={{marginTop:12}}>
      <header className="grid" style={{gap:6}}>
        <h2 style={{margin:0}}>My Bookings</h2>
        <p className="helper">Signed in as {user?.full_name || user?.email || '—'}</p>
      </header>

      {loading && <div className="card">Loading…</div>}
      {error && <div className="badge yellow">{error}</div>}

      {!loading && !error && (
        <div className="card">
          <h3>Upcoming & recent</h3>
          <ul style={{margin:0,paddingLeft:18}}>
            {items.map(b => {
              const id = b.id ?? b.booking_id
              const start = b.start_utc || b.start_time || b.start || b.startAt
              const end   = b.end_utc   || b.end_time   || b.end   || b.endAt
              const ppl   = extractPeople(b)
              return (
                <li key={id ?? `${b.space_id || b.room_id}-${start}`} className="mt-2">
                  <div style={{display:'flex', gap:8, alignItems:'center', justifyContent:'space-between'}}>
                    <div>
                      <strong>{b.title || b.name || 'Booking'}</strong>
                      <div className="helper">
                        Space: {b.space?.name || b.space_name || b.space_id || b.room_id}
                      </div>
                      <div className="helper">
                        {fmt(start)} → {fmt(end)} {ppl ? ` • ${ppl} ${ppl===1?'person':'people'}` : ''}
                      </div>
                    </div>
                    {id && (
                      <button
                        className="btn warn"
                        onClick={()=> cancel(id)}
                        disabled={cancelingId === id}
                        title="Cancel booking"
                      >
                        {cancelingId === id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
            {!items.length && <li className="helper">No bookings yet.</li>}
          </ul>
        </div>
      )}
    </section>
  )
}

function fmt(iso){
  if(!iso) return '—'
  try { return new Date(iso).toLocaleString() } catch { return iso }
}
