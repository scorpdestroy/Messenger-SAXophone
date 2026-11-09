// Запоздавшие ответы старой сессии не должны влиять на новую.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tokenKey } from './api'
import { AuthProvider, useAuth } from './auth'

const alice = { id: '1', username: 'alice', email: 'alice@example.test', display_name: 'Алиса' }
const bob = { id: '2', username: 'bob', email: 'bob@example.test', display_name: 'Боб' }
const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body })

function Probe() {
  const { user, error, login } = useAuth()
  return (
    <div>
      <p>Пользователь: {user ? user.display_name : 'нет'}</p>
      <p>Ошибка: {error || 'нет'}</p>
      <button onClick={() => login('bob', 'password')}>Войти</button>
    </div>
  )
}

// Профиль по старому токену «висит», пока тест сам не ответит; вход отвечает сразу.
function startWithSlowProfile() {
  sessionStorage.setItem(tokenKey, 'old-token')
  let answerProfile: (value: unknown) => void = () => {}
  let failProfile: (reason: unknown) => void = () => {}
  vi.stubGlobal('fetch', vi.fn((path: string) => {
    if (path === '/api/auth/login') return Promise.resolve(reply(200, { access_token: 'new-token', user: bob }))
    return new Promise((resolve, reject) => { answerProfile = resolve; failProfile = reject })
  }))
  render(<AuthProvider><Probe /></AuthProvider>)
  return { answerProfile: (v: unknown) => answerProfile(v), failProfile: (e: unknown) => failProfile(e) }
}

async function loginAsBob() {
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
  expect(await screen.findByText('Пользователь: Боб')).toBeInTheDocument()
}

afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals() })

describe('запоздавшие ответы старой сессии', () => {
  it('старый ответ профиля не возвращает прежнего пользователя', async () => {
    const slow = startWithSlowProfile()
    await loginAsBob()
    await act(async () => slow.answerProfile(reply(200, alice)))
    expect(screen.getByText('Пользователь: Боб')).toBeInTheDocument()
  })

  it('запоздавший 401 старого токена не выходит из новой сессии', async () => {
    const slow = startWithSlowProfile()
    await loginAsBob()
    await act(async () => slow.answerProfile(reply(401, { error: { code: 'unauthorized', message: 'x' } })))
    expect(screen.getByText('Пользователь: Боб')).toBeInTheDocument()
    expect(sessionStorage.getItem(tokenKey)).toBe('new-token')
  })

  it('сетевая ошибка старого запроса не показывается в новой сессии', async () => {
    const slow = startWithSlowProfile()
    await loginAsBob()
    await act(async () => slow.failProfile(new TypeError('Failed to fetch')))
    expect(screen.getByText('Ошибка: нет')).toBeInTheDocument()
  })
})
