import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, setAuthToken, getAuthToken, clearAuthToken } from '../lib/api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) { setLoading(false); return }
    api.verify(token)
      .then(u => setUser(u || null))
      .catch(() => clearAuthToken())
      .finally(() => setLoading(false))
  }, [])

  const updateUser = async (newData) => {
    const updatedUser = await api.updateUser(newData)
    setUser(updatedUser)
    return updatedUser
  }

  const value = useMemo(() => ({
    user,
    loading,
    signIn: async (email, password) => {
      const res = await api.login(email, password)
      if (res?.access_token) {
        setAuthToken(res.access_token)
        const me = await api.verify(res.access_token).catch(() => null)
        setUser(me)
      }
      return res
    },
    signOut: () => {
      clearAuthToken()
      setUser(null)
    },
    updateUser,
  }), [user])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return useContext(AuthCtx)
}
