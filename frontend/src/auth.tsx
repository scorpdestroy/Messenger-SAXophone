import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError, request, tokenKey } from './api'
import type { User } from './api'

type AuthState = {
  user: User | null; loading: boolean; error: string
  restore: () => void; login: (identity: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!sessionStorage.getItem(tokenKey))
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const restore = useCallback(() => setAttempt(x => x + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    const token = sessionStorage.getItem(tokenKey)
    if (token) {
      setLoading(true); setError('')
      request<User>('/users/me', { signal: controller.signal })
        .then(data => { if (!controller.signal.aborted && token === sessionStorage.getItem(tokenKey)) setUser(data) })
        .catch((e: unknown) => {
          if (!controller.signal.aborted && !(e instanceof ApiError && e.status === 401)) {
            setError('Не удалось загрузить профиль. Проверьте соединение и повторите.')
          }
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    } else { setLoading(false) }
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    const expire = () => { setUser(null); setError(''); setLoading(false) }
    window.addEventListener('auth-expired', expire)
    return () => window.removeEventListener('auth-expired', expire)
  }, [])
  async function login(identity: string, password: string) {
    const data = await request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ identity, password }),
    }, false)
    sessionStorage.setItem(tokenKey, data.access_token)
    setUser(data.user); setError(''); setLoading(false)
  }
  async function logout() {
    if (sessionStorage.getItem(tokenKey)) {
      try { await request('/auth/logout', { method: 'POST' }) }
      catch (e) { if (!(e instanceof ApiError && e.status === 401)) throw e }
    }
    sessionStorage.removeItem(tokenKey); setUser(null); setError('')
  }
  return <AuthContext.Provider value={{ user, loading, error, restore, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('AuthProvider missing')
  return auth
}
