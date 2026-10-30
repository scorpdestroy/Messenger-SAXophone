// Тесты HTTP-клиента отдельно от экранов: fetch подменяется, сервер не нужен.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request, tokenKey } from './api'

const user = { id: 'user-id', username: 'alice', email: 'alice@example.test', display_name: 'Алиса' }
const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body })

function mockFetch(result: unknown) {
  const fetch = vi.fn().mockResolvedValue(result)
  vi.stubGlobal('fetch', fetch)
  return fetch
}

// Ловим ошибку, чтобы проверить её код и текст.
async function errorOf(promise: Promise<unknown>) {
  try { await promise } catch (e) { return e as ApiError }
  throw new Error('Ожидалась ошибка, но запрос завершился успешно')
}

afterEach(() => { sessionStorage.clear(); vi.unstubAllGlobals() })

describe('request', () => {
  it('возвращает JSON успешного ответа и добавляет Bearer и Content-Type', async () => {
    sessionStorage.setItem(tokenKey, 'token-1')
    const fetch = mockFetch(reply(200, user))
    const data = await request('/users/me', { method: 'POST', body: '{}' })
    expect(data).toEqual(user)
    const [path, options] = fetch.mock.calls[0]
    expect(path).toBe('/api/users/me')
    expect(options.headers['Authorization']).toBe('Bearer token-1')
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  it('не отправляет токен для входа и регистрации', async () => {
    sessionStorage.setItem(tokenKey, 'token-1')
    const fetch = mockFetch(reply(201, user))
    await request('/auth/register', { method: 'POST', body: '{}' }, false)
    expect(fetch.mock.calls[0][1].headers['Authorization']).toBeUndefined()
  })

  it('для 204 возвращает undefined и не читает тело', async () => {
    sessionStorage.setItem(tokenKey, 'token-1')
    const json = vi.fn()
    mockFetch({ ok: true, status: 204, json })
    expect(await request('/auth/logout', { method: 'POST' })).toBeUndefined()
    expect(json).not.toHaveBeenCalled()
  })

  it('при 401 бросает ошибку, удаляет токен и сообщает об окончании сессии', async () => {
    sessionStorage.setItem(tokenKey, 'token-1')
    mockFetch(reply(401, { error: { code: 'unauthorized', message: 'x' } }))
    const expired = vi.fn()
    window.addEventListener('auth-expired', expired)
    const error = await errorOf(request('/users/me'))
    window.removeEventListener('auth-expired', expired)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(sessionStorage.getItem(tokenKey)).toBeNull()
    expect(expired).toHaveBeenCalledOnce()
  })

  it('при 409 бросает ошибку с понятным текстом и не возвращает пользователя', async () => {
    mockFetch(reply(409, { error: { code: 'conflict', message: 'x' } }))
    const error = await errorOf(request('/auth/register', { method: 'POST', body: '{}' }, false))
    expect(error.status).toBe(409)
    expect(error.message).toBe('Этот логин или почта уже зарегистрированы.')
  })

  it('при обрыве сети бросает ApiError с кодом 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const error = await errorOf(request('/users/me'))
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.message).toBe('Нет соединения с сервером. Попробуйте ещё раз.')
  })
})
