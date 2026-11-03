import { cn } from '@/lib/utils';
import type { TaskStatus } from '@/types';

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; pulse?: boolean }> = {
  queued: { label: 'Queued', color: 'var(--color-status-queued)', bg: 'var(--color-status-queued-bg)' },
  running: { label: 'Running', color: 'var(--color-status-running)', bg: 'var(--color-status-running-bg)', pulse: true },
  paused: { label: 'Paused', color: 'var(--color-status-paused)', bg: 'var(--color-status-paused-bg)' },
  completed: { label: 'Completed', color: 'var(--color-status-completed)', bg: 'var(--color-status-completed-bg)' },
  failed: { label: 'Failed', color: 'var(--color-status-failed)', bg: 'var(--color-status-failed-bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--color-status-queued)', bg: 'var(--color-status-queued-bg)' },
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', className)}
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {cfg.pulse && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ backgroundColor: cfg.color }}
          />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      </span>
      {cfg.label}
    </span>
  );
}
