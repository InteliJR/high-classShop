import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'light' | 'muted';
}

export default function Button({
  children,
  className,
  variant = 'solid',
  ...props 
}: ButtonProps) {
  
  const buttonStyles = `
    font-semibold py-2 px-4 rounded-lg
    cursor-pointer transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-95
  `;

  const variantStyles = { 
    solid: `
      bg-button-solid text-white
      hover:bg-[--color-button-solid-hover]
      focus:ring-[--color-button-solid]`, 
    light: `
      bg-[--color-button-light] text-[--color-text-dark] border border-gray-300
      hover:bg-gray-100
      focus:ring-[--color-secondary]`, 
    muted: `
      bg-[--color-button-muted] text-[--color-text-dark]
      hover:bg-opacity-80
      focus:ring-[--color-button-muted]`,
  };

  return (
    <button
      className={`${buttonStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}