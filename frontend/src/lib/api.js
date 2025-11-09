// frontend/src/lib/api.js
// -----------------------------------------------------------------------------
// Base URL & debug
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_DEBUG = (import.meta.env.VITE_API_DEBUG ?? '0') !== '0'
const dlog = (...args) => { if (API_DEBUG) console.log('[api]', ...args) }

// Token helpers
const TOKEN_KEY = 'token'
export const getAuthToken   = () => localStorage.getItem(TOKEN_KEY) || null
export const setAuthToken   = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearAuthToken = () => localStorage.removeItem(TOKEN_KEY)

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

// Utils
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
const ci = s => (s ?? '').toString().trim().toLowerCase()
const isIntLike = x => /^\d+$/.test(String(x ?? ''))
function nkey(str){ return String(str).toLowerCase().split(/(\d+)/).map(p=>/\d+/.test(p)?Number(p):p) }

// Fetchers with cache-buster (prevents stale reloads)
function withCacheBuster(path){
  const hasQ = path.includes('?')
  const sep = hasQ ? '&' : '?'
  return `${path}${sep}_ts=${Date.now()}`
}
async function raw(method, path, body, token) {
  const url = `${API}${withCacheBuster(path)}`
  if (API_DEBUG) {
    const preview = body ? JSON.stringify(body).slice(0,120) : ''
    console.log(`[api] ${method} ${url}`, preview)
  }
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
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

// Map categories (SVG) used by UI
export const SPACE_TYPES = [
  'desk',
  'small_meeting_space',
  'large_meeting_room',
  'huddle',
  'wellbeing',
  'beerpoint',
]
export const USE_TYPES = ['focus', 'meeting', 'training', 'relaxation']

// Backend enums -> UI mapping
const BACKEND_TYPES = {
  desk: 'desk',
  office: 'office',
  small_room: 'small_room',
  training_room: 'training_room',
  meeting_room: 'meeting_room',
  wellbeing_zone: 'wellbeing_zone',
  beer_point: 'beer_point',
}
const BACKEND_TO_MAP = {
  [BACKEND_TYPES.desk]: 'desk',
  [BACKEND_TYPES.small_room]: 'small_meeting_space',
  [BACKEND_TYPES.training_room]: 'large_meeting_room',
  [BACKEND_TYPES.meeting_room]: 'large_meeting_room',
  [BACKEND_TYPES.wellbeing_zone]: 'wellbeing',
  [BACKEND_TYPES.beer_point]: 'beerpoint',
  [BACKEND_TYPES.office]: 'office',
}
const MAP_TO_BACKEND = {
  desk: BACKEND_TYPES.desk,
  small_meeting_space: BACKEND_TYPES.small_room,
  huddle: BACKEND_TYPES.small_room,
  large_meeting_room: BACKEND_TYPES.training_room,
  wellbeing: BACKEND_TYPES.wellbeing_zone,
  beerpoint: BACKEND_TYPES.beer_point,
  office: BACKEND_TYPES.office,
}

// Public API object
export const api = {
  get:   (p, o) => request('GET',    p, undefined, o?.token ?? getAuthToken()),
  post:  (p, b, o) => request('POST', p, b,        o?.token ?? getAuthToken()),
  put:   (p, b, o) => request('PUT',  p, b,        o?.token ?? getAuthToken()),
  patch: (p, b, o) => request('PATCH',p, b,        o?.token ?? getAuthToken()),
  delete:(p, o) => request('DELETE',  p, undefined,o?.token ?? getAuthToken()),

  login: (email, password) => request('POST', '/auth/login', { email, password }),
  register: (email, full_name, password, role = 'employee') =>
    request('POST', '/auth/register', { email, full_name, password, role }),
  verify: (token) => request('GET', '/auth/verify', undefined, token),

  me: async () => {
    const candidates = ['/users/me', '/api/users/me', '/me', '/api/me']
    for (const p of candidates) {
      try { return await request('GET', p) } catch (e) { if (e.status !== 404) throw e }
    }
    return null
  },
}

// ---------- Spaces normalization (ui_type, ui_map_id) ----------
function normalizeList(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.results)) return data.results
  if (Array.isArray(data.data)) return data.data
  return []
}
function decorateSpaces(spacesRaw){
  const spaces = normalizeList(spacesRaw).map(s => ({ ...s }))
  const desks = spaces.filter(s => ci(s.type)==='desk').sort((a,b)=> nkey(a.name).toString() < nkey(b.name).toString() ? -1 : 1)
  const smalls = spaces.filter(s => ci(s.type)==='small_room').sort((a,b)=> nkey(a.name).toString() < nkey(b.name).toString() ? -1 : 1)

  const deskIndex = new Map(desks.map((s,i)=>[ci(s.name), i+1]))
  const smallIndex = new Map(smalls.map((s,i)=>[ci(s.name), i+1]))

  for (const s of spaces) {
    const bt = ci(s.type)
    const uiType = BACKEND_TO_MAP[bt] || bt
    s.ui_type = uiType

    if (uiType === 'desk') {
      const m = String(s.name||'').match(/desk\s+(\d+)/i)
      const n = m ? Number(m[1]) : deskIndex.get(ci(s.name))
      s.ui_map_id = n ? `desk${n}` : `desk`
    } else if (uiType === 'small_meeting_space') {
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
      s.ui_map_id = nm.includes('bookster') ? 'wellbeing2' : 'wellbeing1'
    } else if (uiType === 'beerpoint') {
      s.ui_map_id = 'beerpoint1'
    } else {
      s.ui_map_id = String(s.id ?? s.space_id ?? s.spaceId ?? '')
    }
  }
  return spaces
}

