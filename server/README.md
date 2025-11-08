# Interactive Office Planner & Booking System (Polished)

- JWT auth (login/register), roles (employee/admin)
- Spaces with availability, bookings with attendees, conflict detection
- Approval flow for special spaces
- Minimal frontend (vanilla) ready to plug in an office map

## Run backend

```bash
cd server
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Optional: configure CORS in .env
cp .env.example .env
# Seed demo data
python -m server.seed
# Start API
uvicorn server.app:app --reload
```

**Demo users**
- admin: `admin@example.com` / `Hackathon@1234`
- user:  `test@example.com` / `Hackathon@1234`

## CORS

- By default, localhost & 127.0.0.1 on any port are allowed via regex.
- To pin exact origins, set `CORS_ORIGINS` in `.env` as comma-separated URLs.

## Frontend

Serve `frontend/` statically:

```bash
cd frontend
python -m http.server 5173
```

In the browser console you can point to a different API without editing files:
```js
localStorage.setItem('api_base', 'http://localhost:8000'); location.reload();
```

## API (JSON)
- `POST /auth/register` → `{email, full_name, password, role?, avatar_url?}`
- `POST /auth/login` → `{email, password}` returns `{access_token}`
- `GET /users/me` (Auth)
- `GET /spaces?type=&activity=&q=`
- `GET /spaces/{id}/availability?date=YYYY-MM-DD`
- `POST /bookings` (Auth) `{space_id,title,attendees,start_utc,end_utc,notes?}`
- `GET /bookings/mine` (Auth)
- `DELETE /bookings/{id}` (Auth; own booking)
- `GET /bookings/pending` (Admin)
- `POST /bookings/{id}/approve` (Admin)
- `POST /bookings/{id}/reject` (Admin)
