import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export default function Button({
  children,
  className,
  ...props 
}: ButtonProps) {
  
  const buttonStyles = `
    bg-button text-white 
    font-semibold py-2 px-4 rounded-lg
    cursor-pointer
    transition-colors hover:bg-neutral-700 
    focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2
  `;

  return (
    <button
      className={`${buttonStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}