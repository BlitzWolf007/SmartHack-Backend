// src/lib/api.js
// -----------------------------------------------------------------------------
// Base URL & debug
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_DEBUG = (import.meta.env.VITE_API_DEBUG ?? '0') !== '0'
const dlog = (...args) => { if (API_DEBUG) console.log('[api]', ...args) }

// -----------------------------------------------------------------------------
// Token helpers
const TOKEN_KEY = 'token'
export const getAuthToken   = () => localStorage.getItem(TOKEN_KEY) || null
export const setAuthToken   = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearAuthToken = () => localStorage.removeItem(TOKEN_KEY)

// -----------------------------------------------------------------------------
// Error helpers
function toErrorMessage(text) {
  try {
    const obj = JSON.parse(text)
    if (typeof obj?.detail === 'string') return obj.detail
    if (Array.isArray(obj?.detail)) {
      const msgs = obj.detail.map(e => {
        const loc = Array.isArray(e.loc) ? e.loc.slice(-1)[0] : e.loc
        return loc ? `${loc}: ${e.msg}` : e.msg
      }).filter(Boolean)
      return msgs.join(' • ')
    }
    if (obj?.detail && typeof obj.detail === 'object') {
      if (typeof obj.detail.msg === 'string') return obj.detail.msg
      return JSON.stringify(obj.detail)
    }
    return obj?.message || text
  } catch {
    return text
  }
}

// -----------------------------------------------------------------------------
// Low-level fetchers
async function raw(method, path, body, token) {
  const url = `${API}${path}`
  dlog(method, url, body ? { bodyKeys: Object.keys(body) } : '')
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })
  return res
}

async function request(method, path, body, token) {
  const res = await raw(method, path, body, token)
  if (!res.ok) {
    const rawText = await res.text().catch(() => '')
    const msg = toErrorMessage(rawText) || `${res.status} ${res.statusText}`
    const err = new Error(msg)
    err.status = res.status
    err.pathTried = path
    try { err.raw = JSON.parse(rawText) } catch { err.raw = rawText }
    throw err
  }
  try { return await res.json() } catch { return null }
}

// -----------------------------------------------------------------------------
// QS helper
function qs(params = {}) {
  const u = new URLSearchParams()
  Object.entries(params).forEach(([k,v])=>{
    if (v === undefined || v === null || v === '') return
    if (Array.isArray(v)) v.forEach(x=> u.append(k, x))
    else u.set(k, String(v))
  })
  const s = u.toString()
  return s ? `?${s}` : ''
}

// -----------------------------------------------------------------------------
// Map categories (SVG)
export const SPACE_TYPES = [
  'desk',
  'small_meeting_space',
  'large_meeting_room',
  'huddle',
  'wellbeing',
  'beerpoint',
]
export const USE_TYPES = ['focus', 'meeting', 'training', 'relaxation']

// Backend SpaceType enums (from models.py)
const BACKEND_TYPES = {
  desk: 'desk',
  office: 'office',
  small_room: 'small_room',
  training_room: 'training_room',
  meeting_room: 'meeting_room',
  wellbeing_zone: 'wellbeing_zone',
  beer_point: 'beer_point',
}

// Map <backend type> → <map type> (so UI filter matches SVG)
const BACKEND_TO_MAP = {
  [BACKEND_TYPES.desk]: 'desk',
  [BACKEND_TYPES.small_room]: 'small_meeting_space', // also covers huddle in SVG
  [BACKEND_TYPES.training_room]: 'large_meeting_room',
  [BACKEND_TYPES.meeting_room]: 'large_meeting_room', // just in case
  [BACKEND_TYPES.wellbeing_zone]: 'wellbeing',
  [BACKEND_TYPES.beer_point]: 'beerpoint',
  [BACKEND_TYPES.office]: 'office', // not used in seed, kept for completeness
}

// Map <map type> → <backend type> (for server queries)
const MAP_TO_BACKEND = {
  desk: BACKEND_TYPES.desk,
  small_meeting_space: BACKEND_TYPES.small_room,
  huddle: BACKEND_TYPES.small_room,
  large_meeting_room: BACKEND_TYPES.training_room,
  wellbeing: BACKEND_TYPES.wellbeing_zone,
  beerpoint: BACKEND_TYPES.beer_point,
  office: BACKEND_TYPES.office,
}

