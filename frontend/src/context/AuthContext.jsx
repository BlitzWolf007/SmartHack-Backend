import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setAuthToken, getAuthToken, clearAuthToken } from '../lib/api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = getAuthToken()
    if (!token) { setLoading(false); return }

    api.verify(token)
      .then(u => setUser(u || null))
      .catch((e) => {
        // only clear token if actually unauthorized
        if (e?.status === 401 || e?.status === 403) {
          clearAuthToken()
          setUser(null)
        } else {
          // tolerate 404 / missing verify endpoint
          setUser(null)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const updateUser = async (newData) => {
    const updatedUser = await api.updateUser(newData)
    setUser(updatedUser)
    return updatedUser
  }

  const signIn = async (email, password) => {
    const res = await api.login(email, password)
    if (res?.access_token) {
      setAuthToken(res.access_token)
      const me = await api.verify(res.access_token).catch(() => null)
      setUser(me)
    }
    return res
  }

  const signOut = () => {
    clearAuthToken()
    setUser(null)
    navigate('/login', { replace: true }) // ✅ redirect on logout
  }

  const value = useMemo(() => ({
    user,
    loading,
    signIn,
    signOut,
    updateUser,
  }), [user, loading])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return useContext(AuthCtx)
}
