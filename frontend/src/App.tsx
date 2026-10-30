// Состояние пользователя и маршруты приложения.
// Экраны берём из pages.tsx (Александр), запросы — через request из api.ts.

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { ApiError, getHealth, request, tokenKey } from './api'
import type { User } from './api'
import { AuthPage } from './pages'
import { Button, Card } from './components'

type LoginResponse = { access_token: string; user: User }

function ServerStatus() {
  const [status, setStatus] = useState('Проверяем соединение…')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setStatus('Проверяем соединение…')
    getHealth()
      .then(() => setStatus('Сервер доступен'))
      .catch(() => setStatus('Нет соединения с сервером'))
  }, [attempt])

  return (
    <div>
      <span role="status">{status}</span>
      <button aria-label="Повторить проверку соединения" onClick={() => setAttempt(attempt + 1)}>↻</button>
    </div>
  )
}

// Временные экраны: в pages.tsx пока есть только AuthPage.
// Когда Александр добавит ProfilePage, EmptyChat и ChatPage, эти три функции удалить
// и импортировать его версии из './pages'.
function ProfileScreen({ user }: { user: User }) {
  return (
    <Card>
      <h2>Ваш профиль</h2>
      <p>Имя: {user.display_name}</p>
      <p>Логин: {user.username}</p>
      <p>Почта: {user.email}</p>
    </Card>
  )
}

function DialogsScreen() {
  return <Card><h2>Окно переписки</h2><p>Нет выбранного диалога.</p></Card>
}

function ChatScreen() {
  return <Card><h2>Переписка</h2><p>Сообщений пока нет.</p></Card>
}

export function App() {
  const [user, setUser] = useState<User | null>(null)
  // если токен уже есть, сначала загружаем профиль и только потом решаем, что показать
  const [loading, setLoading] = useState(sessionStorage.getItem(tokenKey) !== null)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  // после обновления страницы токен остаётся, а пользователя загружаем заново
  useEffect(() => {
    if (!sessionStorage.getItem(tokenKey)) return
    request<User>('/users/me')
      .then(currentUser => setUser(currentUser))
      .catch(e => {
        // при 401 request уже удалил токен — просто покажем вход
        if (!(e instanceof ApiError && e.status === 401)) {
          setError('Не удалось загрузить профиль. Проверьте соединение и повторите.')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // request сообщает, что сервер больше не принимает токен
  useEffect(() => {
    function onExpired() {
      setUser(null)
      setLoading(false)
    }
    window.addEventListener('auth-expired', onExpired)
    return () => window.removeEventListener('auth-expired', onExpired)
  }, [])

  async function login(identity: string, password: string) {
    const data = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identity, password }),
    }, false)
    sessionStorage.setItem(tokenKey, data.access_token)
    setUser(data.user)
    setError('')
  }

  async function logout() {
    setLoggingOut(true)
    try {
      await request('/auth/logout', { method: 'POST' })
    } finally {
      sessionStorage.removeItem(tokenKey)
      setUser(null)
      setLoggingOut(false)
    }
  }

  // экран входа: вошедшего пользователя сразу отправляем в профиль
  function loginPage() {
    if (user) return <Navigate to="/profile" replace />
    return <AuthPage onLogin={login} />
  }

  // это только выбор экрана; права на данные проверяет сервер
  function protect(page: (currentUser: User) => ReactNode) {
    if (loading) return <p role="status">Загружаем профиль…</p>
    if (error) return <Card><p role="alert">{error}</p></Card>
    if (!user) return <Navigate to="/login" replace />
    return page(user)
  }

  return (
    <div>
      <header>
        <Link to="/dialogs">SAXophone</Link>
        <ServerStatus />
        <nav>
          <NavLink to="/profile">Профиль</NavLink>
          {user
            ? <Button text={loggingOut ? 'Выходим…' : 'Выйти'} onClick={logout} disabled={loggingOut} />
            : <NavLink to="/login">Войти</NavLink>}
        </nav>
        {user && <p>Вы вошли как {user.display_name}</p>}
      </header>
      <main>
        <Routes>
          <Route path="/" element={loginPage()} />
          <Route path="/login" element={loginPage()} />
          <Route path="/register" element={<Card><h2>Регистрация</h2><p>Форма регистрации появится в pages.tsx.</p></Card>} />
          <Route path="/profile" element={protect(currentUser => <ProfileScreen user={currentUser} />)} />
          <Route path="/dialogs" element={protect(() => <DialogsScreen />)} />
          <Route path="/chat/:chatId" element={protect(() => <ChatScreen />)} />
          <Route path="*" element={<Card><h2>Страница не найдена</h2><Link to="/dialogs">К диалогам</Link></Card>} />
        </Routes>
      </main>
    </div>
  )
}
