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
      bg-gray-700 text-white
      hover:bg-gray-800
      focus:ring-gray-700`, 
    light: `
      bg-white text-gray-900 border border-gray-300
      hover:bg-gray-100
      focus:ring-gray-400`, 
    muted: `
      bg-gray-300 text-gray-900
      hover:bg-gray-400
      focus:ring-gray-300`,
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