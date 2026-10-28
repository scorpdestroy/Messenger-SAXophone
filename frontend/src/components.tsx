import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`button ${props.className || ''}`} />
}

export function Input({ label, error, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return <label className="field" htmlFor={id}>
    <span>{label}</span>
    <input {...props} id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
    {error && <small id={`${id}-error`} role="alert">{error}</small>}
  </label>
}

export function Card({ children }: { children: ReactNode }) {
  return <section className="card">{children}</section>
}
