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

// Cache-buster
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
  huddle: 'huddle', // if backend emits it
}
const BACKEND_TO_MAP = {
  [BACKEND_TYPES.desk]: 'desk',
  [BACKEND_TYPES.small_room]: 'small_meeting_space',
  [BACKEND_TYPES.training_room]: 'large_meeting_room',
  [BACKEND_TYPES.meeting_room]: 'large_meeting_room',
  [BACKEND_TYPES.wellbeing_zone]: 'wellbeing',
  [BACKEND_TYPES.beer_point]: 'beerpoint',
  [BACKEND_TYPES.office]: 'office',
  [BACKEND_TYPES.huddle]: 'huddle',
}
const MAP_TO_BACKEND = {
  desk: BACKEND_TYPES.desk,
  small_meeting_space: BACKEND_TYPES.small_room,
  huddle: BACKEND_TYPES.small_room, // alias for filtering
  large_meeting_room: BACKEND_TYPES.training_room,
  wellbeing: BACKEND_TYPES.wellbeing_zone,
  beerpoint: BACKEND_TYPES.beer_point,
  office: BACKEND_TYPES.office,
}

// UI labels (Molson Coors)
const MOLSON_COORS_BEERS = [
  'Coors Light','Miller Genuine Draft','Blue Moon','Staropramen','Carling',
  'Bergenbier','Madri Excepcional',"Leinenkugel's",'Pravha','Jelen',
]
const MOLSON_COORS_JUICES = [
  'Clearly Canadian','ZICO Coconut Water','MadVine','Aspire Healthy Energy',
  'Huzzah! Probiotic Soda','Lemon Perfect','Crispin Cider',
]
const DRINK_VARIANTS = ['', ' Draft', ' Zero', ' Lime', ' Gold', ' Ice', ' Light']
function makeUniqueNames(baseList, needed) {
  const out = []
  if (!Array.isArray(baseList) || baseList.length === 0) return out
  outer:
  for (const variant of DRINK_VARIANTS) {
    for (const base of baseList) {
      const name = `${base}${variant}`.trim()
      if (!out.includes(name)) out.push(name)
      if (out.length >= needed) break outer
    }
  }
  while (out.length < needed) out.push(`${baseList[out.length % baseList.length]} ${out.length+1}`)
  return out
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

  // PATCH user (Profile / AuthContext.updateUser)
  updateUser: async (partial) => {
    const token = getAuthToken()
    const paths = ['/users/me', '/api/users/me', '/me', '/api/me']
    for (const p of paths) {
      for (const m of ['PATCH','PUT','POST']) {
        try {
          const res = await raw(m, p, partial, token)
          if (res.ok) { try { return await res.json() } catch { return partial } }
        } catch {}
      }
    }
    throw new Error('Failed to update profile')
  },

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

  const desks   = spaces.filter(s => ci(s.type)==='desk')
                        .sort((a,b)=> nkey(a.name).toString() < nkey(b.name).toString() ? -1 : 1)
  const smalls  = spaces.filter(s => ci(s.type)==='small_room')
                        .sort((a,b)=> nkey(a.name).toString() < nkey(b.name).toString() ? -1 : 1)
  const huddles = spaces.filter(s => ci(s.type)==='huddle')
                        .sort((a,b)=> nkey(a.name).toString() < nkey(b.name).toString() ? -1 : 1)

  const deskIndex   = new Map(desks.map((s,i)=>[ci(s.name), i+1]))
  const smallIndex  = new Map(smalls.map((s,i)=>[ci(s.name), i+1]))
  const huddleIndex = new Map(huddles.map((s,i)=>[ci(s.name), i+1]))

  const smallUnique = makeUniqueNames(MOLSON_COORS_BEERS, smalls.length)
  const smallDrinkByObj = new WeakMap()
  smalls.forEach((obj, i) => smallDrinkByObj.set(obj, smallUnique[i]))

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
      const chosen = smallDrinkByObj.get(s) || smallUnique[(n ? n - 1 : 0)]
      if (!s.original_name) s.original_name = s.name
      s.name = chosen
      s.ui_label = s.name

    } else if (uiType === 'huddle') {
      const n = huddleIndex.get(ci(s.name)) || null
      s.ui_map_id = `huddle${n || 1}`
      const idx = ((n || 1) - 1) % MOLSON_COORS_JUICES.length
      if (!s.original_name) s.original_name = s.name
      s.name = MOLSON_COORS_JUICES[idx]
      s.ui_label = s.name

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

// Spaces fetch
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

// ---------- Map-id → backend numeric id (tolerant) ----------
async function resolveSpaceId(mapId) {
  if (isIntLike(mapId)) return Number(mapId)

  let spaces = null
  for (const path of ['/spaces', '/api/spaces']) {
    const res = await raw('GET', path, undefined, getAuthToken())
    if (!res.ok) continue
    try { spaces = decorateSpaces(await res.json()); break } catch {}
  }
  if (!Array.isArray(spaces) || !spaces.length) return null

  const key = String(mapId)
  const keyCI = ci(key)
  const getNum = (s) => s?.id ?? s?.space_id ?? s?.spaceId
  const asNum = (v) => isIntLike(v) ? Number(v) : null

  const exactUi = spaces.find(s => String(s.ui_map_id || '') === key)
  if (exactUi) { const n = asNum(getNum(exactUi)); if (n != null) return n }

  const direct = spaces.find(s => {
    const fields = [
      s?.id?.toString(), s?.space_id?.toString(), s?.spaceId?.toString(),
      s?.name, s?.code, s?.slug, s?.key,
    ].filter(Boolean).map(ci)
    return fields.includes(keyCI)
  })
  if (direct) { const n = asNum(getNum(direct)); if (n != null) return n }

  const prefixUi = spaces.find(s => String(s.ui_map_id || '').toLowerCase().startsWith(keyCI))
  if (prefixUi) { const n = asNum(getNum(prefixUi)); if (n != null) return n }

  const byUiType = spaces.find(s => ci(s?.ui_type) === keyCI)
  if (byUiType) { const n = asNum(getNum(byUiType)); if (n != null) return n }

  const byBackendType = spaces.find(s => ci(s?.type) === keyCI)
  if (byBackendType) { const n = asNum(getNum(byBackendType)); if (n != null) return n }

  const containsUi = spaces.find(s => String(s.ui_map_id || '').toLowerCase().includes(keyCI))
  if (containsUi) { const n = asNum(getNum(containsUi)); if (n != null) return n }

  return null
}

// ---------- Booking create ----------
const PEOPLE_KEYS_ALL = ['attendees','people_count','num_people','participants','people','headcount','pax']
api.createBooking = async function createBooking({ space_id, title, startLocal, endLocal, peopleCount }) {
  const resolvedId = await resolveSpaceId(space_id)
  if (!isIntLike(resolvedId)) {
    const err = new Error(`Unable to resolve space_id for "${space_id}". Please ensure the space exists in backend.`)
    err.status = 422
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
        if (res.ok || res.status === 201) {
          try { return await res.json() } catch { return { ok:true } }
        }
        if (res.status === 401 || res.status === 403) {
          const text = await res.text().catch(()=> '')
          const msg = toErrorMessage(text) || `Auth error (${res.status})`
          throw Object.assign(new Error(msg), { status: res.status })
        }
      } catch (e) {
        if (e?.status === 401 || e?.status === 403) throw e
      }
    }
  }
  const err = new Error('No booking endpoint accepted the request (NOT FOUND).')
  err.status = 404; throw err
}

