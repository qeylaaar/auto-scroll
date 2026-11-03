import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, Loader2, CheckCircle2, XCircle, Building2, Plus } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataChip } from '@/components/ui/Badge';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { api } from '@/lib/api';
import type { DashboardStats, Task } from '@/types';
import { formatDistanceToNow } from 'date-fns';

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: accent ? `${accent}1a` : 'var(--color-accent-light)' }}
        >
          <Icon className="h-5 w-5" style={{ color: accent || 'var(--color-accent)' }} strokeWidth={2} />
        </div>
        <div>
          <p className="font-mono-data text-2xl font-semibold text-[var(--color-text-primary)]">{value.toLocaleString('id-ID')}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent-light)]">
        <ListChecks className="h-6 w-6 text-[var(--color-accent)]" />
      </div>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">No scraping tasks yet</p>
      <p className="max-w-xs text-xs text-[var(--color-text-secondary)]">
        Buat task pertama untuk mulai mengumpulkan data bisnis dari Google Maps.
      </p>
      <Button size="sm" className="mt-1" onClick={() => navigate('/new-task')}>
        <Plus className="h-3.5 w-3.5" /> Create Your First Task
      </Button>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [statsRes, tasksRes] = await Promise.all([api.getDashboardStats(), api.listTasks()]);
      setStats(statsRes);
      setTasks(tasksRes.tasks.slice(0, 8));
      setError(null);
    } catch (err) {
      setError((err as Error).message || 'Tidak bisa terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div>
      <Header
        title="Dashboard"
        description="Ringkasan aktivitas scraping Google Maps."
        actions={
          <Button size="sm" onClick={() => navigate('/new-task')}>
            <Plus className="h-3.5 w-3.5" /> New Task
          </Button>
        }
      />

      <div className="p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard icon={ListChecks} label="Total Tasks" value={stats?.totalTasks ?? 0} />
          <StatCard icon={Loader2} label="Running" value={stats?.runningTasks ?? 0} accent="#2563eb" />
          <StatCard icon={CheckCircle2} label="Completed" value={stats?.completedTasks ?? 0} accent="#15803d" />
          <StatCard icon={XCircle} label="Failed" value={stats?.failedTasks ?? 0} accent="#b42318" />
          <StatCard icon={Building2} label="Businesses Scraped" value={stats?.totalBusinessesScraped ?? 0} />
        </div>

        <Card className="mt-6">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Recent Tasks</h3>
          </div>

          {error ? (
            <ErrorState description={error} onRetry={load} />
          ) : !loading && tasks.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)]">
                    <th className="px-5 py-2.5 font-medium">Task Name</th>
                    <th className="px-5 py-2.5 font-medium">Keyword</th>
                    <th className="px-5 py-2.5 font-medium">Progress</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && tasks.length === 0
                    ? Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} columns={5} />)
                    : tasks.map((task) => {
                    const pct = task.urls_found > 0 ? Math.round((task.processed / task.urls_found) * 100) : 0;
                    return (
                      <tr
                        key={task.id}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)]"
                      >
                        <td className="px-5 py-3 font-medium text-[var(--color-text-primary)]">{task.name}</td>
                        <td className="px-5 py-3 text-[var(--color-text-secondary)]">{task.keyword}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-border)]">
                              <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${pct}%` }} />
                            </div>
                            <DataChip>{pct}%</DataChip>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="px-5 py-3 text-xs text-[var(--color-text-muted)]">
                          {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
