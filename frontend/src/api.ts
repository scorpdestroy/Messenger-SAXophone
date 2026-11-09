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
  // заголовки, переданные вызывающим кодом, сохраняем и добавляем к ним свои
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = sessionStorage.getItem(tokenKey)
  if (authenticated && token) {
    headers.set('Authorization', 'Bearer ' + token)
  }

  let response: Response
  try {
    response = await fetch('/api' + path, { ...options, headers })
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    if (aborted) throw error
    throw new ApiError(0, 'Нет соединения с сервером. Попробуйте ещё раз.')
  }

  if (!response.ok) {
    // если пока шёл запрос пользователь вошёл заново, 401 относится к старому токену — новый не трогаем
    const sameToken = token !== null && sessionStorage.getItem(tokenKey) === token
    if (response.status === 401 && authenticated && sameToken) {
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
