import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { tokenKey } from './api'

afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals() })

describe('каркас приложения', () => {
  it('показывает пустой список и реальный статус сервера', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }))
    render(<MemoryRouter><App /></MemoryRouter>)
    expect(screen.getByText('Пока нет чатов')).toBeInTheDocument()
    expect(await screen.findByText('Сервер доступен')).toBeInTheDocument()
  })
  it('показывает сетевую ошибку и не выдаёт заглушку за работающий вход', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Нет соединения'))
  })
})

const user = { id: 'user-id', username: 'alice', email: 'alice@example.test', display_name: 'Алиса' }
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })
const renderApp = (path = '/login') => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
function mockApi(handler?: (path: string, options?: RequestInit) => unknown) {
  const fetch = vi.fn((path: string, options?: RequestInit) => {
    if (path === '/api/health') return Promise.resolve(response({ status: 'ok' }))
    return Promise.resolve(handler?.(path, options) ?? response({}, 401))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('вход и защищённые страницы', () => {
  it('показывает загрузку до получения текущего пользователя', async () => {
    sessionStorage.setItem(tokenKey, 'saved-token')
    let finish: (value: ReturnType<typeof response>) => void = () => {}
    mockApi(() => new Promise(resolve => { finish = resolve }))
    renderApp('/profile')
    expect(screen.getByText('Загружаем профиль…')).toBeInTheDocument()
    finish(response(user))
    expect(await screen.findByText('Алиса')).toBeInTheDocument()
  })
  it('перенаправляет гостя с профиля на вход без запроса профиля', async () => {
    const fetch = mockApi()
    renderApp('/profile')
    expect(await screen.findByRole('heading', { name: 'Экран входа' })).toBeInTheDocument()
    expect(fetch.mock.calls.some(([path]) => path === '/api/users/me')).toBe(false)
  })
  it('восстанавливает сессию после refresh и отправляет Bearer', async () => {
    sessionStorage.setItem(tokenKey, 'saved-token')
    const fetch = mockApi(() => response(user))
    renderApp('/profile')
    expect(await screen.findByText('Алиса')).toBeInTheDocument()
    const call = fetch.mock.calls.find(([path]) => path === '/api/users/me')
    expect(new Headers(call?.[1]?.headers).get('Authorization')).toBe('Bearer saved-token')
  })
  it('удаляет просроченную сессию и не повторяет запрос бесконечно', async () => {
    sessionStorage.setItem(tokenKey, 'expired')
    const fetch = mockApi()
    renderApp('/profile')
    expect(await screen.findByRole('heading', { name: 'Экран входа' })).toBeInTheDocument()
    expect(sessionStorage.getItem(tokenKey)).toBeNull()
    expect(fetch.mock.calls.filter(([path]) => path === '/api/users/me')).toHaveLength(1)
  })
  it('показывает ошибку загрузки профиля и позволяет повторить запрос', async () => {
    sessionStorage.setItem(tokenKey, 'saved')
    let offline = true
    mockApi(() => offline ? Promise.reject(new Error('offline')) : response(user))
    renderApp('/profile')
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить профиль')
    offline = false
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }))
    expect(await screen.findByText('Алиса')).toBeInTheDocument()
  })
  it('входит, открывает профиль и выходит с удалением токена', async () => {
    mockApi(path => path === '/api/auth/login' ? response({ access_token: 'new-token', user }) : response(null, 204))
    renderApp()
    fireEvent.change(screen.getByLabelText('Логин или почта'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(await screen.findByRole('heading', { name: 'Ваш профиль' })).toBeInTheDocument()
    expect(sessionStorage.getItem(tokenKey)).toBe('new-token')
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(await screen.findByRole('heading', { name: 'Экран входа' })).toBeInTheDocument()
    expect(sessionStorage.getItem(tokenKey)).toBeNull()
  })
  it('показывает неверные данные и сетевую ошибку без потери полей', async () => {
    let offline = false
    mockApi(() => offline ? Promise.reject(new Error('offline')) : response({}, 401))
    renderApp()
    fireEvent.change(screen.getByLabelText('Логин или почта'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный логин или пароль')
    offline = true
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Нет соединения'))
    expect(screen.getByLabelText('Логин или почта')).toHaveValue('alice')
  })
})

describe('регистрация', () => {
  it('проверяет поля до запроса к API', async () => {
    const fetch = mockApi()
    renderApp('/register')
    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }))
    expect(screen.getAllByRole('alert')).toHaveLength(3)
    expect(fetch.mock.calls.some(([path]) => path === '/api/auth/register')).toBe(false)
  })
  it('регистрирует и предлагает вход без автоматической выдачи сессии', async () => {
    mockApi(() => response(user, 201))
    renderApp('/register')
    fireEvent.change(screen.getByLabelText('Логин'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('Электронная почта'), { target: { value: 'alice@example.test' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'Valid-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }))
    expect(await screen.findByText(/Аккаунт создан/)).toBeInTheDocument()
    expect(sessionStorage.getItem(tokenKey)).toBeNull()
  })
  it('показывает конфликт и блокирует повторную отправку во время запроса', async () => {
    let finish: (value: ReturnType<typeof response>) => void = () => {}
    const fetch = mockApi(() => new Promise(resolve => { finish = resolve }))
    renderApp('/register')
    fireEvent.change(screen.getByLabelText('Логин'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('Электронная почта'), { target: { value: 'alice@example.test' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'Valid-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }))
    expect(screen.getByRole('button', { name: 'Подождите…' })).toBeDisabled()
    expect(screen.getByLabelText('Логин')).toBeDisabled()
    finish(response({}, 409))
    expect(await screen.findByRole('alert')).toHaveTextContent('Этот логин или почта уже зарегистрированы')
    expect(screen.getByRole('button', { name: 'Создать аккаунт' })).toBeEnabled()
    expect(fetch.mock.calls.filter(([path]) => path === '/api/auth/register')).toHaveLength(1)
  })
})
