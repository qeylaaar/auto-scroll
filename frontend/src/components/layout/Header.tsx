import { cn } from '@/lib/utils';

export function Header({
  title,
  description,
  actions,
  connected,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  connected?: boolean;
}) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card)] px-8 py-5">
      <div>
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        {connected !== undefined && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-[var(--color-status-completed)]' : 'bg-[var(--color-status-failed)]')} />
            {connected ? 'Realtime tersambung' : 'Terputus'}
          </div>
        )}
        {actions}
      </div>
    </header>
  );
}
