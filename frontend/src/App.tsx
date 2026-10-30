import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { getHealth } from './api'
import { AuthProvider, useAuth } from './auth'
import { AuthPage, Protected } from './AuthPages'
import { ProfilePage } from './ProfilePage'
import { Button, Card } from './components/ui'

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

function EmptyChat() {
  return <div className="empty-chat">
    <h1>Окно переписки</h1>
    <p>Нет выбранного диалога.</p>
    <p>Здесь появятся ваши сообщения в следующем спринте.</p>
    <Link to="/profile">Ваш профиль</Link>
  </div>
}

function ChatPage() {
  return <div className="chat-page">
    <h1>Переписка</h1>
    <div className="message-area"><p>Сообщений пока нет.</p></div>
    <div className="message-input">
      <label htmlFor="message">Сообщение</label>
      <textarea id="message" rows={3} placeholder="Написать сообщение" disabled />
      <Button disabled>Отправить</Button>
    </div>
  </div>
}

function AppShell() {
  const auth = useAuth()
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  async function logout() {
    setLoggingOut(true); setLogoutError('')
    try { await auth.logout() } catch { setLogoutError('Не удалось выйти. Проверьте соединение и повторите.') }
    finally { setLoggingOut(false) }
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
        : <div className="sidebar-empty"><p>Пока нет чатов</p><p>{auth.user ? `Вы вошли как ${auth.user.display_name}` : 'Войдите в аккаунт, чтобы начать общение.'}</p></div>}
      <div className="sidebar-footer">
        <NavLink to="/profile">⚙ Настройки и профиль</NavLink>
        {auth.user ? <Button onClick={logout} disabled={loggingOut}>{loggingOut ? 'Выходим…' : 'Выйти'}</Button> : <NavLink to="/login">Войти</NavLink>}
        {logoutError && <p role="alert">{logoutError}</p>}
      </div>
    </aside>
    <main>
      <header className="topbar"><span>Мессенджер</span><ServerStatus /></header>
      <Routes>
        <Route path="/" element={<AuthPage key="login" user={auth.user} loading={auth.loading} onLogin={auth.login} />} />
        <Route path="/dialogs" element={<Protected><EmptyChat /></Protected>} />
        <Route path="/chat/:chatId" element={<Protected><ChatPage /></Protected>} />
        <Route path="/login" element={<AuthPage key="login" user={auth.user} loading={auth.loading} onLogin={auth.login} />} />
        <Route path="/register" element={<AuthPage key="register" user={auth.user} loading={auth.loading} onLogin={auth.login} register />} />
        <Route path="/profile" element={<Protected>{auth.user && <ProfilePage user={auth.user} />}</Protected>} />
        <Route path="*" element={<div className="page"><Card><h1>Страница не найдена</h1><Link to="/dialogs">К диалогам</Link></Card></div>} />
      </Routes>
    </main>
  </div>
}

export function App() {
  return <AuthProvider><AppShell /></AuthProvider>
}
