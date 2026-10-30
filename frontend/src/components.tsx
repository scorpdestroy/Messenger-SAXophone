import React from 'react';

// Мелкая правка: добавил интерфейс ButtonProps, чтобы TypeScript понимал, какие данные принимает кнопка.
interface ButtonProps {
  text: string;
  onClick?: () => void;
  disabled?: boolean;
}

// Кнопка. Сделал пропс disabled, чтобы нельзя было нажать дважды при отправке формы.
export const Button: React.FC<ButtonProps> = ({ text, onClick, disabled = false }) => (
  <button 
    onClick={onClick} 
    disabled={disabled}
    style={{ padding: '10px', margin: '5px', cursor: disabled ? 'not-allowed' : 'pointer' }}
  >
    {text}
  </button>
);

// Мелкая правка: добавил интерфейс InputProps для типизации пропсов поля ввода.
interface InputProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  type?: string;
}

// Поле ввода. Добавил пропс error, чтобы подсвечивать красным, если пользователь ошибся.
export const Input: React.FC<InputProps> = ({ label, value, onChange, error, type = 'text' }) => (
  <div style={{ marginBottom: '10px' }}>
    <label style={{ display: 'block' }}>{label}</label>
    <input 
      type={type}
      value={value} 
      onChange={onChange} 
      style={{ border: error ? '1px solid red' : '1px solid #ccc', padding: '5px' }}
    />
    {error && <div style={{ color: 'red', fontSize: '12px' }}>{error}</div>}
  </div>
);

// Мелкая правка: добавил интерфейс CardProps, чтобы указать, что карточка принимает внутри себя другие элементы (children).
interface CardProps {
  children: React.ReactNode;
}

// Карточка. Просто обертка, чтобы форма по центру была. Захардкодил ширину 300px.
export const Card: React.FC<CardProps> = ({ children }) => (
  <div style={{ border: '1px solid #ccc', padding: '20px', width: '300px', margin: '50px auto' }}>
    {children}
  </div>
);
