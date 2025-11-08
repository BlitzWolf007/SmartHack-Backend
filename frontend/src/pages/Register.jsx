import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api.js'

export default function Register() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('employee')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const nav = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      await api.register(email, fullName, password, role)
      setOk(true)
      setTimeout(() => nav('/login'), 900)
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      className="container"
      style={{
        minHeight: 'calc(100dvh - 64px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ maxWidth: 520, width: '100%' }}>
        <h2 style={{ fontSize: 40, margin: '8px 0', textAlign: 'center' }}>Create your account</h2>
        <p className="helper" style={{ textAlign: 'center', fontSize: 18 }}>
          Join and start booking desks & rooms in seconds.
        </p>
        <div className="mt-4 card" style={{ padding: '1.5rem' }}>
          <form onSubmit={onSubmit}>
            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ fontSize: 16, padding: '10px' }}
              />
            </div>

            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <label className="label" htmlFor="full_name">Full name</label>
              <input
                id="full_name"
                className="input"
                type="text"
                placeholder="Ada Lovelace"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                style={{ fontSize: 16, padding: '10px' }}
              />
            </div>

            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ fontSize: 16, padding: '10px' }}
              />
            </div>

            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <label className="label" htmlFor="role">Role</label>
              <select
                id="role"
                className="input"
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{ fontSize: 16, padding: '10px' }}
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              <div className="helper">Manager maps to admin in backend.</div>
            </div>

            {error && <div className="badge yellow" role="alert">{error}</div>}
            {ok && <div className="badge blue" role="status">Account created! Redirecting…</div>}

            <div className="form-actions" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                className="btn accent"
                disabled={loading}
                style={{ fontSize: 18, padding: '10px 20px' }}
              >
                {loading ? 'Creating…' : 'Create account'}
              </button>
              <span className="helper" style={{ display: 'block', marginTop: '10px', fontSize: 16 }}>
                Already have an account? <Link to="/login">Log in</Link>
              </span>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
