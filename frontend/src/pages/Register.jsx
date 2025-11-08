import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api.js'

export default function Register(){
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('employee') // employee | admin (backend maps "manager" to admin too)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const nav = useNavigate()

  async function onSubmit(e){
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try{
      await api.register(email, fullName, password, role)
      setOk(true)
      // optional: auto-login flow could be added here
      setTimeout(() => nav('/login'), 900)
    }catch(err){
      setError(err.message || 'Registration failed')
    }finally{
      setLoading(false)
    }
  }

  return (
    <section className="container" style={{minHeight:'calc(100dvh - 64px)'}}>
      <div className="grid cols-2" style={{alignItems:'center'}}>
        <div>
          <h2 style={{fontSize:32,margin:'6px 0'}}>Create your account</h2>
          <p className="helper">Join and start booking desks & rooms in seconds.</p>
          <div className="mt-4 card">
            <form onSubmit={onSubmit}>
              <div className="form-row">
                <label className="label" htmlFor="email">Email</label>
                <input
                  id="email" className="input" type="email" placeholder="you@company.com"
                  value={email} onChange={e=>setEmail(e.target.value)} required
                />
              </div>

              <div className="form-row">
                <label className="label" htmlFor="full_name">Full name</label>
                <input
                  id="full_name" className="input" type="text" placeholder="Ada Lovelace"
                  value={fullName} onChange={e=>setFullName(e.target.value)} required
                />
              </div>

              <div className="form-row">
                <label className="label" htmlFor="password">Password</label>
                <input
                  id="password" className="input" type="password" placeholder="At least 8 characters"
                  value={password} onChange={e=>setPassword(e.target.value)} required
                />
              </div>

              <div className="form-row">
                <label className="label" htmlFor="role">Role</label>
                <select id="role" className="input" value={role} onChange={e=>setRole(e.target.value)}>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="helper">Manager maps to admin in backend.</div>
              </div>

              {error && <div className="badge yellow" role="alert">{error}</div>}
              {ok && <div className="badge blue" role="status">Account created! Redirecting…</div>}

              <div className="form-actions">
                <button className="btn accent" disabled={loading}>
                  {loading ? 'Creating…' : 'Create account'}
                </button>
                <span className="helper">
                  Already have an account? <Link to="/login">Log in</Link>
                </span>
              </div>
            </form>
          </div>
        </div>

        <div className="center hidden-sm">
          <RegisterIllustration />
        </div>
      </div>
    </section>
  )
}

function RegisterIllustration(){
  return (
    <svg width="440" height="300" viewBox="0 0 440 300" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ECB03D"/>
          <stop offset="100%" stopColor="#EB6F38"/>
        </linearGradient>
      </defs>
      <rect x="12" y="12" width="416" height="276" rx="24" fill="#132243" stroke="rgba(231,236,245,.12)"/>
      <rect x="40" y="60" width="360" height="20" rx="10" fill="#4B8AB8" opacity=".55"/>
      <rect x="40" y="90" width="260" height="20" rx="10" fill="#4B8AB8" opacity=".35"/>
      <circle cx="90" cy="170" r="44" fill="url(#rg)" opacity=".9"/>
      <rect x="160" y="150" width="220" height="18" rx="9" fill="#ECB03D" opacity=".6"/>
      <rect x="160" y="176" width="160" height="18" rx="9" fill="#4B8AB8" opacity=".5"/>
    </svg>
  )
}
