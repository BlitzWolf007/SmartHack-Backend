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
      style={{
        position: 'relative',
        minHeight: 'calc(100dvh - 64px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0D1733',
        overflow: 'hidden',
      }}
    >
      {/* ORANGE circle */}
      <div
        style={{
          position: 'absolute',
          background: '#EB6F38',
          width: 360,
          height: 360,
          borderRadius: '50%',
          top: '50%',
          left: 5,
          transform: 'translateY(-50%)',
          opacity: 0.70,
          zIndex: 0,
        }}
      />

      {/* YELLOW circle */}
      <div
        style={{
          position: 'absolute',
          background: '#ECB03D',
          width: 220,
          height: 220,
          borderRadius: '50%',
          bottom: 60,
          right: 400,
          opacity: 0.70,
          zIndex: 0,
        }}
      />

      {/* BLUE circle */}
      <div
        style={{
          position: 'absolute',
          background: '#4B8AB8',
          width: 420,
          height: 420,
          borderRadius: '50%',
          top: 10,
          right: 0,
          opacity: 0.75,
          zIndex: 0,
        }}
      />

      {/* MAIN REGISTER CARD */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 520,
          textAlign: 'center',
          color: '#E7ECF5',
          transform: 'translateY(-100px)', // move slightly up
        }}
      >
        {/* Colored heading */}
        <h2 style={{ fontSize: 40, margin: '8px 0', textAlign: 'center' }}>
          <span style={{ color: '#E7ECF5' }}>Create </span>
          <span style={{ color: '#E7ECF5' }}>your </span>
          <span style={{ color: '#E7ECF5' }}>account</span>
        </h2>
        <p style={{ textAlign: 'center', fontSize: 18, color: '#A9B3C7' }}>
          Join and start booking desks & rooms in seconds.
        </p>

        <div
          style={{
            marginTop: 24,
            background:
              'linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0)), #132243',
            border: '1px solid rgba(231,236,245,.07)',
            borderRadius: 16,
            boxShadow: '0 10px 30px rgba(11,21,41,.35)',
            padding: '1.5rem',
          }}
        >
          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label htmlFor="email" style={{ fontSize: 13, color: '#A9B3C7', marginBottom: 6, display: 'block' }}>Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: '#0f1c3a',
                  border: '1px solid rgba(231,236,245,.12)',
                  color: '#E7ECF5',
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontSize: 16,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label htmlFor="full_name" style={{ fontSize: 13, color: '#A9B3C7', marginBottom: 6, display: 'block' }}>Full name</label>
              <input
                id="full_name"
                type="text"
                placeholder="Ada Lovelace"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: '#0f1c3a',
                  border: '1px solid rgba(231,236,245,.12)',
                  color: '#E7ECF5',
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontSize: 16,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label htmlFor="password" style={{ fontSize: 13, color: '#A9B3C7', marginBottom: 6, display: 'block' }}>Password</label>
              <input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: '#0f1c3a',
                  border: '1px solid rgba(231,236,245,.12)',
                  color: '#E7ECF5',
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontSize: 16,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label htmlFor="role" style={{ fontSize: 13, color: '#A9B3C7', marginBottom: 6, display: 'block' }}>Role</label>
              <select
                id="role"
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0f1c3a',
                  border: '1px solid rgba(231,236,245,.12)',
                  color: '#E7ECF5',
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontSize: 16,
                  outline: 'none',
                }}
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              <div style={{ fontSize: 12, color: '#A9B3C7', marginTop: 4 }}>Manager maps to admin in backend.</div>
            </div>

            {error && (
              <div
                style={{
                  background: 'rgba(236,176,61,0.25)',
                  color: '#ECB03D',
                  border: '1px solid rgba(236,176,61,0.45)',
                  borderRadius: 999,
                  padding: '6px 10px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
                role="alert"
              >
                {error}
              </div>
            )}

            {ok && (
              <div
                style={{
                  background: 'rgba(75,138,184,0.25)',
                  color: '#4B8AB8',
                  border: '1px solid rgba(75,138,184,0.45)',
                  borderRadius: 999,
                  padding: '6px 10px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
                role="status"
              >
                Account created! Redirecting…
              </div>
            )}

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                disabled={loading}
                style={{
                  fontSize: 18,
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: 12,
                  fontWeight: 600,
                  background: '#ECB03D',
                  color: '#1a1300',
                  cursor: 'pointer',
                }}
              >
                {loading ? 'Creating…' : 'Create account'}
              </button>
              <span
                style={{
                  display: 'block',
                  marginTop: 10,
                  fontSize: 16,
                  color: '#A9B3C7',
                }}
              >
                Already have an account?{' '}
                <Link
                  to="/login"
                  style={{ color: '#EB6F38', fontWeight: 600 }}
                >
                  Log in
                </Link>
              </span>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
