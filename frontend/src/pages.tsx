import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { request } from './api'
import type { User } from './api'
import { Button, Card, Input } from './components'

type AuthPageProps = {
  register?: boolean
  user: User | null
  loading: boolean
  onLogin: (identity: string, password: string) => Promise<void>
}

export function AuthPage({ register = false, user, loading, onLogin }: AuthPageProps) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [values, setValues] = useState({ username: '', email: '', display_name: '', identity: '', password: '' })
  const [registered, setRegistered] = useState(false)
  if (user) return <Navigate to="/profile" replace />
  function change(name: keyof typeof values, value: string) {
    setValues({ ...values, [name]: value })
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setRegistered(false)
    // Проверки на клиенте помогают исправить ввод; сервер проверит данные ещё раз.
    const next: Record<string, string> = {}
    if (register) {
      if (!/^[a-zA-Z0-9_]{3,32}$/.test(values.username.trim())) next.username = 'От 3 до 32 латинских букв, цифр или _.'
      if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(values.email.trim()) || values.email.trim().length > 254) next.email = 'Введите корректную почту.'
      if (values.display_name.trim().length > 80) next.display_name = 'Не больше 80 символов.'
      if (values.password.length < 10 || values.password.length > 128) next.password = 'Пароль должен содержать от 10 до 128 символов.'
    } else {
      if (!values.identity.trim()) next.identity = 'Введите логин или почту.'
      if (!values.password || values.password.length > 128) next.password = 'Введите пароль (не больше 128 символов).'
    }
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      if (register) {
        await request('/auth/register', { method: 'POST', body: JSON.stringify({
          username: values.username, email: values.email, password: values.password, display_name: values.display_name,
        }) }, false)
        setValues({ username: '', email: '', display_name: '', identity: '', password: '' })
        setRegistered(true)
      } else {
        await onLogin(values.identity, values.password)
        setValues({ ...values, password: '' })
        navigate('/profile', { replace: true })
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выполнить запрос.') }
    finally { setBusy(false) }
  }
  return <div className="page"><Card>
    <h1>{register ? 'Регистрация' : 'Экран входа'}</h1>
    {registered ? <><p role="status">Аккаунт создан. Войдите с вашим логином и паролем.</p><Link to="/login">Перейти ко входу</Link></> :
      <form noValidate onSubmit={submit}>
        {register ? <>
          <Input id="username" label="Логин" autoComplete="username"
            value={values.username}
            onChange={event => change('username', event.target.value)}
            error={errors.username} disabled={busy}
          />
          <Input id="email" label="Электронная почта" type="email" autoComplete="email"
            value={values.email}
            onChange={event => change('email', event.target.value)}
            error={errors.email} disabled={busy}
          />
          <Input id="display-name" label="Отображаемое имя (необязательно)" autoComplete="name"
            value={values.display_name}
            onChange={event => change('display_name', event.target.value)}
            error={errors.display_name} disabled={busy}
          />
        </> : <Input id="identity" label="Логин или почта" autoComplete="username"
            value={values.identity}
            onChange={event => change('identity', event.target.value)}
            error={errors.identity} disabled={busy}
          />}
        <Input id="password" label="Пароль" type="password" autoComplete={register ? 'new-password' : 'current-password'}
            value={values.password}
            onChange={event => change('password', event.target.value)}
            error={errors.password} disabled={busy}
          />
        {error && <p role="alert">{error}</p>}
        <Button type="submit" disabled={busy || loading}>{busy ? 'Подождите…' : register ? 'Создать аккаунт' : 'Войти'}</Button>
      </form>}
    <p>{register ? 'Уже есть аккаунт?' : 'Нет аккаунта?'} <Link to={register ? '/login' : '/register'}>{register ? 'Войти' : 'Регистрация'}</Link></p>
  </Card></div>
}

export function ProfilePage({ user }: { user: User | null }) {
  return <div className="page profile-page"><Card>
    <h1>Ваш профиль</h1>
    <div className="avatar-placeholder" aria-hidden="true" />
    <dl id="profile-data" className="profile-data">
      <dt>Имя</dt><dd>{user?.display_name}</dd>
      <dt>Логин</dt><dd>{user?.username}</dd>
      <dt>Электронная почта</dt><dd>{user?.email}</dd>
    </dl>
    <Link to="/dialogs">К диалогам</Link>
  </Card></div>
}

// Ниже только оболочки экранов: API переписки и отправка сообщений не подключены.
export function EmptyChat() {
  return <div className="empty-chat">
    <h1>Окно переписки</h1>
    <p>Нет выбранного диалога.</p>
    <p>Здесь появятся ваши сообщения в следующем спринте.</p>
    <Link to="/profile">Ваш профиль</Link>
  </div>
}

export function ChatPage() {
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
