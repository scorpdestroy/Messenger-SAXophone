import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { request } from './api'
import type { User } from './api'
import { useAuth } from './auth'
import { Button, Card, Input } from './components/ui'

export function Protected({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (auth.loading) return <div className="page" role="status">Загружаем профиль…</div>
  if (auth.error) return <div className="page"><Card>
    <p role="alert">{auth.error}</p><Button onClick={auth.restore}>Повторить загрузку</Button>
  </Card></div>
  if (!auth.user) return <Navigate to="/login" replace />
  return children
}

export function AuthPage({ user, loading, onLogin, register = false }: {
  user: User | null; loading: boolean; onLogin: (identity: string, password: string) => Promise<void>; register?: boolean
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [values, setValues] = useState({ username: '', email: '', display_name: '', identity: '', password: '' })
  const [registered, setRegistered] = useState(false)
  if (user) return <Navigate to="/profile" replace />
  const field = (name: keyof typeof values) => ({
    value: values[name], onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues({ ...values, [name]: e.target.value })
      setErrors({ ...errors, [name]: '' })
    },
    error: errors[name], disabled: busy,
  })
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setRegistered(false)
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
  return <div className="page auth-page"><Card>
    <nav className="auth-tabs" aria-label="Доступ к аккаунту"><Link to="/login" aria-current={!register ? 'page' : undefined}>Вход</Link><Link to="/register" aria-current={register ? 'page' : undefined}>Регистрация</Link></nav>
    <h1>{register ? 'Регистрация' : 'Экран входа'}</h1>
    {!registered && <p className="card-intro">{register ? 'Создайте аккаунт, чтобы быть на связи.' : 'Рады видеть вас снова. Войдите, чтобы продолжить.'}</p>}
    {registered ? <><p role="status">Аккаунт создан. Войдите с вашим логином и паролем.</p><Link to="/login">Перейти ко входу</Link></> :
      <form noValidate onSubmit={submit} aria-busy={busy}>
        {register ? <>
          <Input id="username" label="Логин" autoComplete="username" autoCapitalize="none" spellCheck={false} {...field('username')} />
          <Input id="email" label="Электронная почта" type="email" autoComplete="email" {...field('email')} />
          <Input id="display-name" label="Отображаемое имя (необязательно)" autoComplete="name" {...field('display_name')} />
        </> : <Input id="identity" label="Логин или почта" autoComplete="username" {...field('identity')} />}
        <Input id="password" label="Пароль" type="password" autoComplete={register ? 'new-password' : 'current-password'} {...field('password')} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={busy || loading}>{busy ? 'Подождите…' : register ? 'Создать аккаунт' : 'Войти'}</Button>
      </form>}
    {!registered && <p className="auth-switch">{register ? 'Уже есть аккаунт?' : 'Нет аккаунта?'} <Link to={register ? '/login' : '/register'}>{register ? 'Войти' : 'Регистрация'}</Link></p>}
  </Card></div>
}