// ---------- My bookings ----------
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

// ---------- CANCEL ----------
api.deleteBooking = async function deleteBooking(id) {
  const token = getAuthToken()

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

  for (const p of bases) {
    const res = await raw('DELETE', p, undefined, token)
    if (await okIfCancelled(res)) return { ok:true, endpoint:p }
  }

  for (const p of actionBases) {
    for (const m of ['POST','PATCH','PUT']) {
      const res = await raw(m, p, {}, token)
      if (await okIfCancelled(res)) return { ok:true, endpoint:`${m} ${p}` }
    }
  }

  for (const p of bases) {
    for (const body of [{status:'cancelled'},{action:'cancel'},{cancel:true}]) {
      for (const m of ['PATCH','PUT','POST']) {
        const res = await raw(m, p, body, token)
        if (await okIfCancelled(res)) return { ok:true, endpoint:`${m} ${p}` }
      }
    }
  }

  for (const {path, body} of collectionActions) {
    const res = await raw('POST', path, body, token)
    if (await okIfCancelled(res)) return { ok:true, endpoint:path }
  }

  const err = new Error('Cancel failed (NOT FOUND).')
  err.status = 404; throw err
}

// ---------- Day view (compat) ----------
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

// ---------- Admin: pending + approve/reject ----------
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

