// ---------- Config ----------
const API_BASE = 'https://smarthack-backend.onrender.com';

document.getElementById('api-base').textContent = API_BASE;

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function setText(id, txt) { const el = $(id); if (el) el.textContent = txt || ''; }
function setError(id, msg) { const el = $(id); if (el) el.textContent = msg || ''; }

function toast(msg) { alert(msg); }

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const detail = (body && (body.detail || body.message)) || text || `HTTP ${res.status}`;
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return body;
}

function setAuthUI(me) {
  const info = $('#user-info');
  const btnLogout = $('#btn-logout');
  if (me) {
    info.textContent = `${me.full_name} (${me.role})`;
    btnLogout.classList.remove('hidden');
  } else {
    info.textContent = '';
    btnLogout.classList.add('hidden');
  }
}

// ---------- State ----------
let me = null;

// ---------- Auth view logic ----------
function switchTab(which) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === which));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id.startsWith(which)));
}

async function tryVerifyToken() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const user = await api('/auth/verify');
    return user;
  } catch (e) {
    // invalid/expired token
    localStorage.removeItem('token');
    return null;
  }
}

async function showAuth() {
  hide('#app-view');
  show('#auth-view');
  setAuthUI(null);
}

async function showApp() {
  hide('#auth-view');
  show('#app-view');
  await loadMe();
  await loadSpaces();
  await loadMyBookings();
  await loadPending();
}

async function handleLogin(e) {
  e?.preventDefault?.();
  setError('#login-error', '');
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value.trim();
  if (password.length < 3) { setError('#login-error','Password is too short.'); return; }

  const btn = $('#login-submit'); btn.disabled = true;
  try {
    const res = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('token', res.access_token);
    await showApp();
  } catch (err) {
    setError('#login-error', String(err.message || 'Login failed'));
  } finally {
    btn.disabled = false;
  }
}

async function handleRegister(e) {
  e?.preventDefault?.();
  setError('#register-error', '');
  const full_name = $('#reg-name').value.trim();
  const email = $('#reg-email').value.trim();
  const password = $('#reg-password').value.trim();
  const role = ($('#reg-role')?.value || 'employee');  // <-- add this line
  const avatar_url = ($('#reg-avatar').value || '').trim() || null;

  if (password.length < 8) { setError('#register-error','Use at least 8 characters.'); return; }

  const btn = $('#register-submit'); btn.disabled = true;
  try {
    await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ full_name, email, password, role, avatar_url }) // <-- include role
    });
    const res = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('token', res.access_token);
    await showApp();
  } catch (err) {
    setError('#register-error', String(err.message || 'Register failed'));
  } finally {
    btn.disabled = false;
  }
}


// ---------- API loaders ----------
async function loadMe() {
  try {
    me = await api('/users/me');
    setAuthUI(me);
    // role-gated admin section
    const adminSection = document.querySelector('.admin-only');
    if (me.role === 'admin') adminSection.classList.remove('hidden');
    else adminSection.classList.add('hidden');
  } catch {
    me = null;
    setAuthUI(null);
  }
}

