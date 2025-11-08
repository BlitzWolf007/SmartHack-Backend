const API_BASE = localStorage.getItem('api_base') || 'http://localhost:8000';

let token = localStorage.getItem('token') || null;
let me = null;

const el = (sel) => document.querySelector(sel);
const list = (sel) => document.querySelectorAll(sel);

function setAuthUI() {
  const info = el('#user-info');
  const btnLogin = el('#btn-login');
  const btnLogout = el('#btn-logout');
  const adminSection = document.querySelector('.admin-only');

  if (me) {
    info.textContent = `${me.full_name} (${me.role})`;
    btnLogin.classList.add('hidden');
    btnLogout.classList.remove('hidden');
    if (me.role === 'admin') adminSection.classList.remove('hidden');
    else adminSection.classList.add('hidden');
  } else {
    info.textContent = '';
    btnLogin.classList.remove('hidden');
    btnLogout.classList.add('hidden');
    adminSection.classList.add('hidden');
  }
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

async function loadMe() {
  if (!token) { me = null; setAuthUI(); return; }
  try {
    me = await api('/users/me');
  } catch {
    token = null; localStorage.removeItem('token'); me = null;
  }
  setAuthUI();
}

async function loadSpaces() {
  const type = el('#filter-type').value;
  const activity = el('#filter-activity').value;
  const q = el('#search-q').value.trim();
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (activity) params.set('activity', activity);
  if (q) params.set('q', q);
  const spaces = await api(`/spaces?${params.toString()}`);

  const listEl = el('#spaces');
  const select = el('#space-id');
  listEl.innerHTML = ''; select.innerHTML = '';
  spaces.forEach(s => {
    const li = document.createElement('li');
    li.className = 'space-item';
    li.innerHTML = `
      <div>
        <strong>${s.name}</strong>
        <div class="space-meta">
          <span class="badge">${s.type}</span>
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
    opt.textContent = `${s.name} (${s.type})`;
    select.appendChild(opt);
  });

  list('.btn-check').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const today = new Date().toISOString().slice(0,10);
      const data = await api(`/spaces/${id}/availability?date=${today}`);
      alert(`${data.space.name} bookings today:\n` + data.bookings.map(b => `${b.start_utc} - ${b.end_utc} (${b.status})`).join('\n') || 'none');
    });
  });
}

async function loadMyBookings() {
  if (!token) { el('#my-bookings').innerHTML = '<li>Login to see your bookings.</li>'; return; }
  const bookings = await api('/bookings/mine');
  const elList = el('#my-bookings');
  elList.innerHTML = '';
  bookings.forEach(b => {
    const li = document.createElement('li');
    li.className = 'space-item';
    li.innerHTML = `
      <div>
        <strong>${b.title}</strong>
        <div class="space-meta">
          <span class="badge">${b.space.name}</span>
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
  list('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      await api(`/bookings/${btn.getAttribute('data-id')}`, { method: 'DELETE' });
      await loadMyBookings();
    });
  });
}

async function loadPending() {
  if (!token || !me || me.role !== 'admin') { el('#pending').innerHTML = ''; return; }
  const pending = await api('/bookings/pending');
  const elList = el('#pending');
  elList.innerHTML = '';
  pending.forEach(b => {
    const li = document.createElement('li');
    li.className = 'space-item';
    li.innerHTML = `
      <div>
        <strong>${b.title}</strong>
        <div class="space-meta">
          <span class="badge">${b.space.name}</span>
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
  list('.approve').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/bookings/${btn.getAttribute('data-id')}/approve`, { method: 'POST' });
    await loadPending(); await loadMyBookings();
  }));
  list('.reject').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/bookings/${btn.getAttribute('data-id')}/reject`, { method: 'POST' });
    await loadPending(); await loadMyBookings();
  }));
}

function toUTCDateTimeLocalValue(d = new Date()) {
  // Returns "YYYY-MM-DDTHH:MM" (no seconds) in UTC
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

async function main() {
  el('#btn-login').addEventListener('click', () => el('#login-dialog').showModal());
  el('#btn-logout').addEventListener('click', () => {
    token = null; localStorage.removeItem('token'); me = null;
    setAuthUI(); loadMyBookings(); loadPending();
  });

  el('#btn-search').addEventListener('click', () => loadSpaces());
  el('#booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!token) { alert('Login first.'); return; }
    const payload = {
      space_id: Number(el('#space-id').value),
      title: el('#title').value,
      attendees: Number(el('#attendees').value),
      start_utc: new Date(el('#start').value + 'Z').toISOString(),
      end_utc: new Date(el('#end').value + 'Z').toISOString(),
      notes: el('#notes').value || null,
    };
    try {
      await api('/bookings', { method: 'POST', body: JSON.stringify(payload) });
      alert('Booked!');
      await loadMyBookings(); await loadPending();
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  });

  el('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = el('#login-email').value.trim();
    const password = el('#login-password').value.trim();
    try {
      const res = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      token = res.access_token;
      localStorage.setItem('token', token);
      el('#login-dialog').close();
      await loadMe();
      await loadMyBookings();
      await loadPending();
    } catch (err) {
      alert('Login failed');
    }
  });

  // sensible defaults for form times (next hour UTC)
  const now = new Date();
  now.setUTCMinutes(0,0,0);
  now.setUTCHours(now.getUTCHours()+1);
  el('#start').value = toUTCDateTimeLocalValue(now);
  const end = new Date(now); end.setUTCHours(end.getUTCHours()+1);
  el('#end').value = toUTCDateTimeLocalValue(end);

  await loadMe();
  await loadSpaces();
  await loadMyBookings();
  await loadPending();
}

main();
