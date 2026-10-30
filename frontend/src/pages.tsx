import { useState } from 'react';
import { Button, Input, Card } from './components';

export function AuthPage({ onLogin }) {
  // Создаю состояния для полей ввода. 
  // Сюда React будет записывать то, что пользователь печатает в инпутах.
  // А также состояния для текста ошибки и индикатора загрузки.
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Функция, которая срабатывает при нажатии на кнопку "Войти" или Enter.
  // Здесь я сначала очищаю старые ошибки, включаю загрузку, 
  // а потом проверяю, не пустые ли поля.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Проверяю, что пользователь ввел хоть какие-то данные.
    // Если хотя бы одно поле пустое, то сразу вывожу ошибку и выключаю загрузку,
    // чтобы не отправлять пустой запрос на сервер.
    if (login === '' || password === '') {
      setError('Заполните все поля');
      setLoading(false);
      return;
    }

    // Отправляю данные на сервер через функцию onLogin, которую передали сверху.
    // Если сервер ответит ошибкой, то сработает блок catch, и я покажу красный текст.
    // В любом случае, после завершения запроса выключаю загрузку в блоке finally.
    try {
      await onLogin(login, password); 
    } catch (err) {
      setError('Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  // Вся верстка формы обернута в компонент Card (мою белую карточку по центру).
  // Внутри формы использую мои же компоненты Input и Button.
  return (
    <Card>
      <h2>Вход</h2>
      <form onSubmit={handleSubmit}>
        {/* Поле для ввода логина. Связываю его со стейтом login, чтобы React знал, что там написано. */}
        <Input 
          label="Логин" 
          value={login} 
          onChange={(e) => setLogin(e.target.value)} 
        />
        {/* Поле для пароля. Тип password скрывает символы точками. Привязано к стейту password. */}
        <Input 
          label="Пароль" 
          type="password"
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
        />
        
        {/* Если в стейте error есть текст, то показываю красный блок с ошибкой. */}
        {/* Стили пишу прямо в теге, чтобы не подключать отдельный CSS-файл. */}
        {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
        
        {/* Кнопка "Войти". Если идет загрузка, она меняет текст и становится неактивной. */}
        <Button 
          text={loading ? 'Загрузка...' : 'Войти'} 
          disabled={loading} 
        />
      </form>
    </Card>
  );
}
