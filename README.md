# Messenger SAXophone

Учебный веб-мессенджер на FastAPI, React и PostgreSQL.

## Текущее состояние

В текущем прототипе работают:

- регистрация, вход по логину или почте и выход с отзывом сессии;
- защищённый профиль и восстановление входа после обновления страницы;
- API поиска пользователей, миграции БД, Docker Compose и автоматические проверки.

Работающие диалоги, сообщения, интерфейс поиска и WebSocket в текущий прототип не входят.

## Запуск

Нужен Docker с Compose. При первом запуске из корня проекта:

```bash
cp .env.example .env
docker compose up --build --wait
```

В PowerShell вместо первой команды: `Copy-Item .env.example .env`.
Существующий `.env` сохраняйте; реальные ключи и пароли в Git не добавляйте.

- [Приложение](http://localhost:8080)
- [Документация API](http://localhost:8000/docs)
- Проверки backend: `/health` — процесс, `/ready` — подключение к БД.

Миграции применяются при старте backend. Порты настраиваются через `FRONTEND_PORT`,
`BACKEND_PORT` и `POSTGRES_PORT`. PostgreSQL хранит данные в именованном volume:
`docker compose down` сохраняет их, а `docker compose down -v` удаляет БД.

Для сохранения сессий после перезапуска задайте постоянный `AUTH_SECRET_KEY` в `.env`.
Случайный ключ можно получить командой `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
Без него development использует временный ключ процесса; production требует минимум 32 байта.

## Разработка и проверки

Стек: Python 3.12, FastAPI, SQLAlchemy, Alembic; React, TypeScript, Vite; PostgreSQL 16.

Backend-тесты находятся в `backend/tests`, тесты интерфейса — в `frontend/src`,
браузерные сценарии — в `frontend/e2e`. GitHub Actions проверяет код, миграции,
сборку, запуск контейнеров и полный сценарий регистрации/входа/выхода.
[Локальная разработка и тесты](docs/development.md); [контракт API и demo seed](docs/auth-contract.md).

Рабочие ветки объединяются через PR в `develop`; релиз проходит через `release/*` в `main`.
Перед слиянием нужны review другого участника и успешные проверки.
Автоматическое развёртывание на внешнем сервере пока не настроено.

## Документация

- [Архитектура](docs/architecture.md), [простая карта файлов](docs/structure.md), [макеты](docs/mockups)
- [Контракт авторизации и сценарии](docs/auth-contract.md)
- [Модель данных и план поиска сообщений](docs/data-and-search.md)
- [Проверки](docs/testing.md), [правила Git](docs/git-workflow.md), [команда](docs/team.md)
- Исторические отчёты: [спринт 1](docs/sprint-1.md), [спринт 2](docs/sprint-2.md)

Лицензия: [GNU GPL v3](LICENSE).