async function loadSpaces() {
  const type = $('#filter-type').value;          // reads the selected type
  const activity = $('#filter-activity').value;  // optional activity filter
  const q = $('#search-q').value.trim();         // optional search

  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (activity) params.set('activity', activity);
  if (q) params.set('q', q);

  const listEl = $('#spaces');
  const select = $('#space-id');
  listEl.innerHTML = ''; select.innerHTML = '';

  let spaces = [];
  try {
    spaces = await api(`/spaces${params.toString() ? `?${params}` : ''}`);
  } catch (e) {
    toast(`Failed to load spaces: ${e.message}`);
    return;
  }

  // Sort by type alphabetically (optional) or keep natural order
  spaces.sort((a,b) => a.type.localeCompare(b.type));

  spaces.forEach(s => {
    const li = document.createElement('li');
    li.className = 'space-item';
    li.innerHTML = `
      <div>
        <strong>${s.name}</strong>
        <div class="space-meta">
          <span class="badge">${s.type.replace('_', ' ')}</span>
          <span class="badge">${s.activity}</span>
          <span class="badge">cap ${s.capacity}</span>
          ${s.requires_approval ? '<span class="badge">needs approval</span>' : ''}
        </div>
      </div>
      <button data-id="${s.id}" class="btn-check">Check today</button>
    `;
    listEl.appendChild(li);

    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.name} (${s.type.replace('_',' ')})`;
    select.appendChild(opt);
  });

  $$('.btn-check').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const today = new Date().toISOString().slice(0,10);
      try {
        const data = await api(`/spaces/${id}/availability?date=${today}`);
        const lines = (data.bookings || []).map(
          b => `${new Date(b.start_utc).toISOString()} — ${new Date(b.end_utc).toISOString()} (${b.status}, ${b.attendees} ppl)`
        );
        toast(`${data.space.name} bookings today:\n${lines.length ? lines.join('\n') : 'none'}`);
      } catch (e2) {
        toast(`Availability failed: ${e2.message}`);
      }
    });
  });
}

async function loadMyBookings() {
  const elList = $('#my-bookings');
  elList.innerHTML = '';

  if (!localStorage.getItem('token')) {
    elList.innerHTML = '<li>Please login to see your bookings.</li>';
    return;
  }

  let bookings = [];
  try {
    bookings = await api('/bookings/mine');
  } catch (e) {
    toast(`Failed to load your bookings: ${e.message}`);
    return;
  }

  bookings.forEach(b => {
    const li = document.createElement('li');
    li.className = 'space-item';
    li.innerHTML = `
      <div>
        <strong>${b.title}</strong>
        <div class="space-meta">
          <span class="badge">${b.space?.name || `#${b.space_id}`}</span>
          <span class="badge">${b.attendees} ppl</span>
          <span class="badge">${new Date(b.start_utc).toISOString()}</span>
          <span class="badge">${new Date(b.end_utc).toISOString()}</span>
          <span class="badge">${b.status}</span>
        </div>
      </div>
      <button data-id="${b.id}" class="btn-cancel">Cancel</button>
    `;
    elList.appendChild(li);
  });

    $$('.btn-cancel').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const li = btn.closest('li');
      const listEl = document.getElementById('my-bookings');
      try {
        const res = await api(`/bookings/${btn.getAttribute('data-id')}`, { method: 'DELETE' });
        toast(res?.message || 'booking cancelled');

        // Remove the item safely
        if (li) li.remove();

        // If no more real bookings remain, show empty-state
        if (listEl && !listEl.querySelector('.space-item')) {
          listEl.innerHTML = '<li>No bookings yet.</li>';
        }
      } catch (e) {
        toast(`Cancel failed: ${e.message}`);
      }
    });
  });


}

async function loadPending() {
  const elList = $('#pending');
  elList.innerHTML = '';
  if (!me || me.role !== 'admin') return;

  let pending = [];
  try { pending = await api('/bookings/pending'); }
  catch (e) { toast(`Failed to load pending: ${e.message}`); return; }

  pending.forEach(b => {
    const li = document.createElement('li');
    li.className = 'space-item';
    li.innerHTML = `
      <div>
        <strong>${b.title}</strong>
        <div class="space-meta">
          <span class="badge">${b.space?.name || `#${b.space_id}`}</span>
          <span class="badge">${b.attendees} ppl</span>
          <span class="badge">${new Date(b.start_utc).toISOString()}</span>
          <span class="badge">${new Date(b.end_utc).toISOString()}</span>
          <span class="badge">${b.status}</span>
        </div>
      </div>
      <div>
        <button class="approve" data-id="${b.id}">Approve</button>
        <button class="reject" data-id="${b.id}">Reject</button>
      </div>
    `;
    elList.appendChild(li);
  });

  $$('.approve').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await api(`/bookings/${btn.getAttribute('data-id')}/approve`, { method: 'POST' });
      await loadPending(); await loadMyBookings();
    } catch (e) { toast(`Approve failed: ${e.message}`); }
  }));
  $$('.reject').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await api(`/bookings/${btn.getAttribute('data-id')}/reject`, { method: 'POST' });
      await loadPending(); await loadMyBookings();
    } catch (e) { toast(`Reject failed: ${e.message}`); }
  }));
}

// ---------- Booking form ----------
function toUTCInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

async function onCreateBooking(e) {
  e?.preventDefault?.();
  setError('#booking-error','');
  if (!localStorage.getItem('token')) { await showAuth(); return; }

  const payload = {
    space_id: Number($('#space-id').value),
    title: $('#title').value.trim(),
    attendees: Number($('#attendees').value),
    start_utc: new Date($('#start').value + 'Z').toISOString(),
    end_utc: new Date($('#end').value + 'Z').toISOString(),
    notes: ($('#notes').value || '').trim() || null,
  };
  if (!payload.title) { setError('#booking-error','Title is required.'); return; }

  try {
    await api('/bookings', { method: 'POST', body: JSON.stringify(payload) });
    await loadMyBookings();
    toast('Booked!');
  } catch (e) {
    setError('#booking-error', e.message);
  }
}

// ---------- Boot ----------
async function main() {
  // Tabs
  $$('.tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

  // Auth handlers
  $('#login-form').addEventListener('submit', handleLogin);
  $('#register-form').addEventListener('submit', handleRegister);

  // Logout
  $('#btn-logout').addEventListener('click', async () => {
    localStorage.removeItem('token');
    me = null;
    await showAuth();
  });

  // Search & booking handlers
  $('#btn-search').addEventListener('click', loadSpaces);
  $('#booking-form').addEventListener('submit', onCreateBooking);

  // Default booking times (next hour, 1h duration) in UTC
  const now = new Date(); now.setUTCMinutes(0,0,0); now.setUTCHours(now.getUTCHours()+1);
  const end = new Date(now); end.setUTCHours(end.getUTCHours()+1);
  $('#start').value = toUTCInputValue(now);
  $('#end').value = toUTCInputValue(end);

  // Route: if JWT valid -> dashboard, else -> auth
  const user = await tryVerifyToken();
  if (user) { await showApp(); }
  else { await showAuth(); }
}

main();
