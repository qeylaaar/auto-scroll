import type { Task, TaskConfig, RegionSelection, ResultRow, ReviewRow, LogEntry, DashboardStats } from '@/types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getProvinces: () => request<{ provinces: string[] }>('/meta/provinces'),
  getDashboardStats: () => request<DashboardStats>('/dashboard/stats'),

  listTasks: () => request<{ tasks: Task[] }>('/tasks'),
  getTask: (id: string) => request<{ task: Task }>(`/tasks/${id}`),
  createTask: (payload: { name: string; keyword: string; regionSelection: RegionSelection; config?: Partial<TaskConfig> }) =>
    request<{ task: Task; warnings: string[] }>('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  deleteTask: (id: string, confirm = false) =>
    request<void>(`/tasks/${id}${confirm ? '?confirm=true' : ''}`, { method: 'DELETE' }),
  updateTask: (id: string, payload: { name?: string; categoryGroup?: string }) =>
    request<{ task: Task }>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  startTask: (id: string) => request<{ task: Task }>(`/tasks/${id}/start`, { method: 'POST' }),
  pauseTask: (id: string) => request<{ task: Task }>(`/tasks/${id}/pause`, { method: 'POST' }),
  resumeTask: (id: string) => request<{ task: Task }>(`/tasks/${id}/resume`, { method: 'POST' }),
  cancelTask: (id: string) => request<{ task: Task }>(`/tasks/${id}/cancel`, { method: 'POST' }),

  getLogs: (id: string, afterId = 0) => request<{ logs: LogEntry[] }>(`/tasks/${id}/logs?afterId=${afterId}`),
  clearLogs: (id: string) => request<void>(`/tasks/${id}/logs`, { method: 'DELETE' }),

  getResults: (
    id: string,
    params: {
      search?: string;
      province?: string;
      hasPhone?: boolean;
      hasEmail?: boolean;
      hasCoords?: boolean;
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortDir?: 'ASC' | 'DESC';
    } = {}
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    return request<{ rows: ResultRow[]; total: number; page: number; pageSize: number }>(
      `/tasks/${id}/results?${qs.toString()}`
    );
  },

  getReviews: (resultId: number) => request<{ reviews: ReviewRow[] }>(`/results/${resultId}/reviews`),

  exportUrl: (id: string, format: 'csv' | 'xlsx' | 'geojson' | 'reviews-csv') => `${BASE}/tasks/${id}/export/${format}`,
};