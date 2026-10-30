import { useState } from 'react'
import { Icon } from './Icon'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`button ${props.className || ''}`} />
}

export function Input({ label, error, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const [visible, setVisible] = useState(false)
  const password = props.type === 'password'
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <div className="input-wrap">
      <input {...props} type={password && visible ? 'text' : props.type} className={password ? 'password-input' : undefined} id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
      {password && <button type="button" className="password-toggle" aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={visible} disabled={props.disabled} onClick={() => setVisible(current => !current)}><Icon name={visible ? 'hidden' : 'eye'} /></button>}
    </div>
    {error && <small id={`${id}-error`} role="alert">{error}</small>}
  </div>
}

export function Card({ children }: { children: ReactNode }) {
  return <section className="card">{children}</section>
}
