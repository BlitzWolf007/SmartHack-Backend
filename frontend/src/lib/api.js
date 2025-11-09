const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// --- Token helpers ---
const TOKEN_KEY = 'token'
export const getAuthToken   = () => localStorage.getItem(TOKEN_KEY) || null
export const setAuthToken   = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearAuthToken = () => localStorage.removeItem(TOKEN_KEY)

// --- Error helpers ---
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

async function raw(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
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

// --- Query string helper ---
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

// Public enums (match actual ID prefixes in the map)
export const SPACE_TYPES = [
  'desk',
  'small_meeting_space',
  'large_meeting_room',
  'huddle',
  'wellbeing',
  'beerpoint',
]
export const USE_TYPES = ['focus', 'meeting', 'training', 'relaxation']

// Keys we may send on create
const PEOPLE_KEYS_ALL = ['people_count','num_people','attendees','participants','people','headcount','pax']

// ---- core request shorthands (needed by AuthContext/Dashboard/etc.) ----
const http = {
  get:   (p, o) => request('GET',    p, undefined, o?.token ?? getAuthToken()),
  post:  (p, b, o) => request('POST', p, b,        o?.token ?? getAuthToken()),
  put:   (p, b, o) => request('PUT',  p, b,        o?.token ?? getAuthToken()),
  patch: (p, b, o) => request('PATCH',p, b,        o?.token ?? getAuthToken()),
  delete:(p, o) => request('DELETE',  p, undefined,o?.token ?? getAuthToken()),
}

// ---- spaces fetch (callable + .search alias for backward compatibility) ----
async function fetchSpaces(filters = {}) {
  const candidates = [
    `/spaces${qs(filters)}`,
    `/api/spaces${qs(filters)}`,
  ]
  let lastErr = ''
  for (const p of candidates) {
    try {
      return await http.get(p)
    } catch (e) {
      lastErr = e.message
      if (e.status !== 404) throw e
    }
  }
  throw new Error(lastErr || 'No spaces endpoint found')
}

// ---- bookings helpers (robust across backends) ----
async function createBooking({ space_id, title, startLocal, endLocal, peopleCount }) {
  const start_utc = new Date(startLocal).toISOString()
  const end_utc   = new Date(endLocal).toISOString()

  const base = {
    space_id: isFinite(Number(space_id)) ? Number(space_id) : space_id, // allow string IDs from map
    title: title || 'Booking',
    start_utc,
    end_utc,
  }
  if (peopleCount && Number(peopleCount) > 0) {
    const n = Number(peopleCount)
    for (const k of PEOPLE_KEYS_ALL) base[k] = n
  }

  const altPayloads = [
    base,
    { ...base, start: start_utc, end: end_utc },
    { roomId: String(space_id), roomName: title || String(space_id), start: start_utc, end: end_utc },
    { space: String(space_id), name: title || String(space_id), start: start_utc, end: end_utc },
  ]

  const paths = [
    '/bookings',
    '/api/bookings',
    `/spaces/${encodeURIComponent(String(space_id))}/bookings`,
    `/api/spaces/${encodeURIComponent(String(space_id))}/bookings`,
    `/spaces/${encodeURIComponent(String(space_id))}/book`,
    '/api/reservations',
    '/reservations',
    '/api/book',
  ]

  let lastText = ''
  for (const p of paths) {
    for (const payload of altPayloads) {
      const res = await raw('POST', p, payload, getAuthToken())
      if (res.ok) { try { return await res.json() } catch { return null } }
      const txt = await res.text().catch(()=> '')
      lastText = toErrorMessage(txt) || `${res.status} ${res.statusText}`
      if (res.status === 401 || res.status === 403) {
        throw new Error(lastText || `Auth error (${res.status})`)
      }
      // otherwise try next payload/path
    }
  }
  throw new Error(lastText || 'Booking failed')
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

async function bookingsOn(isoDateStr) {
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

// ---- Exported API (with legacy-compatible shapes) ----
export const api = {
  // low-level http helpers many modules rely on
  ...http,

  // Auth
  login: (email, password) => http.post('/auth/login', { email, password }),
  register: (email, full_name, password, role = 'employee') =>
    http.post('/auth/register', { email, full_name, password, role }),
  verify: (token) => http.get('/auth/verify', { token }),

  // User
  updateUser: (data) => http.patch('/users/me', data),

  // Spaces
  spaces: Object.assign(fetchSpaces, {
    // keep old code happy: api.spaces.search(...)
    search: (filters) => fetchSpaces(filters),
  }),

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