// ---------- Month / range utilities ----------
function parseISOorNull(s){ const d = new Date(s); return isNaN(d) ? null : d }
function inRangeUTC(bStart, bEnd, startISO, endISO){
  const s0 = parseISOorNull(startISO), e0 = parseISOorNull(endISO)
  if (!s0 || !e0) return true
  const bs = parseISOorNull(bStart), be = parseISOorNull(bEnd)
  if (!bs) return false
  const end = be || bs
  return bs <= e0 && end >= s0
}

api.bookingsInRange = async function bookingsInRange(startISO, endISO) {
  const token = getAuthToken()

  // Prefer direct range endpoints (if backend supports)
  const directCandidates = [
    `/bookings?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`,
    `/api/bookings?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`
  ]
  for (const p of directCandidates) {
    try {
      const res = await raw('GET', p, undefined, token)
      if (res.ok) {
        const data = await res.json().catch(()=>null)
        if (Array.isArray(data)) return data
        if (Array.isArray(data?.items)) return data.items
        if (Array.isArray(data?.results)) return data.results
        if (Array.isArray(data?.data)) return data.data
      }
    } catch {}
  }

  // Fallback: per-space availability
  const spaces = await api.spaces().catch(()=> [])
  if (!Array.isArray(spaces) || !spaces.length) return []

  const all = []
  const chunk = 8
  for (let i = 0; i < spaces.length; i += chunk) {
    const batch = spaces.slice(i, i + chunk)
    const results = await Promise.all(batch.map(async (s) => {
      try {
        // try a range availability if it exists
        let path = `/spaces/${encodeURIComponent(s.id)}/availability${qs({ start: startISO, end: endISO })}`
        let res = await raw('GET', path, undefined, token)
        if (!res.ok) {
          // fallback old style: single day param
          path = `/spaces/${encodeURIComponent(s.id)}/availability${qs({ date: startISO })}`
          res = await raw('GET', path, undefined, token)
        }
        if (!res.ok) return null
        const obj = await res.json().catch(()=>null)
        const bookings = Array.isArray(obj?.bookings) ? obj.bookings
                        : Array.isArray(obj) ? obj : []
        return bookings
          .filter(b => inRangeUTC(b.start_utc || b.start, b.end_utc || b.end, startISO, endISO))
          .map(b => ({
            ...b,
            space: b.space || s,
            space_id: b.space_id ?? s.id,
          }))
      } catch { return null }
    }))
    results.forEach(r => { if (Array.isArray(r)) all.push(...r) })
  }

  const okStatuses = new Set(['pending','approved'])
  return all.filter(b => okStatuses.has(String(b.status || '').toLowerCase()))
}

/**
 * Authoritative monthly count from DB if possible.
 * Tries several likely endpoints; falls back to counting bookingsInRange.
 * @param {number} year full year (e.g. 2025)
 * @param {number} month 1..12
 * @returns {Promise<number>}
 */
api.bookingsCountForMonth = async function bookingsCountForMonth(year, month) {
  const token = getAuthToken()
  const ym = `${year}-${String(month).padStart(2,'0')}`

  // 1) Stats endpoints (preferred; direct DB aggregate)
  const statCandidates = [
    `/stats/bookings/monthly${qs({ month: ym })}`,        // {count:n}
    `/api/stats/bookings/monthly${qs({ month: ym })}`,
    `/bookings/stats/monthly${qs({ month: ym })}`,
    `/api/bookings/stats/monthly${qs({ month: ym })}`,
    `/bookings/count${qs({ month: ym })}`,                 // {count:n} or n
    `/api/bookings/count${qs({ month: ym })}`,
    `/stats/bookings${qs({ year, month })}`,
    `/api/stats/bookings${qs({ year, month })}`,
  ]

  for (const p of statCandidates) {
    try {
      const res = await raw('GET', p, undefined, token)
      if (!res.ok) continue
      const data = await res.json().catch(()=>null)
      if (typeof data === 'number') return data
      if (data && typeof data.count === 'number') return data.count
      if (Array.isArray(data) && typeof data.length === 'number') return data.length
    } catch {}
  }

  // 2) Range listing fallback: count items
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const end   = new Date(year, month, 0, 23, 59, 59, 999)
  const list = await api.bookingsInRange(start.toISOString(), end.toISOString()).catch(()=>[])
  return Array.isArray(list) ? list.length : 0
}

// DEV: expose in console
if (API_DEBUG && typeof window !== 'undefined') window.api = api
