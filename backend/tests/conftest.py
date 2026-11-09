import secrets

import pytest


def pytest_configure(config: pytest.Config) -> None:
    # Настройки приложения читаются уже при импорте тестовых модулей
    env = pytest.MonkeyPatch()
    env.setenv("AUTH_SECRET_KEY", secrets.token_hex(32))
    config.add_cleanup(env.undo)
