import React from 'react';


// Кнопка. Сделал пропс disabled, чтобы нельзя было нажать дважды при отправке формы.
export const Button = ({ text, onClick, disabled = false }) => (
  <button 
    onClick={onClick} 
    disabled={disabled}
    style={{ padding: '10px', margin: '5px', cursor: disabled ? 'not-allowed' : 'pointer' }}
  >
    {text}
  </button>
);

// Поле ввода. Добавил пропс error, чтобы подсвечивать красным, если пользователь ошибся.
export const Input = ({ label, value, onChange, error, type = 'text' }) => (
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

// Карточка. Просто обертка, чтобы форма по центру была. Захардкодил ширину 300px.
export const Card = ({ children }) => (
  <div style={{ border: '1px solid #ccc', padding: '20px', width: '300px', margin: '50px auto' }}>
    {children}
  </div>
);
