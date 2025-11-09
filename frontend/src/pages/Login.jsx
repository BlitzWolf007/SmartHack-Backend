import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const nav = useNavigate()
  const { signIn } = useAuth()

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signIn(email, password)
      nav('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed')
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

      {/* MAIN LOGIN CARD */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 520,
          textAlign: 'center',
          color: '#E7ECF5',
          transform: 'translateY(-100px)', // moved more up
        }}
      >
        <h2 style={{ fontSize: 40, margin: '8px 0' }}>Welcome back</h2>
        <p style={{ fontSize: 18, color: '#A9B3C7' }}>
          Sign in to book desks and rooms faster than ever.
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
              <label
                htmlFor="email"
                style={{
                  fontSize: 13,
                  color: '#A9B3C7',
                  marginBottom: 6,
                  display: 'block',
                }}
              >
                Email
              </label>
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
              <label
                htmlFor="password"
                style={{
                  fontSize: 13,
                  color: '#A9B3C7',
                  marginBottom: 6,
                  display: 'block',
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
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
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <span
                style={{
                  display: 'block',
                  marginTop: 10,
                  fontSize: 16,
                  color: '#A9B3C7',
                }}
              >
                No account?{' '}
                <Link
                  to="/register"
                  style={{
                    color: '#EB6F38',
                    fontWeight: 600,
                  }}
                >
                  Register
                </Link>
              </span>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
