import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold py-2 px-4 rounded-lg cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95',
  {
    variants: {
      variant: {
        solid: 'bg-button-solid text-white hover:bg-[--color-button-solid-hover] focus:ring-[--color-button-solid]',
        light: 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-100 focus:ring-gray-400',
        muted: 'bg-gray-300 text-gray-900 hover:bg-gray-400 focus:ring-gray-300',
        brand: 'bg-brand-primary text-brand-primary-fg hover:opacity-90 focus:ring-brand-primary',
        ghost: 'bg-transparent text-ink-soft hover:bg-border-soft focus:ring-focus-ring',
        danger: 'bg-status-bad text-white hover:bg-status-bad-hover focus:ring-status-bad',
      },
    },
    defaultVariants: {
      variant: 'solid',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export default function Button({ children, className, variant, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant }), className)} {...props}>
      {children}
    </button>
  );
}