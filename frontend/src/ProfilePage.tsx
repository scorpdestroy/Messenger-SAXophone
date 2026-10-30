import { Link } from 'react-router-dom'
import type { User } from './api'
import { Card } from './components/ui'

export function ProfilePage({ user }: { user: User }) {
  return <div className="page profile-page"><Card>
    <div className="card-eyebrow"><span className="brand-mark" aria-hidden="true">S</span> SAXOPHONE / АККАУНТ</div>
    <h1>Ваш профиль</h1>
    <p className="card-intro">Ваши данные в SAXophone.</p>
    <div className="profile-identity"><div className="avatar-placeholder" aria-hidden="true">{user.display_name.trim().charAt(0).toUpperCase()}</div><div><strong>Ваш аккаунт</strong><span>Данные профиля</span></div></div>
    <dl id="profile-data" className="profile-data">
      <dt>Имя</dt><dd>{user.display_name}</dd>
      <dt>Логин</dt><dd>{user.username}</dd>
      <dt>Электронная почта</dt><dd>{user.email}</dd>
    </dl>
    <Link to="/dialogs">К диалогам</Link>
  </Card></div>
}
