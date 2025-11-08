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
      className="container"
      style={{
        minHeight: 'calc(100dvh - 64px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ maxWidth: 520, width: '100%' }}>
        <h2 style={{ fontSize: 40, margin: '8px 0', textAlign: 'center' }}>Welcome back</h2>
        <p className="helper" style={{ textAlign: 'center', fontSize: 18 }}>
          Sign in to book desks and rooms faster than ever.
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
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ fontSize: 16, padding: '10px' }}
              />
            </div>
            {error && <div className="badge yellow" role="alert">{error}</div>}
            <div className="form-actions" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                className="btn accent"
                disabled={loading}
                style={{ fontSize: 18, padding: '10px 20px' }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <span className="helper" style={{ display: 'block', marginTop: '10px', fontSize: 16 }}>
                No account? <Link to="/register">Register</Link>
              </span>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
