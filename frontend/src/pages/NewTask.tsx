import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { RegionSelection } from '@/types';
import { cn } from '@/lib/utils';

type LocationMode = 'all' | 'provinces';

export function NewTask() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = React.useState('');
  const [keyword, setKeyword] = React.useState('');
  const [locationMode, setLocationMode] = React.useState<LocationMode>('all');
  const [provinces, setProvinces] = React.useState<string[]>([]);
  const [provincesError, setProvincesError] = React.useState(false);
  const [selectedProvinces, setSelectedProvinces] = React.useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [maxWorkers, setMaxWorkers] = React.useState(2);
  const [requestDelay, setRequestDelay] = React.useState(0);
  const [retryCount, setRetryCount] = React.useState(2);
  const [timeoutMs, setTimeoutMs] = React.useState(12000);
  const [restartEvery, setRestartEvery] = React.useState(200);
  const [includeReviews, setIncludeReviews] = React.useState(false);

  const loadProvinces = React.useCallback(() => {
    setProvincesError(false);
    api
      .getProvinces()
      .then((res) => setProvinces(res.provinces))
      .catch(() => setProvincesError(true));
  }, []);

  React.useEffect(() => {
    loadProvinces();
  }, [loadProvinces]);

  const toggleProvince = (p: string) => {
    setSelectedProvinces((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  };

  const workersWarning = maxWorkers >= 5;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !keyword.trim()) {
      toast({ variant: 'warning', title: 'Lengkapi form', description: 'Nama task dan keyword wajib diisi.' });
      return;
    }
    if (locationMode === 'provinces' && selectedProvinces.size === 0) {
      toast({ variant: 'warning', title: 'Pilih wilayah', description: 'Pilih minimal 1 provinsi, atau gunakan "Seluruh Indonesia".' });
      return;
    }

    const regionSelection: RegionSelection =
      locationMode === 'all' ? { mode: 'all' } : { mode: 'provinces', provinces: Array.from(selectedProvinces) };

    setSubmitting(true);
    try {
      const { task, warnings } = await api.createTask({
        name: name.trim(),
        keyword: keyword.trim(),
        regionSelection,
        config: {
          MAX_WORKERS: maxWorkers,
          REQUEST_DELAY: requestDelay,
          RETRY_COUNT: retryCount,
          TIMEOUT_MS: timeoutMs,
          RESTART_BROWSER_EVERY: restartEvery,
          INCLUDE_REVIEWS: includeReviews,
        },
      });
      warnings.forEach((w) => toast({ variant: 'warning', title: 'Perhatian', description: w }));
      toast({ variant: 'success', title: 'Task dibuat', description: `"${task.name}" siap dijalankan.` });
      navigate(`/tasks/${task.id}`);
    } catch (err) {
      toast({ variant: 'error', title: 'Gagal membuat task', description: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Header title="New Scraping Task" description="Buat task baru untuk mengumpulkan data bisnis dari Google Maps." />

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5 p-8">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Nama task dan kategori bisnis yang ingin dicari.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Task Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder='Contoh: "Bengkel Mobil Jawa Barat"' />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="keyword">Keyword</Label>
              <Input id="keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder='Contoh: "Bengkel Mobil"' />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Location</CardTitle>
              <CardDescription>Pilih cakupan wilayah scraping.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLocationMode('all')}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                  locationMode === 'all'
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent-dark)]'
                    : 'border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
                )}
              >
                Seluruh Indonesia
              </button>
              <button
                type="button"
                onClick={() => setLocationMode('provinces')}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                  locationMode === 'provinces'
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent-dark)]'
                    : 'border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
                )}
              >
                Provinsi Tertentu
              </button>
            </div>

            {locationMode === 'provinces' && (
              <div className="max-h-56 overflow-y-auto rounded-md border border-[var(--color-border)] p-2">
                {provincesError ? (
                  <div className="flex items-center justify-between gap-2 p-2 text-xs text-[var(--color-status-failed)]">
                    <span>Gagal memuat daftar provinsi.</span>
                    <button type="button" onClick={loadProvinces} className="font-medium underline underline-offset-2">
                      Coba lagi
                    </button>
                  </div>
                ) : provinces.length === 0 ? (
                  <p className="p-2 text-xs text-[var(--color-text-muted)]">Memuat daftar provinsi...</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    {provinces.map((p) => (
                      <label key={p} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[var(--color-surface)]">
                        <input
                          type="checkbox"
                          checked={selectedProvinces.has(p)}
                          onChange={() => toggleProvince(p)}
                          className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                        />
                        <span className="text-[var(--color-text-primary)]">{p}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            {locationMode === 'provinces' && selectedProvinces.size > 0 && (
              <p className="text-xs text-[var(--color-text-secondary)]">{selectedProvinces.size} provinsi dipilih.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Basic Settings</CardTitle>
              <CardDescription>Parameter yang aman diubah.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="workers">Max Workers (concurrency)</Label>
                <span className="font-mono-data text-sm text-[var(--color-text-secondary)]">{maxWorkers}</span>
              </div>
              <input
                id="workers"
                type="range"
                min={1}
                max={8}
                value={maxWorkers}
                onChange={(e) => setMaxWorkers(Number(e.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
              {workersWarning && (
                <div className="flex items-start gap-2 rounded-md bg-[var(--color-status-paused-bg)] px-3 py-2 text-xs text-[var(--color-status-paused)]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Concurrency tinggi dapat meningkatkan penggunaan CPU/RAM dan membuat scraping tidak stabil. Rekomendasi: 2-4.
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retry">Retry Count</Label>
              <Input id="retry" type="number" min={0} max={10} value={retryCount} onChange={(e) => setRetryCount(Number(e.target.value))} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3">
              <div className="space-y-0.5">
                <Label htmlFor="include-reviews" className="text-sm font-medium text-[var(--color-text-primary)] cursor-pointer">
                  Ambil Rating & Reviews
                </Label>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Ekstrak rating bintang (⭐) dan total ulasan dari Google Maps.
                </p>
              </div>
              <input
                id="include-reviews"
                type="checkbox"
                checked={includeReviews}
                onChange={(e) => setIncludeReviews(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
              />
            </div>
          </CardContent>
        </Card>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between rounded-md border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]"
        >
          Advanced Settings
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showAdvanced && (
          <Card>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="delay">Request Delay (ms)</Label>
                  <Input id="delay" type="number" min={0} value={requestDelay} onChange={(e) => setRequestDelay(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="timeout">Timeout per URL (ms)</Label>
                  <Input id="timeout" type="number" min={3000} value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value))} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="restart">Restart Browser Setiap (URL)</Label>
                  <Input id="restart" type="number" min={10} value={restartEvery} onChange={(e) => setRestartEvery(Number(e.target.value))} />
                  <p className="text-xs text-[var(--color-text-muted)]">Restart browser secara berkala untuk mencegah memory leak.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Task
          </Button>
        </div>
      </form>
    </div>
  );
}