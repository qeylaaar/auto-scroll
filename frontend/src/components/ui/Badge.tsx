import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]',
        className
      )}
      {...props}
    />
  );
}

/** Chip mono untuk data koordinat/telepon - elemen signature aplikasi ini (lihat DESIGN_NOTES) */
export function DataChip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'font-mono-data inline-flex items-center rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[11px] text-[var(--color-text-secondary)]',
        className
      )}
      {...props}
    />
  );
}
