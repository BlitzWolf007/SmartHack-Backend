import { useEffect, useRef, useState } from 'react'
import { api, SPACE_TYPES, USE_TYPES } from '../lib/api.js'
import { useNavigate } from 'react-router-dom'

export default function Spaces(){
  const [spaces,setSpaces] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [filters, setFilters] = useState({
    q:'', type:'', use:'', capacityMin:'', capacityMax:''
  })

  const nav = useNavigate()
  const iframeRef = useRef(null)
  const svgRef = useRef(null)

  // Load spaces list (kept tolerant if your search endpoint is missing)
  async function load(){
    setLoading(true); setError('')
    try{
      const f = {
        q: filters.q || undefined,
        name: filters.q || undefined,
        type: filters.type || undefined,
        use: filters.use || undefined,
        capacity_min: filters.capacityMin || undefined,
        capacity_max: filters.capacityMax || undefined,
      }
      let data = []
      try { data = await api.spaces?.search?.(f) } catch {}
      setSpaces(Array.isArray(data) ? data : [])
    }catch(e){
      setError(e?.message || 'Failed to load')
    }finally{
      setLoading(false)
    }
  }
  useEffect(()=>{ load() }, []) // initial mount

  // EXACT prefixes found in interactive_map.html
  const MAP_PREFIXES = [
    'small_meeting_space','large_meeting_room','huddle','wellbeing','beerpoint','desk'
  ]
  const CLICK_SELECTOR = '.map-entity[id]' // defined inside interactive_map.html

  const matchesFilter = (el, type) => !type ? true : (el.id || '').startsWith(type)

  function injectInnerStyles(doc){
    const svg = doc.querySelector('svg')
    if (!svg || doc.__mapStylesInjected) return
    const style = doc.createElementNS('http://www.w3.org/2000/svg','style')
    style.textContent = `
      .__dim { opacity:.15 !important; pointer-events:none !important; }
      .__hot { transition: filter .15s ease, opacity .15s ease; cursor: pointer; }
      .__hot:hover { filter: drop-shadow(0 0 6px rgba(16,185,129,.65)); }
      .__sel { stroke:#10b981 !important; stroke-width:2 !important;
               filter: drop-shadow(0 0 6px rgba(16,185,129,.75)); }
    `
    svg.appendChild(style)
    doc.__mapStylesInjected = true
    svgRef.current = svg
  }

  function zoomTo(el){
    try{
      const svg = svgRef.current
      if (!svg || !el.getBBox) return
      const bb = el.getBBox()
      const pad = Math.max(12, Math.min(40, Math.max(bb.width, bb.height) * 0.15))
      const x = Math.max(0, bb.x - pad)
      const y = Math.max(0, bb.y - pad)
      const w = bb.width + pad*2
      const h = bb.height + pad*2
      svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`)
    }catch{}
  }

  function guessTypeFromId(id){
    if (!id) return ''
    const p = MAP_PREFIXES.find(px => id.startsWith(px))
    return p || ''
  }

  function applyFilterAndClicks(doc){
    injectInnerStyles(doc)
    const all = Array.from(doc.querySelectorAll(CLICK_SELECTOR)) // .map-entity[id]

    // reset
    all.forEach(el => {
      el.classList.remove('__dim','__hot','__sel')
      el.style.cursor = ''
      if (el.__onClick) { el.removeEventListener('click', el.__onClick); delete el.__onClick }
    })

    const enabled = all.filter(el => matchesFilter(el, filters.type))
    const dimmed  = all.filter(el => !matchesFilter(el, filters.type))

    enabled.forEach(el => {
      el.classList.add('__hot')
      const handler = (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        const id = el.getAttribute('id')
        const name = el.getAttribute('data-name') || id
        el.classList.add('__sel')
        setTimeout(()=> el.classList.remove('__sel'), 800)
        zoomTo(el)
        nav(`/spaces/${encodeURIComponent(id)}/book`, {
          state: { space: { id, name, type: guessTypeFromId(id) } }
        })
      }
      el.__onClick = handler
      el.addEventListener('click', handler)
    })

    dimmed.forEach(el => el.classList.add('__dim'))
  }

  // On iframe load and when filter changes
  useEffect(()=>{
    const ifr = iframeRef.current
    if (!ifr) return
    const onLoad = () => {
      const doc = ifr.contentDocument
      if (!doc) return
      applyFilterAndClicks(doc)
    }
    ifr.addEventListener('load', onLoad)
    return () => ifr.removeEventListener('load', onLoad)
  }, [])

  useEffect(()=>{
    const doc = iframeRef.current?.contentDocument
    if (doc) applyFilterAndClicks(doc)
  }, [filters.type])

  function submit(e){
    e.preventDefault()
    load()
    const doc = iframeRef.current?.contentDocument
    if (doc) applyFilterAndClicks(doc)
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Spaces</h1>
        <p className="helper">Filter and click a highlighted area on the map to book.</p>
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
                <option value="">All types</option>
                {(SPACE_TYPES?.length ? SPACE_TYPES : MAP_PREFIXES).map(t => (
                  <option key={t} value={t}>{labelize(t)}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="label" htmlFor="use">Use</label>
              <select id="use" className="input"
                      value={filters.use} onChange={e=>setFilters({...filters, use:e.target.value})}>
                <option value="">Any</option>
                {(USE_TYPES || []).map(t => (
                  <option key={t} value={t}>{labelize(t)}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="label">Capacity</label>
              <div className="grid cols-2 gap-8">
                <input className="input" type="number" placeholder="min" value={filters.capacityMin}
                       onChange={e=>setFilters({...filters, capacityMin:e.target.value})}/>
                <input className="input" type="number" placeholder="max" value={filters.capacityMax}
                       onChange={e=>setFilters({...filters, capacityMax:e.target.value})}/>
              </div>
            </div>
          </div>

          <div className="actions">
            <button className="btn" type="submit">Apply filters</button>
          </div>
        </form>
      </div>

      <div className="grid cols-2 gap-16 mt-16">
        <div className="map-wrap">
          <iframe
            ref={iframeRef}
            src="/interactive_map.html"
            title="Interactive Map"
            className="map-iframe"
          />
        </div>

        <div>
          {loading ? (
            <div className="helper">Loading…</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
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
                {(spaces||[]).filter(s=>{
                  if (filters.type && s.type !== filters.type) return false
                  if (filters.use && s.use !== filters.use) return false
                  if (filters.capacityMin && Number(s.capacity||0) < Number(filters.capacityMin)) return false
                  if (filters.capacityMax && Number(s.capacity||0) > Number(filters.capacityMax)) return false
                  if (filters.q) {
                    const q = filters.q.toLowerCase()
                    const hay = `${s.name||''} ${s.code||''} ${s.id||''}`.toLowerCase()
                    if (!hay.includes(q)) return false
                  }
                  return true
                }).map(s => (
                  <tr key={s.id}>
                    <td>{s.name || s.id}</td>
                    <td>{labelize(s.type || guessTypeFromId(s.id))}</td>
                    <td>{s.capacity ?? '-'}</td>
                    <td>
                      <button
                        className="btn small"
                        onClick={()=> nav(`/spaces/${encodeURIComponent(s.id)}/book`, { state: { space: s } })}
                      >
                        Book
                      </button>
                    </td>
                  </tr>
                ))}
                {!spaces?.length && (
                  <tr><td colSpan="4" className="helper">No spaces found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`
        .map-wrap { border:1px solid var(--line,#1f2937); border-radius: 12px; overflow: hidden; background: rgba(255,255,255,.02); }
        .map-iframe { width:100%; min-height:560px; display:block; border:0; }
      `}</style>
    </section>
  )
}

function labelize(s){
  return String(s||'').replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())
}
