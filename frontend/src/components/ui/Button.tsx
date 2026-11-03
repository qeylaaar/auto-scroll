import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-ring',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dark)]',
        secondary: 'bg-white text-[var(--color-text-primary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]',
        ghost: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]',
        danger: 'bg-white text-[var(--color-status-failed)] border border-[var(--color-status-failed)]/30 hover:bg-[var(--color-status-failed-bg)]',
        link: 'text-[var(--color-accent)] hover:underline underline-offset-4',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = 'Button';
