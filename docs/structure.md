# Простая карта кода

После S5-13 backend/app содержит 9 Python-файлов вместо 18; frontend/src — 7 файлов TypeScript
вместо 9, включая тест и его настройку. Папки пустых будущих Python-модулей удалены.
Функции, API, таблицы, проверки паролей/сессий, CSS и экранные сценарии сохранены.

## С чего начать чтение

1. `backend/app/main.py`: создание приложения, router, ошибки, /health и /ready.
2. `backend/app/auth.py`: входной HTTP-запрос, текущая сессия, register/login/logout/me/search.
3. `backend/app/users.py`: правила пользовательских данных, запросы и создание аккаунта.
4. `backend/app/models.py` и `db.py`: таблицы и сессия БД.
5. `backend/app/security.py`: hash и JWT; параметры защиты не упрощались.
6. `frontend/src/App.tsx`: обычные useState, восстановление пользователя, login/logout и маршруты.
7. `frontend/src/pages.tsx`: формы, профиль и сохранённые оболочки чата; данные приходят через props.
8. `frontend/src/api.ts` и `components.tsx`: HTTP-запрос и три общих UI-компонента.

## Куда переехали старые файлы

| Было | Стало |
|---|---|
| app/auth/routes.py | app/auth.py |
| app/auth/dependencies.py | app/auth.py |
| app/users/routes.py | app/auth.py |
| app/auth/security.py | app/security.py |
| app/users/schemas.py | app/users.py |
| app/users/repository.py | app/users.py |
| app/users/service.py | app/users.py |
| src/auth.tsx (Context + useAuth) | обычное состояние и функции в src/App.tsx |
| src/AuthPages.tsx | AuthPage в src/pages.tsx, проверка protect в App.tsx |
| src/ProfilePage.tsx | ProfilePage в src/pages.tsx |
| src/components/ui.tsx | src/components.tsx |
| пустые app/chats, app/messages, app/search | удалены; таблицы в модели/миграциях сохранены |

Отдельных слоёв repository/service и собственного useAuth-хука больше нет. При создании
пользователя create_user вызывает функции в том же users.py; промежуточные импорты не нужны.
Криптографические функции оставлены отдельно, чтобы их можно было прочитать и проверить целиком.

## Один путь backend

`POST /auth/register` → RegisterRequest в users.py → register в auth.py → create_user в users.py
→ hash_password в security.py → User/commit. Ошибки и разрешённый ответ не изменились.

## Один путь frontend

AuthPage в pages.tsx вызывает переданный onLogin. Функция login в App.tsx отправляет запрос,
сохраняет токен и пользователя. App выбирает страницу через protect. ProfilePage получает user
как prop и показывает имя/логин/почту. Отдельного Provider между App и страницами нет.

## Что не удаляли

Таблицы chats/chat_members/messages нужны для совместимости существующих миграций и тестов.
Их наличие всё ещё не означает работающую переписку. Оболочки экранов сохранены для совпадения
внешнего вида. Удаление таблиц, изменение функционала или внешнего вида в S5-13 не входит.

[Архитектура](architecture.md) · [Контракт API](auth-contract.md) · [Разработка и тесты](development.md).