// Spaces fetch (callable + .search alias). Translate/normalize for UI.
async function fetchSpaces(filters = {}) {
  const f = { ...filters }
  if (f.type && MAP_TO_BACKEND[f.type]) f.type = MAP_TO_BACKEND[f.type]
  const candidates = [`/spaces${qs(f)}`, `/api/spaces${qs(f)}`]
  let lastErr = ''
  for (const p of candidates) {
    try {
      const data = await api.get(p)
      return decorateSpaces(data)
    } catch (e) {
      lastErr = e.message
      if (e.status !== 404) throw e
    }
  }
  throw new Error(lastErr || 'No spaces endpoint found')
}
api.spaces = Object.assign(fetchSpaces, { search: (filters) => fetchSpaces(filters) })

// ---------- Map-id → backend numeric id ----------
async function resolveSpaceId(mapId, attemptsLog) {
  if (isIntLike(mapId)) return Number(mapId)
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

// ---------- Booking create ----------
const PEOPLE_KEYS_ALL = ['attendees','people_count','num_people','participants','people','headcount','pax']
api.createBooking = async function createBooking({ space_id, title, startLocal, endLocal, peopleCount }) {
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

  const base = { space_id: Number(resolvedId), title: title || 'Booking', start_utc, end_utc }
  if (peopleCount && Number(peopleCount) > 0) {
    const n = Number(peopleCount)
    base.attendees = n; PEOPLE_KEYS_ALL.forEach(k => { if (k !== 'attendees') base[k] = n })
  }

  const payloads = [ base, { ...base, start: start_utc, end: end_utc } ]
  const paths = [
    '/bookings','/api/bookings',
    `/spaces/${encodeURIComponent(String(resolvedId))}/bookings`,
    `/api/spaces/${encodeURIComponent(String(resolvedId))}/bookings`,
    `/spaces/${encodeURIComponent(String(resolvedId))}/book`,
    '/api/reservations','/reservations','/api/book',
  ]

  for (const p of paths) {
    for (const payload of payloads) {
      try {
        const res = await raw('POST', p, payload, getAuthToken())
        const text = await res.text().catch(()=> '')
        attempts.push({ method:'POST', path:p, status:res.status, ok:res.ok, payloadShape:Object.keys(payload), resolvedId, responseSnippet:text.slice(0,200) })
        if (res.ok || res.status === 201) {
          let data = null; try { data = text ? JSON.parse(text) : null } catch { data = text || null }
          return { ok: true, data, endpoint: p, payloadUsed: payload, attempts }
        }
        if (res.status === 401 || res.status === 403) {
          const msg = toErrorMessage(text) || `Auth error (${res.status})`
          const err = new Error(msg); err.status = res.status; err.attempts = attempts; throw err
        }
      } catch (e) {
        if (e?.status === 401 || e?.status === 403) throw e
        attempts.push({ method:'POST', path:p, status:e?.status ?? 0, ok:false, payloadShape:Object.keys(payload), resolvedId, error:String(e?.message || e) })
      }
    }
  }
  const err = new Error('No booking endpoint accepted the request (NOT FOUND).')
  err.status = 404; err.attempts = attempts; throw err
}

// ---------- My bookings (consistent after refresh; no async in filters) ----------
async function getCurrentUser() { try { return await api.me() } catch { return null } }
api.myBookings = async function myBookings() {
  const user = await getCurrentUser()
  const uid = user?.id ?? user?.user_id ?? null
  const uemail = user?.email ?? null

  const token = getAuthToken()
  const candidates = [
    '/bookings/mine',
    '/me/bookings','/users/me/bookings','/user/bookings',
    '/api/bookings/mine','/api/me/bookings','/api/users/me/bookings','/api/user/bookings',
    '/bookings','/api/bookings',
    '/reservations/mine','/api/reservations/mine',
    '/reservations','/api/reservations',
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
    let data = null; try { data = await res.json() } catch { data = null }
    let arr = Array.isArray(data) ? data
            : Array.isArray(data?.items) ? data.items
            : Array.isArray(data?.results) ? data.results
            : Array.isArray(data?.data) ? data.data
            : (data && typeof data === 'object') ? [data] : []
    if (!Array.isArray(arr)) arr = []
    if (uid != null || uemail) {
      arr = arr.filter(b => {
        const bid = b.user_id ?? b.userId ?? b.user?.id
        const be = b.user_email ?? b.userEmail ?? b.user?.email
        return (uid != null && bid == uid) || (uemail && be === uemail) || (p.includes('/mine'))
      })
    }
    return arr
  }
  throw new Error(toErrorMessage(lastErrText) || 'No bookings endpoint found')
}

// ---------- CANCEL (hardened): tries DELETE, action endpoints, and status updates ----------
api.deleteBooking = async function deleteBooking(id) {
  const attempts = []
  const token = getAuthToken()

  // Helper to parse JSON and detect cancelled status
  async function okIfCancelled(res){
    if ([200,201,202,204].includes(res.status)) return true
    let txt = ''; try { txt = await res.text() } catch {}
    if (!txt) return false
    try {
      const js = JSON.parse(txt)
      const st = js?.status ?? js?.data?.status
      if (typeof st === 'string' && st.toLowerCase() === 'cancelled') return true
    } catch {}
    return false
  }

  const bases = [
    `/bookings/${id}`, `/api/bookings/${id}`,
    `/reservations/${id}`, `/api/reservations/${id}`,
  ]
  const actionBases = [
    `/bookings/${id}/cancel`, `/api/bookings/${id}/cancel`,
    `/reservations/${id}/cancel`, `/api/reservations/${id}/cancel`,
  ]
  const collectionActions = [
    { path: '/bookings/cancel', body: { id } },
    { path: '/api/bookings/cancel', body: { id } },
    { path: '/reservations/cancel', body: { id } },
    { path: '/api/reservations/cancel', body: { id } },
  ]

  // 1) DELETE resource
  for (const p of bases) {
    const res = await raw('DELETE', p, undefined, token)
    attempts.push({ method:'DELETE', path:p, status:res.status, ok:res.ok })
    if (await okIfCancelled(res)) return { ok:true, endpoint:p, attempts }
  }

  // 2) POST/PUT/PATCH to /{id}/cancel
  for (const p of actionBases) {
    for (const m of ['POST','PATCH','PUT']) {
      const res = await raw(m, p, {}, token)
      attempts.push({ method:m, path:p, status:res.status, ok:res.ok })
      if (await okIfCancelled(res)) return { ok:true, endpoint:`${m} ${p}`, attempts }
    }
  }

  // 3) PATCH/PUT resource with status=cancelled (and optional action)
  for (const p of bases) {
    for (const body of [{status:'cancelled'},{action:'cancel'},{cancel:true}]) {
      for (const m of ['PATCH','PUT','POST']) {
        const res = await raw(m, p, body, token)
        attempts.push({ method:m, path:p, status:res.status, ok:res.ok })
        if (await okIfCancelled(res)) return { ok:true, endpoint:`${m} ${p}`, attempts }
      }
    }
  }

  // 4) POST collection-level /cancel with id
  for (const {path, body} of collectionActions) {
    const res = await raw('POST', path, body, token)
    attempts.push({ method:'POST', path, status:res.status, ok:res.ok })
    if (await okIfCancelled(res)) return { ok:true, endpoint:path, attempts }
  }

  const err = new Error('Cancel failed (NOT FOUND).')
  err.status = 404; err.attempts = attempts; throw err
}

// Day view (unchanged)
api.bookingsOn = async function bookingsOn(isoDateStr) {
  const token = getAuthToken()
  const candidates = [
    `/bookings?date=${isoDateStr}`,
    `/api/bookings?date=${isoDateStr}`,
    `/bookings?day=${isoDateStr}`,
    `/api/bookings?day=${isoDateStr}`,
    '/bookings/today','/api/bookings/today',
    '/bookings','/api/bookings',
  ]
  for (const p of candidates) {
    const res = await raw('GET', p, undefined, token)
    if (!res.ok) continue
    let data = null; try { data = await res.json() } catch { data = null }
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
        const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), da= String(d.getDate()).padStart(2,'0')
        return `${y}-${m}-${da}` === isoDateStr
      })
    }
    return arr
  }
  return []
}