// -----------------------------------------------------------------------------
// Helpers
function normalizeSpacesList(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.results)) return data.results
  if (Array.isArray(data.data)) return data.data
  return []
}
const ci = s => (s ?? '').toString().trim().toLowerCase()
const isIntLike = x => /^\d+$/.test(String(x ?? ''))
function nkey(str){ return String(str).toLowerCase().split(/(\d+)/).map(p=>/\d+/.test(p)?Number(p):p) }

// Derive map-friendly fields for each space (ui_type, ui_map_id)
function decorateSpaces(spacesRaw){
  const spaces = normalizeSpacesList(spacesRaw).map(s => ({ ...s }))
  // buckets for deriving indices
  const desks = spaces.filter(s => ci(s.type)==='desk').sort((a,b)=> nkey(a.name).toString() < nkey(b.name).toString() ? -1 : 1)
  const smalls = spaces.filter(s => ci(s.type)==='small_room').sort((a,b)=> nkey(a.name).toString() < nkey(b.name).toString() ? -1 : 1)
  const trainings = spaces.filter(s => ci(s.type)==='training_room')

  // quick lookup for name→index
  const deskIndex = new Map(desks.map((s,i)=>[ci(s.name), i+1]))
  const smallIndex = new Map(smalls.map((s,i)=>[ci(s.name), i+1]))

  for (const s of spaces) {
    const bt = ci(s.type)
    const uiType = BACKEND_TO_MAP[bt] || bt
    s.ui_type = uiType

    // ui_map_id
    if (uiType === 'desk') {
      const m = String(s.name||'').match(/desk\s+(\d+)/i)
      const n = m ? Number(m[1]) : deskIndex.get(ci(s.name))
      s.ui_map_id = n ? `desk${n}` : `desk`
    } else if (uiType === 'small_meeting_space') {
      // assign nth small room
      const n = smallIndex.get(ci(s.name)) || null
      s.ui_map_id = `small_meeting_space${n || 1}`
    } else if (uiType === 'large_meeting_room') {
      const nm = ci(s.name)
      if (nm === 'training room 1') s.ui_map_id = 'large_meeting_room1'
      else if (nm === 'training room 2') s.ui_map_id = 'large_meeting_room2'
      else if (nm === 'training rooms (both)') s.ui_map_id = 'large_meeting_room3'
      else s.ui_map_id = 'large_meeting_room1'
    } else if (uiType === 'wellbeing') {
      const nm = ci(s.name)
      s.ui_map_id = (nm.includes('bookster')) ? 'wellbeing2' : 'wellbeing1'
    } else if (uiType === 'beerpoint') {
      s.ui_map_id = 'beerpoint1'
    } else {
      s.ui_map_id = String(s.id ?? s.space_id ?? s.spaceId ?? '')
    }
  }
  return spaces
}

// -----------------------------------------------------------------------------
// HTTP shorthand used across app
const http = {
  get:   (p, o) => request('GET',    p, undefined, o?.token ?? getAuthToken()),
  post:  (p, b, o) => request('POST', p, b,        o?.token ?? getAuthToken()),
  put:   (p, b, o) => request('PUT',  p, b,        o?.token ?? getAuthToken()),
  patch: (p, b, o) => request('PATCH',p, b,        o?.token ?? getAuthToken()),
  delete:(p, o) => request('DELETE',  p, undefined,o?.token ?? getAuthToken()),
}

// -----------------------------------------------------------------------------
// Spaces fetch (callable + .search alias). Translate/normalize for UI.
async function fetchSpaces(filters = {}) {
  const f = { ...filters }
  if (f.type && MAP_TO_BACKEND[f.type]) f.type = MAP_TO_BACKEND[f.type]
  const candidates = [
    `/spaces${qs(f)}`,
    `/api/spaces${qs(f)}`,
  ]
  let lastErr = ''
  for (const p of candidates) {
    try {
      const data = await http.get(p)
      return decorateSpaces(data)
    } catch (e) {
      lastErr = e.message
      if (e.status !== 404) throw e
    }
  }
  throw new Error(lastErr || 'No spaces endpoint found')
}

