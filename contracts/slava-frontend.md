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
Отмена запроса (AbortError) пробрасывается как есть, не как ошибка сети.

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

Тесты: frontend/src/api.test.tsx — 200, 204, 401, 409, сеть, отмена, вход без токена.

Инструменты frontend (package.json, package-lock.json, tsconfig.json,
vite.config.ts, eslint.config.js, src/test-setup.ts) взяты без изменений
из эталонного прототипа, чтобы запускать тесты.

В эту задачу не входят:
состояние сессии, вход/выход и маршруты — это 4Е (App.tsx);
защита от запоздалого 401 и повтор загрузки профиля — это 5В.

Контракт Славы. 4Е. Сессия и маршруты.

Файлы:
frontend/src/App.tsx — состояние пользователя, вход/выход, маршруты.
frontend/src/main.tsx и frontend/index.html — точка входа приложения.

Состояние в App:
user — текущий пользователь или null.
loading — true, пока загружается профиль по сохранённому токену.
error — текст ошибки загрузки профиля.

Восстановление после обновления страницы:
если в sessionStorage есть токен — GET /users/me.
200 — user заполняется.
401 — request удаляет токен, показывается вход.
сеть или 5xx — сообщение «Не удалось загрузить профиль…».

login(identity, password) → Promise<void>:
POST /auth/login без токена.
Успех — токен в sessionStorage, user из ответа.
Ошибка — ApiError пробрасывается в форму (message с понятным текстом).

logout():
POST /auth/logout с токеном, затем токен удаляется и user = null.

Маршруты:
/ и /login — AuthPage. Если пользователь уже вошёл — переход на /profile.
После успешного входа App сам переводит на /profile.
/register — временный экран, пока в pages.tsx нет регистрации.
/profile, /dialogs, /chat/:chatId — только для вошедшего.
Гость → /login. Пока loading — «Загружаем профиль…».
Остальные адреса — «Страница не найдена».
Защита маршрута — только выбор экрана; права на данные проверяет сервер.

Что App использует из pages.tsx (Александр):
AuthPage({ onLogin }) — onLogin: (identity, password) => Promise<void>.

Что App использует из components.tsx (Александр):
Button({ text, onClick, disabled }), Card({ children }).

Временные экраны в App.tsx:
ProfileScreen, DialogsScreen, ChatScreen и экран регистрации.
Когда в pages.tsx появятся ProfilePage({ user }), EmptyChat, ChatPage
и регистрация, временные экраны удаляются, App импортирует их из pages.tsx.

Что нужно от Александра (pages.tsx, components.tsx):
ProfilePage({ user }), EmptyChat, ChatPage и регистрация.
В AuthPage показывать err.message, а не всегда «Неверный логин или пароль»:
иначе при отключённом сервере пользователь видит неверный текст.
Типы props: без них не проходит npm run build (tsc).
Неиспользуемая переменная err в pages.tsx — ошибка npm run lint.

Проверка из каталога frontend:
npm test
npm run lint
npm run build

Тесты: frontend/src/App.test.tsx — гость, восстановление сессии,
недействительный токен, сетевая ошибка профиля, вход и выход, 404.

В эту задачу не входят (5В):
отмена загрузки профиля, повтор загрузки, защита от устаревшего ответа,
сетевая ошибка logout сейчас всё равно завершает выход на клиенте.
