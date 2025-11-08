import { useEffect, useState } from 'react'
import { api, SPACE_TYPES, USE_TYPES } from '../lib/api.js'
import { useNavigate } from 'react-router-dom'

export default function Spaces(){
  const [spaces,setSpaces] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [filters, setFilters] = useState({ q:'', type:'', use:'', capacityMin:'', capacityMax:'' })
  const nav = useNavigate()

  async function load(){
    setLoading(true); setError('')
    try{
      const f = {
        q: filters.q || undefined,
        name: filters.q || undefined,  // some backends look for "name"
        type: filters.type || undefined,
        use: filters.use || undefined,
        capacity_min: filters.capacityMin || undefined,
        capacity_max: filters.capacityMax || undefined,
      }
      const data = await api.spaces(f)
      setSpaces(Array.isArray(data) ? data : (data?.items || []))
    }catch(e){ setError(e.message) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ load() },[]) // eslint-disable-line

  function submit(e){ e.preventDefault(); load() }

  return (
    <section className="grid" style={{marginTop:12}}>
      <header className="grid" style={{gap:6}}>
        <h2 style={{margin:0}}>Spaces</h2>
        <p className="helper">Filter and pick a space, then book on the next page.</p>
      </header>

      <div className="card">
        <form onSubmit={submit}>
          <div className="grid cols-2">
            <div className="form-row">
              <label className="label" htmlFor="q">Search</label>
              <input id="q" className="input" placeholder="name / code / keyword"
                     value={filters.q} onChange={e=>setFilters({...filters, q:e.target.value})}/>
            </div>
            <div className="form-row">
              <label className="label" htmlFor="type">Type</label>
              <select id="type" className="input"
                      value={filters.type} onChange={e=>setFilters({...filters, type:e.target.value})}>
                <option value="">Any</option>
                {SPACE_TYPES.map(t => <option key={t} value={t}>{labelize(t)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid cols-2">
            <div className="form-row">
              <label className="label" htmlFor="use">Use</label>
              <select id="use" className="input"
                      value={filters.use} onChange={e=>setFilters({...filters, use:e.target.value})}>
                <option value="">Any</option>
                {USE_TYPES.map(u => <option key={u} value={u}>{labelize(u)}</option>)}
              </select>
            </div>
            <div className="grid cols-2">
              <div className="form-row">
                <label className="label" htmlFor="cmin">Min capacity</label>
                <input id="cmin" className="input" type="number" min="0"
                       value={filters.capacityMin} onChange={e=>setFilters({...filters, capacityMin:e.target.value})}/>
              </div>
              <div className="form-row">
                <label className="label" htmlFor="cmax">Max capacity</label>
                <input id="cmax" className="input" type="number" min="0"
                       value={filters.capacityMax} onChange={e=>setFilters({...filters, capacityMax:e.target.value})}/>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn accent" type="submit">Apply filters</button>
            <button className="btn ghost" type="button" onClick={()=>{
              setFilters({ q:'', type:'', use:'', capacityMin:'', capacityMax:'' }); load()
            }}>Reset</button>
          </div>
        </form>
      </div>

      {loading && <div className="card">Loading…</div>}
      {error && <div className="badge yellow">{error}</div>}

      {!loading && !error && (
        <div className="grid" style={{gap:12}}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Capacity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {spaces.map(s=> (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td><span className="badge blue">{s.type}</span></td>
                  <td>{s.capacity ?? '—'}</td>
                  <td style={{textAlign:'right'}}>
                    <button className="btn" onClick={()=> nav(`/spaces/${s.id}/book`, { state: { space: s } })}>
                      Book
                    </button>
                  </td>
                </tr>
              ))}
              {!spaces.length && (
                <tr><td colSpan="4" className="helper">No spaces found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function labelize(s){
  // "small_room" -> "Small room"
  return String(s).replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())
}
