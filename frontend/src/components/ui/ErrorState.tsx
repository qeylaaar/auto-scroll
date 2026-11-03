import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function ErrorState({
  title = 'Gagal memuat data',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-status-failed-bg)]">
        <AlertTriangle className="h-6 w-6 text-[var(--color-status-failed)]" />
      </div>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
      {description && <p className="max-w-sm text-xs text-[var(--color-text-secondary)]">{description}</p>}
      {onRetry && (
        <Button size="sm" variant="secondary" className="mt-1" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Coba Lagi
        </Button>
      )}
    </div>
  );
}
