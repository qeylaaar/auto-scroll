import { cn } from '@/lib/utils';

export function Progress({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]', className)}>
      <div
        className={cn('h-full rounded-full bg-[var(--color-accent)] transition-all duration-500 ease-out', barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
