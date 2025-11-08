import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function BookSpace(){
  const { id } = useParams()
  const nav = useNavigate()
  const { state } = useLocation()
  const { user } = useAuth()
  const [space, setSpace] = useState(state?.space || null)

  const [title, setTitle] = useState('')
  const [start, setStart] = useState('') // datetime-local "YYYY-MM-DDTHH:MM"
  const [end, setEnd] = useState('')
  const [people, setPeople] = useState(1)
  const [status, setStatus] = useState('')

  // validation state
  const [timeError, setTimeError] = useState('')
  const [pastWarn, setPastWarn] = useState('')

  // Load space if direct navigation without state
  useEffect(()=>{
    if (space) return
    let mounted = true
    api.spaces().then(list=>{
      if(!mounted) return
      const s = (list || []).find(x => String(x.id) === String(id))
      setSpace(s || { id, name: `Space #${id}` })
    }).catch(()=> setSpace({ id, name: `Space #${id}` }))
    return ()=>{ mounted = false }
  }, [id, space])

  // Validate times whenever start/end change
  useEffect(()=>{
    setTimeError('')
    setPastWarn('')

    if (!start || !end) return
    const s = new Date(start)
    const e = new Date(end)
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return

    if (e.getTime() <= s.getTime()) {
      setTimeError('End must be after Start.')
      return
    }

    const now = Date.now()
    if (s.getTime() < now) {
      setPastWarn('Start time is in the past.')
    }
  }, [start, end])

  const submitDisabled = useMemo(()=> {
    if (!user) return true
    if (!start || !end) return true
    if (timeError) return true
    if (people < 1) return true
    return false
  }, [user, start, end, timeError, people])

  async function submit(e){
    e.preventDefault()
    setStatus('')
    if (submitDisabled) return

    try{
      await api.createBooking({
        space_id: space.id,
        title: title || `Booking for ${space.name}`,
        startLocal: start,   // converted to start_utc
        endLocal: end,       // converted to end_utc
        peopleCount: people, // sent as multiple keys; backend picks one
      })
      setStatus('Booked! 🎉')
      setTimeout(()=> nav('/bookings'), 600)
    }catch(err){
      setStatus(err.message || 'Booking failed')
    }
  }

  return (
    <section className="grid" style={{marginTop:12}}>
      <header className="grid" style={{gap:6}}>
        <h2 style={{margin:0}}>Book space</h2>
        <p className="helper">You are booking: <strong>{space?.name || `#${id}`}</strong></p>
      </header>

      <div className="card">
        <form onSubmit={submit} noValidate>
          <div className="form-row">
            <label className="label" htmlFor="title">Title</label>
            <input
              id="title" className="input" value={title}
              onChange={e=>setTitle(e.target.value)}
              placeholder="Team sync / Focus session"
            />
          </div>

          <div className="grid cols-2">
            <div className="form-row">
              <label className="label" htmlFor="start">Start</label>
              <input
                id="start" className={`input ${timeError ? 'input-error' : ''}`} type="datetime-local"
                value={start} onChange={e=>setStart(e.target.value)} required
              />
            </div>
            <div className="form-row">
              <label className="label" htmlFor="end">End</label>
              <input
                id="end" className={`input ${timeError ? 'input-error' : ''}`} type="datetime-local"
                value={end} onChange={e=>setEnd(e.target.value)} required
              />
            </div>
          </div>

          {timeError && <div className="badge warn" role="alert">{timeError}</div>}
          {!timeError && pastWarn && <div className="badge yellow" role="status">{pastWarn}</div>}

          <div className="form-row">
            <label className="label" htmlFor="people">People</label>
            <input
              id="people" className="input" type="number" min="1"
              value={people} onChange={e=>setPeople(e.target.value ? Math.max(1, Number(e.target.value)) : 1)}
            />
            <span className="helper">This is saved under a backend-supported key (e.g. people_count).</span>
          </div>

          {status && <div className="badge yellow" role="status">{status}</div>}

          <div className="form-actions">
            <button className="btn accent" type="submit" disabled={submitDisabled}>Confirm booking</button>
            <button type="button" className="btn ghost" onClick={()=> nav('/spaces')}>Back to spaces</button>
          </div>
          {submitDisabled && !user && <p className="helper mt-3">Tip: sign in to complete booking.</p>}
        </form>
      </div>
    </section>
  )
}