// frontend/src/lib/api.js
// (keep your file exactly as you sent; append the block below to the end)

// ---------- Admin: pending bookings + approve / reject (minimal, robust) ----------
api.pendingBookings = async function pendingBookings() {
  const token = getAuthToken()
  const candidates = ['/bookings/pending', '/api/bookings/pending']

  for (const p of candidates) {
    try {
      const res = await raw('GET', p, undefined, token)
      if (!res.ok) continue
      let data = null; try { data = await res.json() } catch { data = null }
      if (!data) continue
      if (Array.isArray(data)) return data
      if (Array.isArray(data.items)) return data.items
      if (Array.isArray(data.results)) return data.results
      if (Array.isArray(data.data)) return data.data
    } catch {}
  }
  return []
}

api.approveBooking = async function approveBooking(id) {
  const token = getAuthToken()
  const postTargets = [
    `/bookings/${id}/approve`, `/api/bookings/${id}/approve`,
    `/reservations/${id}/approve`, `/api/reservations/${id}/approve`,
  ]
  for (const p of postTargets) {
    try {
      const res = await raw('POST', p, {}, token)
      if (res.ok) { try { return await res.json() } catch { return { ok:true } } }
    } catch {}
  }
  // fallback: patch status
  const patchTargets = [
    `/bookings/${id}`, `/api/bookings/${id}`,
    `/reservations/${id}`, `/api/reservations/${id}`,
  ]
  for (const p of patchTargets) {
    try {
      const res = await raw('PATCH', p, { status: 'approved' }, token)
      if (res.ok) { try { return await res.json() } catch { return { ok:true } } }
    } catch {}
  }
  throw new Error('Approve failed')
}

api.rejectBooking = async function rejectBooking(id) {
  const token = getAuthToken()
  const postTargets = [
    `/bookings/${id}/reject`, `/api/bookings/${id}/reject`,
    `/reservations/${id}/reject`, `/api/reservations/${id}/reject`,
  ]
  for (const p of postTargets) {
    try {
      const res = await raw('POST', p, {}, token)
      if (res.ok) { try { return await res.json() } catch { return { ok:true } } }
    } catch {}
  }
  // fallback: patch status
  const patchTargets = [
    `/bookings/${id}`, `/api/bookings/${id}`,
    `/reservations/${id}`, `/api/reservations/${id}`,
  ]
  for (const p of patchTargets) {
    try {
      const res = await raw('PATCH', p, { status: 'rejected' }, token)
      if (res.ok) { try { return await res.json() } catch { return { ok:true } } }
    } catch {}
  }
  throw new Error('Reject failed')
}

