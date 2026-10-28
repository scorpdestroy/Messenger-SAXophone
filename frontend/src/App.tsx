import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ApiError, getHealth, request, tokenKey } from './api'
import type { User } from './api'
import { AuthPage, ChatPage, EmptyChat, ProfilePage } from './pages'
import { Button, Card } from './components'

function ServerStatus() {
  const [state, setState] = useState('Проверяем соединение…')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5000)
    setState('Проверяем соединение…')
    getHealth(controller.signal)
      .then(() => setState('Сервер доступен'))
      .catch(() => setState('Нет соединения с сервером'))
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [attempt])
  return <div className="server"><span role="status">{state}</span>
    <button aria-label="Повторить проверку соединения" onClick={() => setAttempt(x => x + 1)}>↻</button>
  </div>
}

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!sessionStorage.getItem(tokenKey))
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const token = sessionStorage.getItem(tokenKey)
    // После обновления страницы токен остаётся, а данные пользователя загружаем заново.
    async function loadUser() {
      if (!token) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const data = await request<User>('/users/me', { signal: controller.signal })
        // Старый ответ не должен вернуть пользователя после смены токена или ухода со страницы.
        if (!controller.signal.aborted && token === sessionStorage.getItem(tokenKey)) {
          setUser(data)
        }
      } catch (e) {
        if (!controller.signal.aborted && !(e instanceof ApiError && e.status === 401)) {
          setError('Не удалось загрузить профиль. Проверьте соединение и повторите.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    loadUser()
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
    setLoggingOut(true)
    setLogoutError('')
    try {
      if (sessionStorage.getItem(tokenKey)) {
        try {
          // Сначала отзываем сессию на сервере. При сетевой ошибке даём повторить выход.
          await request('/auth/logout', { method: 'POST' })
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 401)) throw e
        }
      }
      sessionStorage.removeItem(tokenKey)
      setUser(null)
      setError('')
    } catch {
      setLogoutError('Не удалось выйти. Проверьте соединение и повторите.')
    } finally {
      setLoggingOut(false)
    }
  }

  // Это выбор экрана для пользователя; права на данные всё равно проверяет сервер.
  function protect(children: ReactNode) {
    if (loading) return <div className="page" role="status">Загружаем профиль…</div>
    if (error) return <div className="page"><Card>
      <p role="alert">{error}</p><Button onClick={() => setAttempt(attempt + 1)}>Повторить загрузку</Button>
    </Card></div>
    if (!user) return <Navigate to="/login" replace />
    return children
  }
  const profile = useLocation().pathname === '/profile'
  return <div className="app-shell">
    <aside className="sidebar">
      <Link to="/dialogs" className="brand">SAXophone</Link>
      <div className="sidebar-title">
        {profile && <Link to="/dialogs" className="close-settings" aria-label="Закрыть настройки">×</Link>}
        <h2>{profile ? 'Настройки и профиль' : 'Чаты'}</h2>
      </div>
      {profile ? <nav className="settings-list"><a href="#profile-data">Данные аккаунта</a></nav>
        : <div className="sidebar-empty"><p>Пока нет чатов</p><p>{user ? `Вы вошли как ${user.display_name}` : 'Войдите в аккаунт, чтобы начать общение.'}</p></div>}
      <div className="sidebar-footer">
        <NavLink to="/profile">⚙ Настройки и профиль</NavLink>
        {user ? <Button onClick={logout} disabled={loggingOut}>{loggingOut ? 'Выходим…' : 'Выйти'}</Button> : <NavLink to="/login">Войти</NavLink>}
        {logoutError && <p role="alert">{logoutError}</p>}
      </div>
    </aside>
    <main>
      <header className="topbar"><span>Мессенджер</span><ServerStatus /></header>
      <Routes>
        <Route path="/" element={<AuthPage key="login" user={user} loading={loading} onLogin={login} />} />
        <Route path="/dialogs" element={protect(<EmptyChat />)} />
        <Route path="/chat/:chatId" element={protect(<ChatPage />)} />
        <Route path="/login" element={<AuthPage key="login" user={user} loading={loading} onLogin={login} />} />
        <Route path="/register" element={<AuthPage key="register" register user={user} loading={loading} onLogin={login} />} />
        <Route path="/profile" element={protect(<ProfilePage user={user} />)} />
        <Route path="*" element={<div className="page"><Card><h1>Страница не найдена</h1><Link to="/dialogs">К диалогам</Link></Card></div>} />
      </Routes>
    </main>
  </div>
}
