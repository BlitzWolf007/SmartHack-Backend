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

  // Shared fields
  const [title, setTitle] = useState('')
  const [people, setPeople] = useState(1)
  const [status, setStatus] = useState('')

  // Time fields for non-desks (same day, arbitrary minutes)
  const [start, setStart] = useState('') // datetime-local
  const [end, setEnd] = useState('')     // datetime-local

  // Date fields for desks (whole days only, max 7 days)
  const [startDate, setStartDate] = useState('') // YYYY-MM-DD
  const [endDate, setEndDate] = useState('')     // YYYY-MM-DD

  // validation state
  const [timeError, setTimeError] = useState('')
  const [pastWarn, setPastWarn] = useState('')

  const isDesk = (space?.type || '').toLowerCase() === 'desk'

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

  // Initialize dates for desk default (today → today)
  useEffect(()=>{
    if (!isDesk) return
    if (!startDate || !endDate) {
      const today = toYMD(new Date())
      setStartDate(prev=> prev || today)
      setEndDate(prev=> prev || today)
    }
  }, [isDesk, startDate, endDate])

  // Validate times on change
  useEffect(()=>{
    setTimeError('')
    setPastWarn('')

    if (isDesk) {
      if (!startDate || !endDate) return
      const s = parseYMD(startDate)
      const e = parseYMD(endDate)
      if (!s || !e) return

      if (e.getTime() < s.getTime()) {
        setTimeError('End date must be the same or after start date.')
        return
      }

      // max 7 days (inclusive)
      const daysInclusive = diffDaysInclusive(s, e)
      if (daysInclusive > 7) {
        setTimeError('Desk bookings cannot exceed 7 full days.')
        return
      }

      if (atStartOfDayLocal(s).getTime() < startOfTodayLocal().getTime()) {
        setPastWarn('Start date is in the past.')
      }
      return
    }

    // Non-desk: allow arbitrary minutes, same local day, min duration 5 minutes
    if (!start || !end) return
    const sdt = new Date(start)
    const edt = new Date(end)
    if (isNaN(sdt.getTime()) || isNaN(edt.getTime())) return

    if (!isSameLocalDay(sdt, edt)) {
      setTimeError('Bookings (except desks) must start and end on the same day.')
      return
    }

    const deltaMs = edt.getTime() - sdt.getTime()
    if (deltaMs <= 0) {
      setTimeError('End must be after Start.')
      return
    }
    const fiveMin = 5 * 60 * 1000
    if (deltaMs < fiveMin) {
      setTimeError('Minimum duration is 5 minutes.')
      return
    }

    if (sdt.getTime() < Date.now()) {
      setPastWarn('Start time is in the past.')
    }
  }, [isDesk, startDate, endDate, start, end])

  const submitDisabled = useMemo(()=> {
    if (!user) return true
    if (people < 1) return true
    if (isDesk) {
      if (!startDate || !endDate) return true
      if (timeError) return true
      return false
    } else {
      if (!start || !end) return true
      if (timeError) return true
      return false
    }
  }, [user, people, isDesk, startDate, endDate, start, end, timeError])

  async function submit(e){
    e.preventDefault()
    setStatus('')
    if (submitDisabled) return

    try{
      let startLocal, endLocal

      if (isDesk) {
        // Whole-day semantics:
        // startLocal = YYYY-MM-DDT00:00 (local)
        // endLocal   = (endDate + 1 day)T00:00 (local)
        const s = parseYMD(startDate)
        const e = parseYMD(endDate)
        const startMid = atStartOfDayLocal(s)
        const endNextMid = atStartOfDayLocal(addDays(e, 1))
        startLocal = toLocalInputDateTime(startMid)
        endLocal   = toLocalInputDateTime(endNextMid)
      } else {
        startLocal = start
        endLocal   = end
      }

      await api.createBooking({
        space_id: space.id,
        title: title || `Booking for ${space.name}`,
        startLocal,
        endLocal,
        peopleCount: people,
      })
      setStatus('Booked! 🎉')
      setTimeout(()=> nav('/bookings'), 600)
    }catch(err){
      setStatus(err.message || 'Booking failed')
    }
  }