// -----------------------------------------------------------------------------
// Resolver from map-id → backend numeric id (using normalized spaces)
async function resolveSpaceId(mapId, attemptsLog) {
  if (isIntLike(mapId)) return Number(mapId)

  // fetch normalized spaces once
  let spaces = null
  for (const path of ['/spaces', '/api/spaces']) {
    const res = await raw('GET', path, undefined, getAuthToken())
    const text = await res.text().catch(()=> '')
    attemptsLog?.push({ method:'GET', path, status:res.status, ok:res.ok, responseSnippet:text.slice(0,200) })
    if (!res.ok) continue
    try { spaces = decorateSpaces(JSON.parse(text)); break } catch {}
  }
  if (!Array.isArray(spaces) || !spaces.length) return null

  const key = String(mapId)
  const byUiId = spaces.find(s => s.ui_map_id === key)
  if (byUiId) {
    const val = byUiId.id ?? byUiId.space_id ?? byUiId.spaceId
    if (isIntLike(val)) return Number(val)
  }

  // fallback: try raw fields equality (defensive)
  const keyCI = ci(key)
  const direct = spaces.find(s => {
    const fields = [
      s?.id?.toString(),
      s?.space_id?.toString(),
      s?.spaceId?.toString(),
      s?.name,
      s?.code,
      s?.slug,
      s?.key,
    ].filter(Boolean).map(ci)
    return fields.includes(keyCI)
  })
  if (direct) {
    const num = direct.id ?? direct.space_id ?? direct.spaceId
    if (isIntLike(num)) return Number(num)
  }
  return null
}

// -----------------------------------------------------------------------------
// Bookings (robust + debuggable + ID resolver)
// Your Booking model wants: space_id (int), title (str), attendees (int), start_utc, end_utc
const PEOPLE_KEYS_ALL = ['attendees','people_count','num_people','participants','people','headcount','pax']

export async function createBooking({ space_id, title, startLocal, endLocal, peopleCount }) {
  const attempts = []

  const resolvedId = await resolveSpaceId(space_id, attempts)
  attempts.push({ note: 'resolveSpaceId', input: String(space_id), resolvedId })
  if (!isIntLike(resolvedId)) {
    const err = new Error(`Unable to resolve space_id for "${space_id}". Please ensure the space exists in backend.`)
    err.status = 422
    err.attempts = attempts
    throw err
  }

  const start_utc = new Date(startLocal).toISOString()
  const end_utc   = new Date(endLocal).toISOString()

  const base = {
    space_id: Number(resolvedId),
    title: title || 'Booking',
    start_utc,
    end_utc,
  }
  if (peopleCount && Number(peopleCount) > 0) {
    const n = Number(peopleCount)
    base.attendees = n
    PEOPLE_KEYS_ALL.forEach(k => { if (k !== 'attendees') base[k] = n })
  }

  const payloads = [
    base,
    { ...base, start: start_utc, end: end_utc }, // some backends use start/end
  ]

  const paths = [
    '/bookings',
    '/api/bookings',
    `/spaces/${encodeURIComponent(String(resolvedId))}/bookings`,
    `/api/spaces/${encodeURIComponent(String(resolvedId))}/bookings`,
    `/spaces/${encodeURIComponent(String(resolvedId))}/book`,
    '/api/reservations',
    '/reservations',
    '/api/book',
  ]

  for (const p of paths) {
    for (const payload of payloads) {
      try {
        const res = await raw('POST', p, payload, getAuthToken())
        const text = await res.text().catch(()=> '')
        attempts.push({
          method: 'POST',
          path: p,
          status: res.status,
          ok: res.ok,
          payloadShape: Object.keys(payload),
          resolvedId,
          responseSnippet: text.slice(0, 200),
        })
        if (res.ok) {
          let data = null
          try { data = text ? JSON.parse(text) : null } catch { data = text || null }
          dlog('Booking SUCCESS via', p, data)
          return { ok: true, data, endpoint: p, payloadUsed: payload, attempts }
        }
        if (res.status === 401 || res.status === 403) {
          const msg = toErrorMessage(text) || `Auth error (${res.status})`
          const err = new Error(msg)
          err.status = res.status
          err.attempts = attempts
          throw err
        }
      } catch (e) {
        if (e?.status === 401 || e?.status === 403) throw e
        attempts.push({
          method: 'POST',
          path: p,
          status: e?.status ?? 0,
          ok: false,
          payloadShape: Object.keys(payload),
          resolvedId,
          error: String(e?.message || e),
        })
        dlog('Booking attempt error', p, e?.message || e)
      }
    }
  }

  const err = new Error('No booking endpoint accepted the request (NOT FOUND).')
  err.status = 404
  err.attempts = attempts
  throw err
}

