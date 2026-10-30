Контракт Славы. 4Д. HTTP-клиент.

Файл:
frontend/src/api.ts

Все запросы интерфейса к серверу идут через request.
Адрес в браузере начинается с /api.
Proxy Вадима убирает этот префикс: /api/auth/login → /auth/login.

request<T>(path, options, authenticated) → Promise<T>
path — серверный путь без /api, например '/users/me'.
options — обычные параметры fetch: method, body, signal.
authenticated — по умолчанию true. Для регистрации и входа передать false.

Что делает request:
Если есть body — ставит Content-Type: application/json.
Если authenticated и есть токен — ставит Authorization: Bearer <токен>.
Успешный ответ — возвращает JSON.
Ответ 204 — возвращает undefined, тело не читает.
Ошибка — бросает ApiError. Фиктивный пользователь не возвращается.

ApiError:
status — HTTP-код ответа; 0, если ответа не было (нет сети).
message — текст для пользователя:
400 — «Проверьте заполнение полей.»
401 — «Неверный логин или пароль.»
409 — «Этот логин или почта уже зарегистрированы.»
0 — «Нет соединения с сервером. Попробуйте ещё раз.»
остальные — «Ошибка сервера. Попробуйте ещё раз.»

Ответ 401 на запрос с токеном:
токен удаляется из sessionStorage;
отправляется событие окна 'auth-expired', App сбрасывает пользователя.

Токен:
хранится в sessionStorage под ключом tokenKey = 'saxophone.access-token'.
Сохраняет токен функция входа в App.tsx (задача 4Е), не request.

Тип User:
id, username, email, display_name — как UserPublic в контракте API.

getHealth(signal):
GET /api/health, ожидает {"status":"ok"}. Используется индикатором в шапке.

Проверка из каталога frontend:
npm ci
npm test
npm run lint

Тесты: frontend/src/api.test.tsx — 200, 204, 401, 409, сеть, вход без токена.

Инструменты frontend (package.json, package-lock.json, tsconfig.json,
vite.config.ts, eslint.config.js, src/test-setup.ts) взяты без изменений
из эталонного прототипа, чтобы запускать тесты.

В эту задачу не входят:
состояние сессии, вход/выход и маршруты — это 4Е (App.tsx);
защита от запоздалого 401 и отмена запроса — это 5В;
сборка npm run build — заработает, когда появятся index.html и main.tsx.
