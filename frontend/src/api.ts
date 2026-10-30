// Все запросы к серверу идут через этот файл.

export type User = { id: string; username: string; email: string; display_name: string }

export const tokenKey = 'saxophone.access-token'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body) {
    headers['Content-Type'] = 'application/json'
  }
  const token = sessionStorage.getItem(tokenKey)
  if (authenticated && token) {
    headers['Authorization'] = 'Bearer ' + token
  }

  let response: Response
  try {
    response = await fetch('/api' + path, { ...options, headers })
  } catch {
    throw new ApiError(0, 'Нет соединения с сервером. Попробуйте ещё раз.')
  }

  if (!response.ok) {
    if (response.status === 401 && authenticated && token) {
      // токен больше не действует
      sessionStorage.removeItem(tokenKey)
      window.dispatchEvent(new Event('auth-expired'))
    }
    if (response.status === 400) {
      throw new ApiError(400, 'Проверьте заполнение полей.')
    } else if (response.status === 401) {
      throw new ApiError(401, 'Неверный логин или пароль.')
    } else if (response.status === 409) {
      throw new ApiError(409, 'Этот логин или почта уже зарегистрированы.')
    } else {
      throw new ApiError(response.status, 'Ошибка сервера. Попробуйте ещё раз.')
    }
  }

  // у ответа 204 нет тела
  if (response.status === 204) {
    return undefined as T
  }
  return response.json()
}

export async function getHealth(signal?: AbortSignal) {
  const response = await fetch('/api/health', { signal })
  if (!response.ok) throw new Error('Сервис недоступен')
  const data = await response.json()
  if (data.status !== 'ok') throw new Error('Неожиданный ответ сервера')
  return data as { status: string; service: string }
}
