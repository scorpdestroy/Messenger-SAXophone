export async function getHealth(signal?: AbortSignal) {
  const response = await fetch('/api/health', { signal })
  if (!response.ok) throw new Error('Сервис недоступен')
  const data = await response.json()
  if (data.status !== 'ok') throw new Error('Неожиданный ответ сервера')
  return data as { status: string; service: string }
}

export type User = { id: string; username: string; email: string; display_name: string }
export const tokenKey = 'saxophone.access-token'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const token = authenticated ? sessionStorage.getItem(tokenKey) : null
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...options, headers })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Нет соединения с сервером. Попробуйте ещё раз.')
  }
  if (!response.ok) {
    // Запоздавший 401 от старого запроса не должен стереть новый токен после входа.
    if (response.status === 401 && token && token === sessionStorage.getItem(tokenKey)) {
      sessionStorage.removeItem(tokenKey)
      window.dispatchEvent(new Event('auth-expired'))
    }
    const messages: Record<number, string> = {
      400: 'Проверьте заполнение полей.', 401: 'Неверный логин или пароль.',
      409: 'Этот логин или почта уже зарегистрированы.',
    }
    throw new ApiError(response.status, messages[response.status] || 'Ошибка сервера. Попробуйте ещё раз.')
  }
  // У успешного logout нет тела: response.json() здесь дал бы ошибку.
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
