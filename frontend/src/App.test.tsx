// Тесты сессии и маршрутов (4Е). fetch подменяется, сервер не нужен.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { tokenKey } from './api'

const user = { id: 'user-id', username: 'alice', email: 'alice@example.test', display_name: 'Алиса' }
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })

// Ответы сервера по пути запроса. /api/health всегда отвечает «ok».
function mockApi(handler: (path: string) => unknown) {
  const fetch = vi.fn((path: string, options?: { headers?: Record<string, string> }) => {
    void options
    if (path === '/api/health') return Promise.resolve(reply({ status: 'ok' }))
    return Promise.resolve(handler(path))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)

afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals() })

describe('сессия и маршруты', () => {
  it('гостя с профиля переводит на вход и не запрашивает профиль', async () => {
    const fetch = mockApi(() => reply({}, 401))
    renderAt('/profile')
    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument()
    expect(fetch.mock.calls.some(([path]) => path === '/api/users/me')).toBe(false)
  })

  it('после обновления страницы восстанавливает пользователя по токену', async () => {
    sessionStorage.setItem(tokenKey, 'saved-token')
    const fetch = mockApi(path => path === '/api/users/me' ? reply(user) : reply({}, 404))
    renderAt('/profile')
    expect(screen.getByText('Загружаем профиль…')).toBeInTheDocument()
    expect(await screen.findByText('Логин: alice')).toBeInTheDocument()
    const call = fetch.mock.calls.find(([path]) => path === '/api/users/me')!
    expect(call[1]?.headers?.['Authorization']).toBe('Bearer saved-token')
  })

  it('недействительный токен удаляет и показывает вход', async () => {
    sessionStorage.setItem(tokenKey, 'old-token')
    mockApi(() => reply({}, 401))
    renderAt('/profile')
    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument()
    expect(sessionStorage.getItem(tokenKey)).toBeNull()
  })

  it('при сетевой ошибке загрузки профиля показывает сообщение, а не вход', async () => {
    sessionStorage.setItem(tokenKey, 'saved-token')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    renderAt('/profile')
    expect(await screen.findByText(/Не удалось загрузить профиль/)).toBeInTheDocument()
  })

  it('входит, открывает профиль и выходит с удалением токена', async () => {
    mockApi(path => {
      if (path === '/api/auth/login') return reply({ access_token: 'new-token', user })
      if (path === '/api/auth/logout') return reply(null, 204)
      return reply({}, 404)
    })
    const { container } = renderAt('/login')
    const [loginInput, passwordInput] = container.querySelectorAll('input')
    fireEvent.change(loginInput, { target: { value: 'alice' } })
    fireEvent.change(passwordInput, { target: { value: 'secret-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(await screen.findByRole('heading', { name: 'Ваш профиль' })).toBeInTheDocument()
    expect(sessionStorage.getItem(tokenKey)).toBe('new-token')

    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }))
    await waitFor(() => expect(sessionStorage.getItem(tokenKey)).toBeNull())
    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument()
  })

  it('показывает страницу 404 для неизвестного адреса', () => {
    mockApi(() => reply({}, 404))
    renderAt('/no-such-page')
    expect(screen.getByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument()
  })
})
