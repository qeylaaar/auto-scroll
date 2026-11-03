import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, X, Trash2, Eye, Download } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { Task } from '@/types';
import { format } from 'date-fns';

function formatDuration(start: string | null, end: string | null) {
  if (!start) return '-';
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const totalSec = Math.floor((endMs - startMs) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function TaskHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [deleteTarget, setDeleteTarget] = React.useState<Task | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await api.listTasks();
      setTasks(res.tasks);
      setError(null);
    } catch (err) {
      setError((err as Error).message || 'Tidak bisa terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleAction(e: React.MouseEvent, action: 'start' | 'pause' | 'resume' | 'cancel', task: Task) {
    e.stopPropagation();
    setActionLoadingId(task.id);
    try {
      if (action === 'start') await api.startTask(task.id);
      if (action === 'pause') await api.pauseTask(task.id);
      if (action === 'resume') await api.resumeTask(task.id);
      if (action === 'cancel') await api.cancelTask(task.id);
      await load();
    } catch (err) {
      toast({ variant: 'error', title: 'Aksi gagal', description: (err as Error).message });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.deleteTask(deleteTarget.id, true);
      toast({ variant: 'success', title: 'Task dihapus', description: deleteTarget.name });
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast({ variant: 'error', title: 'Gagal menghapus', description: (err as Error).message });
    }
  }

  return (
    <div>
      <Header title="Task History" description="Semua scraping task yang pernah dibuat." />

      <div className="p-8">
        <Card>
          {error ? (
            <ErrorState description={error} onRetry={load} />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)]">
                  <th className="px-5 py-2.5 font-medium">Task</th>
                  <th className="px-5 py-2.5 font-medium">Keyword</th>
                  <th className="px-5 py-2.5 font-medium">Region</th>
                  <th className="px-5 py-2.5 font-medium">Created</th>
                  <th className="px-5 py-2.5 font-medium">Duration</th>
                  <th className="px-5 py-2.5 font-medium">Records</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && tasks.length === 0 && Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} columns={8} />)}
                {tasks.map((task) => {
                  const regionSel = task.region_selection as any;
                  const region =
                    regionSel.mode === 'all'
                      ? 'Seluruh Indonesia'
                      : regionSel.mode === 'imported'
                      ? 'Dataset Impor'
                      : regionSel.mode === 'provinces'
                      ? `${regionSel.provinces?.length ?? 0} provinsi`
                      : `${regionSel.kabupatenKota?.length ?? 0} kab/kota`;

                  const isActing = actionLoadingId === task.id;
                  return (
                    <tr
                      key={task.id}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      className="cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)]"
                    >
                      <td className="px-5 py-3 font-medium text-[var(--color-text-primary)]">{task.name}</td>
                      <td className="px-5 py-3 text-[var(--color-text-secondary)]">{task.keyword}</td>
                      <td className="px-5 py-3 text-[var(--color-text-secondary)]">{region}</td>
                      <td className="px-5 py-3 text-xs text-[var(--color-text-muted)]">{format(new Date(task.created_at), 'dd MMM yyyy, HH:mm')}</td>
                      <td className="px-5 py-3 font-mono-data text-xs text-[var(--color-text-secondary)]">
                        {formatDuration(task.started_at, task.completed_at)}
                      </td>
                      <td className="px-5 py-3 font-mono-data text-xs text-[var(--color-text-secondary)]">{task.successful}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${task.id}`); }} title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {task.status === 'queued' && (
                            <Button size="icon" variant="ghost" disabled={isActing} onClick={(e) => handleAction(e, 'start', task)} title="Start">
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {task.status === 'running' && (
                            <Button size="icon" variant="ghost" disabled={isActing} onClick={(e) => handleAction(e, 'pause', task)} title="Pause">
                              <Pause className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {task.status === 'paused' && (
                            <Button size="icon" variant="ghost" disabled={isActing} onClick={(e) => handleAction(e, 'resume', task)} title="Resume">
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(task.status === 'running' || task.status === 'queued') && (
                            <Button size="icon" variant="ghost" disabled={isActing} onClick={(e) => handleAction(e, 'cancel', task)} title="Cancel">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {task.successful > 0 && (
                            <a
                              href={api.exportUrl(task.id, 'xlsx')}
                              onClick={(e) => e.stopPropagation()}
                              title={task.status === 'completed' ? 'Download' : `Download data sementara (${task.successful} hasil sejauh ini)`}
                            >
                              <Button size="icon" variant="ghost" type="button">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={isActing}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(task);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[var(--color-status-failed)]" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && tasks.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
                      Belum ada task.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </Card>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus task ini?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.status === 'running'
                ? `"${deleteTarget?.name}" sedang berjalan. Task akan dihentikan lalu dihapus permanen beserta seluruh hasil scraping-nya.`
                : `"${deleteTarget?.name}" akan dihapus permanen beserta seluruh hasil scraping-nya. Tindakan ini tidak bisa dibatalkan.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