async function deleteBooking(id) {
  const candidates = [
    `/bookings/${id}`,
    `/api/bookings/${id}`,
    `/reservations/${id}`,
    `/api/reservations/${id}`,
  ]
  let lastErr = ''
  for (const p of candidates) {
    const res = await raw('DELETE', p, undefined, getAuthToken())
    if (res.ok || res.status === 204) return true
    const t = await res.text().catch(()=> '')
    lastErr = toErrorMessage(t) || lastErr
    if (res.status === 401 || res.status === 403) {
      throw new Error(lastErr || `Auth error (${res.status})`)
    }
  }
  throw new Error(lastErr || 'Cancel failed')
}

async function bookingsOn(isoDateStr /* 'YYYY-MM-DD' */) {
  const token = getAuthToken()
  const candidates = [
    `/bookings?date=${isoDateStr}`,
    `/api/bookings?date=${isoDateStr}`,
    `/bookings?day=${isoDateStr}`,
    `/api/bookings?day=${isoDateStr}`,
    '/bookings/today',
    '/api/bookings/today',
    '/bookings',
    '/api/bookings',
  ]
  for (const p of candidates) {
    const res = await raw('GET', p, undefined, token)
    if (!res.ok) continue
    let data = null
    try { data = await res.json() } catch { data = null }
    if (!data) continue
    let arr = Array.isArray(data) ? data
            : Array.isArray(data?.items) ? data.items
            : Array.isArray(data?.results) ? data.results
            : Array.isArray(data?.data) ? data.data
            : (data && typeof data === 'object') ? [data] : []
    if (p.endsWith('/bookings') || p.endsWith('/api/bookings')) {
      arr = arr.filter(b => {
        const s = b.start_utc || b.start_time || b.start || b.startAt
        if (!s) return false
        const d = new Date(s)
        const y = d.getFullYear()
        const m = String(d.getMonth()+1).padStart(2,'0')
        const da= String(d.getDate()).padStart(2,'0')
        return `${y}-${m}-${da}` === isoDateStr
      })
    }
    return arr
  }
  return []
}

// -----------------------------------------------------------------------------
// Exported API (keeps legacy shapes)
export const api = {
  // http shorthands that other code uses
  get:   (p,o) => request('GET', p, undefined, o?.token ?? getAuthToken()),
  post:  (p,b,o)=> request('POST',p,b, o?.token ?? getAuthToken()),
  put:   (p,b,o)=> request('PUT', p,b, o?.token ?? getAuthToken()),
  patch: (p,b,o)=> request('PATCH',p,b, o?.token ?? getAuthToken()),
  delete:(p,o)  => request('DELETE',p, undefined, o?.token ?? getAuthToken()),

  // Auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  register: (email, full_name, password, role = 'employee') =>
    request('POST', '/auth/register', { email, full_name, password, role }),
  verify: (token) => request('GET', '/auth/verify', undefined, token),

  // User
  updateUser: (data) => request('PATCH', '/users/me', data, getAuthToken()),

  // Spaces
  spaces: Object.assign(fetchSpaces, { search: (filters) => fetchSpaces(filters) }),

  // Bookings
  myBookings: async () => {
    const token = getAuthToken()
    const candidates = [
      '/bookings/mine',
      '/me/bookings','/users/me/bookings','/user/bookings',
      '/api/bookings/mine','/api/me/bookings','/api/users/me/bookings','/api/user/bookings',
      '/bookings?me=true','/api/bookings?me=true',
      '/reservations/mine','/api/reservations/mine',
      '/bookings','/api/bookings','/reservations','/api/reservations',
    ]
    let lastErrText = ''
    for (const p of candidates) {
      const res = await raw('GET', p, undefined, token)
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          const t = await res.text().catch(()=> '')
          throw new Error(toErrorMessage(t) || `Auth error (${res.status})`)
        }
        lastErrText = await res.text().catch(()=> '')
        continue
      }
      let data = null
      try { data = await res.json() } catch { data = null }
      if (Array.isArray(data)) return data
      if (Array.isArray(data?.items)) return data.items
      if (Array.isArray(data?.results)) return data.results
      if (Array.isArray(data?.data)) return data.data
      if (data && typeof data === 'object') return [data]
    }
    throw new Error(toErrorMessage(lastErrText) || 'No bookings endpoint found')
  },

  createBooking,
  deleteBooking,
  bookingsOn,
}
