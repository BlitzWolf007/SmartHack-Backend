import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login(){
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')
  const nav = useNavigate()
  const { signIn } = useAuth()

  async function onSubmit(e){
    e.preventDefault()
    setLoading(true); setError('')
    try{
      await signIn(email, password)
      nav('/dashboard')
    }catch(err){
      setError(err.message || 'Login failed')
    }finally{
      setLoading(false)
    }
  }

  return (
    <section className="container" style={{minHeight:'calc(100dvh - 64px)'}}>
      <div className="grid cols-2" style={{alignItems:'center'}}>
        <div>
          <h2 style={{fontSize:32,margin:'6px 0'}}>Welcome back</h2>
          <p className="helper">Sign in to book desks and rooms faster than ever.</p>
          <div className="mt-4 card">
            <form onSubmit={onSubmit}>
              <div className="form-row">
                <label className="label" htmlFor="email">Email</label>
                <input id="email" className="input" type="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} required />
              </div>
              <div className="form-row">
                <label className="label" htmlFor="password">Password</label>
                <input id="password" className="input" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
              </div>
              {error && <div className="badge yellow" role="alert">{error}</div>}
              <div className="form-actions">
                <button className="btn accent" disabled={loading}>{loading? 'Signing in…':'Sign in'}</button>
                <span className="helper">No account? <Link to="/register">Register</Link></span>
              </div>
            </form>
          </div>
        </div>
        <div className="center hidden-sm">
          <Illustration />
        </div>
      </div>
    </section>
  )
}

function Illustration(){
  return (
    <svg width="440" height="280" viewBox="0 0 440 280" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ECB03D"/><stop offset="100%" stopColor="#EB6F38"/>
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="420" height="260" rx="22" fill="#132243" stroke="rgba(231,236,245,.1)"/>
      <circle cx="90" cy="90" r="36" fill="url(#g1)" opacity="0.9"/>
      <rect x="150" y="70" width="220" height="20" rx="10" fill="#4B8AB8" opacity=".5"/>
      <rect x="150" y="100" width="180" height="20" rx="10" fill="#4B8AB8" opacity=".35"/>
      <rect x="30" y="150" width="380" height="90" rx="14" fill="#0f1c3a"/>
      <rect x="50" y="172" width="120" height="14" rx="7" fill="#4B8AB8"/>
      <rect x="50" y="194" width="80" height="14" rx="7" fill="#ECB03D"/>
    </svg>
  )
}
