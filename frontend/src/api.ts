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

export class BadRequestError extends ApiError {
  constructor() { super(400, 'Проверьте заполнение полей.') }
}

export class UnauthorizedError extends ApiError {
  constructor() { super(401, 'Неверный логин или пароль.') }
}

export class ConflictError extends ApiError {
  constructor() { super(409, 'Этот логин или почта уже зарегистрированы.') }
}

export class ServerError extends ApiError {
  constructor(status: number) { super(status, 'Ошибка сервера. Попробуйте ещё раз.') }
}

const errorByStatus: Record<number, new () => ApiError> = {
  400: BadRequestError,
  401: UnauthorizedError,
  409: ConflictError,
}

export type RequestOptions = RequestInit & { authenticated?: boolean }

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authenticated = true, ...init } = options
  // заголовки, переданные вызывающим кодом, сохраняем и добавляем к ним свои
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = sessionStorage.getItem(tokenKey)
  if (authenticated && token) {
    headers.set('Authorization', 'Bearer ' + token)
  }

  let response: Response
  try {
    response = await fetch('/api' + path, { ...init, headers })
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    if (aborted) throw error
    throw new ApiError(0, 'Нет соединения с сервером. Попробуйте ещё раз.')
  }

  if (!response.ok) {
    // если пока шёл запрос пользователь вошёл заново, 401 относится к старому токену — новый не трогаем
    const sameToken = token !== null && sessionStorage.getItem(tokenKey) === token
    const tokenExpired = response.status === 401 && authenticated && sameToken
    if (tokenExpired) {
      sessionStorage.removeItem(tokenKey)
      window.dispatchEvent(new Event('auth-expired'))
    }
    const KnownError = errorByStatus[response.status]
    throw KnownError ? new KnownError() : new ServerError(response.status)
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
