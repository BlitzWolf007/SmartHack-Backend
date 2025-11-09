import { useEffect, useRef, useState } from 'react'
import { api, SPACE_TYPES } from '../lib/api.js'
import { useNavigate } from 'react-router-dom'

export default function Spaces(){
  const [spaces,setSpaces] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [filters, setFilters] = useState({ type:'' })

  const nav = useNavigate()
  const iframeRef = useRef(null)
  const svgRef = useRef(null)
  const infoByMapIdRef = useRef(new Map())

  async function load(){
    setLoading(true); setError('')
    try{
      const data = await api.spaces?.search?.({
        type: filters.type || undefined,
      })
      const arr = Array.isArray(data) ? data : []
      setSpaces(arr)

      const map = new Map()
      for (const s of arr) {
        if (s.ui_map_id) map.set(String(s.ui_map_id), s)
        if (s.ui_type === 'small_meeting_space') {
          const m = String(s.ui_map_id).match(/^small_meeting_space(\d+)$/)
          if (m) map.set(`huddle${m[1]}`, s)
        }
      }
      infoByMapIdRef.current = map
    }catch(e){
      setError(e?.message || 'Failed to load spaces')
    }finally{
      setLoading(false)
    }
  }
  useEffect(()=>{ load() }, [])

  const MAP_PREFIXES = [
    'small_meeting_space','large_meeting_room','huddle','wellbeing','beerpoint','desk'
  ]
  const CLICK_SELECTOR = '.map-entity[id]'
  const matchesFilter = (el, type) => !type ? true : (el.id || '').startsWith(type)
  const escapeHtml = (s='') => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')

  function injectInnerStyles(doc){
    const svg = doc.querySelector('svg')
    if (!svg || doc.__mapStylesInjected) return
    const style = doc.createElementNS('http://www.w3.org/2000/svg','style')
    style.textContent = `
      .__dim { opacity:.15 !important; pointer-events:none !important; }
      .__hot { cursor:pointer; transition: filter .15s ease, opacity .15s ease; }
      .__hot:hover { filter: drop-shadow(0 0 10px rgba(255,220,70,0.8)); }
      .__sel { stroke:#e11d48 !important; stroke-width:2 !important;
               filter: drop-shadow(0 0 10px rgba(225,29,72,0.9)); }
    `
    svg.appendChild(style)
    const tip = doc.createElement('div')
    tip.id = '__mapTip'
    tip.style.cssText = `
      position: fixed; z-index: 9999; pointer-events: none; display: none;
      font-family: "Inter", system-ui, sans-serif;
      font-size: 13px; line-height: 1.35; font-weight: 500;
      background: rgba(10,15,30,0.96); border: 1px solid rgba(255,220,70,0.25);
      box-shadow: 0 8px 28px rgba(0,0,0,.45); color: #f8fafc;
      border-radius: 10px; padding: 10px 12px; backdrop-filter: blur(4px);
      max-width: 280px;
    `
    doc.body.appendChild(tip)
    doc.__mapStylesInjected = true
    svgRef.current = svg
  }

  function guessTypeFromId(id){
    if (!id) return ''
    const p = MAP_PREFIXES.find(px => id.startsWith(px))
    return p || ''
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

  function formatTooltip(space, id){
    const s = space
    const type = guessTypeFromId(id)
    const niceType = labelize(s?.ui_type || type || 'Unknown')

    let title = s?.name || id
    if ((id || '').startsWith('huddle') && s?.ui_label) {
      title = s.ui_label
    }

    let html = `
      <div style="font-weight:600; font-size:14px; margin-bottom:4px; color:#ffdd40;">
        ${escapeHtml(title)}
      </div>
      <div style="margin-bottom:4px; color:#cbd5e1;">${niceType}</div>
    `
    if (s?.capacity) html += `<div style="color:#94a3b8;">Capacity: ${s.capacity}</div>`
    if (s?.activity) html += `<div style="color:#94a3b8;">Activity: ${labelize(s.activity)}</div>`
    if (s?.requires_approval) html += `<div style="color:#e11d48;">Needs approval</div>`
    if (s?.description) html += `<div style="margin-top:4px; color:#9ca3af;">${escapeHtml(s.description)}</div>`
    return html
  }

  function attachTooltip(doc, el){
    const tip = doc.getElementById('__mapTip')
    if (!tip) return
    const mapId = el.getAttribute('id')
    const space = infoByMapIdRef.current.get(mapId)
    const show = ev => { tip.style.display='block'; tip.innerHTML=formatTooltip(space,mapId); move(ev) }
    const hide = ()=>{ tip.style.display='none' }
    const move = ev=>{
      const pad=14; let x=ev.clientX+pad; let y=ev.clientY+pad
      const vw=doc.documentElement.clientWidth, vh=doc.documentElement.clientHeight
      const rect=tip.getBoundingClientRect()
      if(x+rect.width>vw) x=vw-rect.width-6
      if(y+rect.height>vh) y=vh-rect.height-6
      tip.style.left=`${x}px`; tip.style.top=`${y}px`
    }
    el.addEventListener('mouseenter',show)
    el.addEventListener('mouseleave',hide)
    el.addEventListener('mousemove',move)
    el.__tip={show,hide,move}
  }
  function detachTooltip(el){
    if(!el.__tip) return
    el.removeEventListener('mouseenter',el.__tip.show)
    el.removeEventListener('mouseleave',el.__tip.hide)
    el.removeEventListener('mousemove',el.__tip.move)
    delete el.__tip
  }

  function applyFilterAndInteractions(doc){
    injectInnerStyles(doc)
    const all = Array.from(doc.querySelectorAll(CLICK_SELECTOR))
    all.forEach(el=>{
      el.classList.remove('__dim','__hot','__sel')
      if(el.__onClick){el.removeEventListener('click',el.__onClick);delete el.__onClick}
      detachTooltip(el)
    })

    const enabled=all.filter(el=>matchesFilter(el,filters.type))
    const dimmed =all.filter(el=>!matchesFilter(el,filters.type))

    enabled.forEach(el=>{
      el.classList.add('__hot')
      const click=(ev)=>{
        ev.preventDefault();ev.stopPropagation()
        const id=el.getAttribute('id')
        const s=infoByMapIdRef.current.get(id)
        const name=s?.name||id
        el.classList.add('__sel')
        setTimeout(()=>el.classList.remove('__sel'),800)
        zoomTo(el)
        nav(`/spaces/${encodeURIComponent(id)}/book`,{state:{space:s||{id,name,type:guessTypeFromId(id)}}})
      }
      el.__onClick=click
      el.addEventListener('click',click)
      attachTooltip(doc,el)
    })
    dimmed.forEach(el=>el.classList.add('__dim'))
  }

  useEffect(()=>{
    const ifr = iframeRef.current
    if (!ifr) return
    const onLoad = ()=>{ const doc=ifr.contentDocument; if(doc) applyFilterAndInteractions(doc) }
    ifr.addEventListener('load', onLoad)
    return ()=> ifr.removeEventListener('load', onLoad)
  }, [])
  useEffect(()=>{
    const doc = iframeRef.current?.contentDocument
    if(doc) applyFilterAndInteractions(doc)
  }, [filters.type, spaces])

  return (
    <section className="page" style={{ textAlign:'center' }}>
      <header className="page-header">
        <h1 style={{color:'#ffdd40', textAlign:'center'}}>Spaces</h1>
        <p className="helper" style={{ fontSize:'18px', fontWeight:'600', color:'#f1f5f9' }}>
          Filter, hover for details, click to book.
        </p>
      </header>

      <div className="card" style={{borderColor:'#1e293b', background:'rgba(10,15,30,0.7)', textAlign:'center'}}>
        <form
          onSubmit={e=>{e.preventDefault();load()}}
          style={{
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            gap:'10px',
            padding:'10px 0'
          }}
        >
          <div
            style={{
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              gap:'8px',
              width:'20%',
              minWidth:240
            }}
          >
            <label
              className="label"
              htmlFor="type"
              style={{ fontWeight:'700', fontSize:'16px', color:'#f1f5f9' }}
            >
              Type
            </label>
            <select
              id="type"
              className="input"
              value={filters.type}
              onChange={e=>setFilters({ type:e.target.value })}
              style={{
                background:'#0b1020',
                color:'#f8fafc',
                border:'1px solid #334155',
                width:'100%',
                height:36,
                lineHeight:'36px',
                padding:'0 8px',
                borderRadius:6,
                textAlign:'center',
                appearance:'none',
                fontWeight:'600'
              }}
            >
              <option value="">All</option>
              {(SPACE_TYPES?.length?SPACE_TYPES:MAP_PREFIXES).map(t=>(
                <option key={t} value={t} style={{fontWeight:'700'}}>{labelize(t)}</option>
              ))}
            </select>
            <button
              className="btn"
              type="submit"
              style={{
                background:'#ECB03D',
                border:'none',
                height:36,
                padding:'0 14px',
                borderRadius:6,
                fontWeight:'700',
                whiteSpace:'nowrap',
                color:'#fff'
              }}
            >
              Apply
            </button>
          </div>
        </form>
      </div>

      <h2 style={{ color:'#ffdd40', marginTop: 24, marginBottom: 8, textAlign:'center' }}>Seats Mapping</h2>

      <div className="map-wrap-full">
        <iframe ref={iframeRef} src="/interactive_map.html" title="Interactive Map" className="map-iframe-full"/>
      </div>

      <style>{`
        .map-wrap-full {
          position: relative; border-radius: 12px; overflow: hidden;
          margin-top: 8px; border: 1px solid #1e293b; background: #0b1020;
        }
        .map-iframe-full {
          width: 100%; height: calc(100vh - 260px); min-height: 70vh;
          display: block; border: 0; background: #0b1020;
        }
        @media (max-width: 900px) {
          .map-iframe-full { height: calc(100vh - 300px); min-height: 60vh; }
        }
        .label, .helper { color: #f1f5f9; }
        select.input option, select.input optgroup {
          background: #0b1020;
          color: #f8fafc;
          font-weight: 700;
        }
        .btn { background: #ECB03D; color: #fff; cursor: pointer; font-weight: 700; }
      `}</style>

      {loading && <div className="helper" style={{marginTop:8}}>Loading spaces…</div>}
      {error && <div className="error" style={{marginTop:8}}>{error}</div>}
    </section>
  )
}

function labelize(s){
  return String(s||'').replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())
}
