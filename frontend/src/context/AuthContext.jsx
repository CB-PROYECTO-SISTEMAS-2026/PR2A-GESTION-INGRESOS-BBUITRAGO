import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth.api'
import { getMe } from '../api/users.api'

const AuthContext = createContext(null)

const TOKEN_KEY = 'eventix_token'
const USER_KEY = 'eventix_user'

function normalizeUser(payload) {
  if (!payload) return null
  const user = payload.user ?? payload
  const fromArray = user.roles?.map((r) => (typeof r === 'string' ? r : r.role))
  const roles = fromArray?.length ? fromArray : user.role ? [user.role] : []
  return {
    ...user,
    roles: roles.filter(Boolean),
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  const persist = useCallback((token, nextUser) => {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    if (nextUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
      setUser(nextUser)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setUser(null)
      return null
    }
    try {
      const { data } = await getMe()
      const next = normalizeUser(data)
      localStorage.setItem(USER_KEY, JSON.stringify(next))
      setUser(next)
      return next
    } catch {
      logout()
      return null
    }
  }, [logout])

  useEffect(() => {
    const boot = async () => {
      const token = localStorage.getItem(TOKEN_KEY)
      if (!token) {
        setLoading(false)
        return
      }
      await refreshUser()
      setLoading(false)
    }
    boot()
  }, [refreshUser])

  /** Guarda la sesión que devuelve la API (`{ accessToken, user }`). */
  const startSession = useCallback(
    (session) => {
      const nextUser = normalizeUser(session)
      if (session?.accessToken) persist(session.accessToken, nextUser)
      return nextUser
    },
    [persist],
  )

  const login = useCallback(
    async (credentials) => {
      const { data } = await authApi.login(credentials)
      return startSession(data)
    },
    [startSession],
  )

  const register = useCallback(
    async (payload) => {
      const { data } = await authApi.register(payload)
      return startSession(data)
    },
    [startSession],
  )

  const hasRole = useCallback(
    (...roles) => {
      if (!user?.roles?.length) return false
      return roles.some((r) => user.roles.includes(r))
    },
    [user],
  )

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      startSession,
      logout,
      refreshUser,
      hasRole,
      isAuthenticated: Boolean(user),
      roles: user?.roles ?? [],
    }),
    [user, loading, login, register, startSession, logout, refreshUser, hasRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
