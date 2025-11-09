import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function MyBookings(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [debug, setDebug] = useState(null)

  async function load(){
    setLoading(true); setError(''); setDebug(null)
    try{
      const data = await api.myBookings()
      setItems(Array.isArray(data) ? data : [])
    }catch(e){
      setError(e?.message || 'Failed to load')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])

  async function onCancel(b){
    // optimistic UI
    const prev = items
    setItems(prev.map(x => x.id === b.id ? { ...x, status:'cancelled' } : x))
    setError(''); setDebug(null)
    try {
      const res = await api.deleteBooking(b.id)
      setDebug(res?.attempts || null)
      // hard refresh list to reflect backend state (avoids ghost rows)
      await load()
    } catch (e) {
      setError(e?.message || 'Cancel failed')
      setDebug(e?.attempts || null)
      setItems(prev) // rollback on failure
    }
  }

  function fmtWhen(b){
    const start = new Date(b.start_utc || b.start || b.start_time)
    const end   = new Date(b.end_utc   || b.end   || b.end_time)
    if (isNaN(start)) return '-'
    const endStr = isNaN(end) ? '' : ` → ${end.toLocaleTimeString()}`
    return `${start.toLocaleString()}${endStr}`
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>My bookings</h1>
        <button className="btn" onClick={load} style={{marginLeft: 'auto'}}>Refresh</button>
      </header>

      {loading ? (
        <div className="helper">Loading…</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Title</th>
              <th>Space</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(b => (
              <tr key={b.id}>
                <td>{fmtWhen(b)}</td>
                <td>{b.title || `Booking #${b.id}`}</td>
                <td>{b.space?.name || b.space_name || b.space_id}</td>
                <td style={{textTransform:'capitalize'}}>{b.status || 'pending'}</td>
                <td>
                  <button
                    className="btn small ghost"
                    disabled={(b.status||'').toLowerCase()==='cancelled'}
                    onClick={()=>onCancel(b)}
                  >
                    {(b.status||'').toLowerCase()==='cancelled' ? 'Cancelled' : 'Cancel'}
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan="5" className="helper">No bookings.</td></tr>}
          </tbody>
        </table>
      )}

      {debug && (
        <details style={{marginTop: 12}}>
          <summary style={{cursor:'pointer'}}>Cancel debug ({debug.length} attempts)</summary>
          <div style={{marginTop:8, fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono"', fontSize:12}}>
            {debug.map((a,i)=>(
              <div key={i} style={{padding:'6px 8px', border:'1px solid #1f2937', borderRadius:8, marginBottom:6}}>
                <div><strong>{a.method} {a.path}</strong></div>
                <div>Status: {a.status} {a.ok ? 'OK' : ''}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  )
}
