import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Play, Pause, X, Loader2, MapPinned, Clock, Gauge } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Progress } from '@/components/ui/Progress';
import { DataChip } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { LiveLogs } from '@/components/tasks/LiveLogs';
import { ResultsTable } from '@/components/tasks/ResultsTable';
import { ResultsMap } from '@/components/tasks/ResultsMap';
import { useTaskSocket } from '@/hooks/useTaskSocket';
import { useToast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/ui/ErrorState';
import { api } from '@/lib/api';
import type { Task, LogEntry } from '@/types';

const PHASE_LABEL: Record<Task['phase'], string> = {
  pending: 'Menunggu dimulai',
  collecting: 'Collecting URLs (Fase 1)',
  extracting: 'Extracting Business Details (Fase 2)',
  cleaning: 'Cleaning & Deduplication (Fase 3)',
  done: 'Selesai',
};

function StatBox({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="font-mono-data mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

const TERMINAL_STATUSES: Task['status'][] = ['completed', 'failed', 'cancelled'];

function formatElapsed(task: Task) {
  if (!task.started_at) return '00:00:00';
  // PENTING: kalau task sudah di status akhir (completed/failed/cancelled),
  // patokan akhir HARUS completed_at, bukan Date.now(). Sebelumnya selalu
  // pakai Date.now() tanpa syarat, jadi angka Elapsed Time terus bertambah
  // selamanya meski task sudah selesai (dan berbeda dari kolom Duration di
  // Task History yang sudah benar pakai completed_at).
  const endTime = TERMINAL_STATUSES.includes(task.status) && task.completed_at
    ? new Date(task.completed_at).getTime()
    : Date.now();
  const totalSec = Math.floor((endTime - new Date(task.started_at).getTime()) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function estimateEta(task: Task) {
  if (!task.started_at || task.urls_found === 0 || task.processed === 0) return '-';
  const elapsedSec = (Date.now() - new Date(task.started_at).getTime()) / 1000;
  const rate = task.processed / elapsedSec; // items per second
  const remaining = task.urls_found - task.processed;
  if (rate <= 0 || remaining <= 0) return '00:00:00';
  const etaSec = Math.round(remaining / rate);
  const h = Math.floor(etaSec / 3600);
  const m = Math.floor((etaSec % 3600) / 60);
  const s = etaSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [task, setTask] = React.useState<Task | null>(null);
  const [historicalLogs, setHistoricalLogs] = React.useState<LogEntry[]>([]);
  const [provinces, setProvinces] = React.useState<string[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [, forceTick] = React.useReducer((x) => x + 1, 0);

  const applyPatch = React.useCallback((patch: Partial<Task>) => {
    setTask((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const { connected, liveLogs } = useTaskSocket(id, applyPatch);

  const loadTask = React.useCallback(() => {
    if (!id) return;
    setLoadError(null);
    api
      .getTask(id)
      .then((res) => setTask(res.task))
      .catch((err) => setLoadError((err as Error).message || 'Tidak bisa terhubung ke server.'));
  }, [id]);

  React.useEffect(() => {
    if (!id) return;
    loadTask();
    api.getLogs(id).then((res) => setHistoricalLogs(res.logs)).catch(() => {});
    api.getProvinces().then((res) => setProvinces(res.provinces)).catch(() => {});
  }, [id, loadTask]);

  // Poll task periodically as a fallback in case a websocket event is missed.
  // Berhenti otomatis begitu task mencapai status akhir — tidak ada gunanya
  // terus polling task yang sudah selesai, dan ini juga jadi pencegahan
  // tambahan supaya bug tampilan seperti Elapsed Time tidak berhenti tidak
  // terulang di masa depan.
  React.useEffect(() => {
    if (!id || !task || TERMINAL_STATUSES.includes(task.status)) return;
    const interval = setInterval(() => {
      api.getTask(id).then((res) => setTask(res.task)).catch(() => {});
    }, 6000);
    return () => clearInterval(interval);
  }, [id, task?.status]);

  // Tick every second to keep elapsed/ETA fresh while running
  React.useEffect(() => {
    if (task?.status !== 'running') return;
    const interval = setInterval(forceTick, 1000);
    return () => clearInterval(interval);
  }, [task?.status]);

  const allLogs = React.useMemo(() => [...historicalLogs, ...liveLogs], [historicalLogs, liveLogs]);

  async function handleAction(action: 'start' | 'pause' | 'resume' | 'cancel') {
    if (!id) return;
    setActionLoading(true);
    try {
      const { task: updated } = await (action === 'start'
        ? api.startTask(id)
        : action === 'pause'
        ? api.pauseTask(id)
        : action === 'resume'
        ? api.resumeTask(id)
        : api.cancelTask(id));
      setTask(updated);
    } catch (err) {
      toast({ variant: 'error', title: 'Aksi gagal', description: (err as Error).message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClearLogs() {
    if (!id) return;
    await api.clearLogs(id);
    setHistoricalLogs([]);
  }

  if (loadError) {
    return (
      <div>
        <Header title="Task Detail" />
        <ErrorState title="Task tidak bisa dimuat" description={loadError} onRetry={loadTask} />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  const pct = task.urls_found > 0 ? Math.round((task.processed / task.urls_found) * 100) : 0;

  return (
    <div>
      <Header
        title={task.name}
        description={`Keyword: "${task.keyword}"`}
        connected={connected}
        actions={
          <div className="flex items-center gap-2">
            {task.status === 'queued' && (
              <Button size="sm" disabled={actionLoading} onClick={() => handleAction('start')}>
                <Play className="h-3.5 w-3.5" /> Start
              </Button>
            )}
            {task.status === 'running' && (
              <Button size="sm" variant="secondary" disabled={actionLoading} onClick={() => handleAction('pause')}>
                <Pause className="h-3.5 w-3.5" /> Pause
              </Button>
            )}
            {task.status === 'paused' && (
              <Button size="sm" disabled={actionLoading} onClick={() => handleAction('resume')}>
                <Play className="h-3.5 w-3.5" /> Resume
              </Button>
            )}
            {(task.status === 'running' || task.status === 'queued') && (
              <Button size="sm" variant="danger" disabled={actionLoading} onClick={() => handleAction('cancel')}>
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-6 p-8">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusBadge status={task.status} />
                <span className="text-sm text-[var(--color-text-secondary)]">{PHASE_LABEL[task.phase]}</span>
              </div>
              {task.current_province && (
                <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                  <MapPinned className="h-3.5 w-3.5" /> {task.current_province}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                <span>Overall Progress</span>
                <DataChip>{pct}%</DataChip>
              </div>
              <Progress value={pct} className="h-2" />
            </div>

            {task.error_message && (
              <div className="rounded-md bg-[var(--color-status-failed-bg)] px-3 py-2 text-xs text-[var(--color-status-failed)]">
                {task.error_message}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <StatBox icon={Gauge} label="URLs Found" value={task.urls_found.toLocaleString('id-ID')} />
              <StatBox icon={Gauge} label="Processed" value={task.processed.toLocaleString('id-ID')} />
              <StatBox icon={Gauge} label="Successful" value={task.successful.toLocaleString('id-ID')} />
              <StatBox icon={Gauge} label="Failed" value={task.failed.toLocaleString('id-ID')} />
              <StatBox icon={Clock} label="Elapsed Time" value={formatElapsed(task)} />
              <StatBox icon={Clock} label="ETA" value={task.status === 'running' ? estimateEta(task) : '-'} />
            </div>
          </CardContent>
        </Card>

        <LiveLogs logs={allLogs} onClear={handleClearLogs} />

        <Tabs defaultValue="results">
          <TabsList>
            <TabsTrigger value="results">Results Table</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
          </TabsList>
          <TabsContent value="results">
            <ResultsTable taskId={task.id} provinceOptions={provinces} isPartial={!TERMINAL_STATUSES.includes(task.status)} />
          </TabsContent>
          <TabsContent value="map">
            <ResultsMap taskId={task.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