return (
    <section
      className="grid"
      style={{
        marginTop: 16,
        width: '50%',
        maxWidth: '50%',
        marginLeft: 'auto',
        marginRight: 'auto',
        textAlign: 'center'
      }}
    >
      <header className="grid" style={{gap:6}}>
        <h2 style={{margin:0}}>Book space</h2>
        <p className="helper">
          You are booking: <strong>{space?.name || `#${id}`}</strong>
          {space?.type ? <span className="helper"> — type: {space.type}</span> : null}
        </p>
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

          {/* Time selectors with new rules */}
          {!isDesk ? (
            <>
              <div className="grid cols-2">
                <div className="form-row">
                  <label className="label" htmlFor="start">Start</label>
                  <input
                    id="start"
                    className={`input ${timeError ? 'input-error' : ''}`}
                    type="datetime-local"
                    step="300" /* 5-minute steps; adjust as you like */
                    value={start}
                    onChange={e=>setStart(e.target.value)}
                    required
                  />
                </div>
                <div className="form-row">
                  <label className="label" htmlFor="end">End</label>
                  <input
                    id="end"
                    className={`input ${timeError ? 'input-error' : ''}`}
                    type="datetime-local"
                    step="300" /* 5-minute steps */
                    value={end}
                    onChange={e=>setEnd(e.target.value)}
                    required
                  />
                </div>
              </div>
              <p className="helper">
                Non-desk spaces must be booked within a single day. You can choose any start and end minute (min 5 minutes).
              </p>
              {timeError && <div className="badge warn" role="alert">{timeError}</div>}
              {!timeError && pastWarn && <div className="badge yellow" role="status">{pastWarn}</div>}
            </>
          ) : (
            <>
              <div className="grid cols-2">
                <div className="form-row">
                  <label className="label" htmlFor="startDate">Start day</label>
                  <input
                    id="startDate" className={`input ${timeError ? 'input-error' : ''}`} type="date"
                    value={startDate} onChange={e=>setStartDate(e.target.value)} required
                  />
                </div>
                <div className="form-row">
                  <label className="label" htmlFor="endDate">End day (inclusive)</label>
                  <input
                    id="endDate" className={`input ${timeError ? 'input-error' : ''}`} type="date"
                    value={endDate} onChange={e=>setEndDate(e.target.value)} required
                  />
                </div>
              </div>
              <p className="helper">
                Desks can be booked only for whole days (00:00 → next day 00:00), up to 7 full days.
              </p>
              {timeError && <div className="badge warn" role="alert">{timeError}</div>}
              {!timeError && pastWarn && <div className="badge yellow" role="status">{pastWarn}</div>}
            </>
          )}

          <div className="form-row">
            <label className="label" htmlFor="people">People</label>
            <input
              id="people" className="input" type="number" min="1"
              value={people}
              onChange={e=>setPeople(e.target.value ? Math.max(1, Number(e.target.value)) : 1)}
            />
            <span className="helper">Saved under a backend-supported key (e.g., people_count).</span>
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

/* ---------- helpers ---------- */
function toYMD(d){
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const da= String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${da}`
}
function parseYMD(ymd){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '')
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]), 0, 0, 0, 0)
  return isNaN(d.getTime()) ? null : d
}
function atStartOfDayLocal(d){
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0)
}
function addDays(d, n){
  const x = new Date(d.getTime())
  x.setDate(x.getDate() + n)
  return x
}
function startOfTodayLocal(){
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0)
}
function diffDaysInclusive(s, e){
  const ms = atStartOfDayLocal(e).getTime() - atStartOfDayLocal(s).getTime()
  return Math.floor(ms / (24*60*60*1000)) + 1
}
function isSameLocalDay(a, b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function toLocalInputDateTime(d){
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const da= String(d.getDate()).padStart(2,'0')
  const hh= String(d.getHours()).padStart(2,'0')
  const mm= String(d.getMinutes()).padStart(2,'0')
  return `${y}-${m}-${da}T${hh}:${mm}`
}
