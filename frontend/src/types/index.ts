export type TaskStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type RegionMode = 'all' | 'provinces' | 'kabupaten' | 'imported';
export type TaskPhase = 'pending' | 'collecting' | 'extracting' | 'cleaning' | 'done';

export interface TaskConfig {
  MAX_WORKERS: number;
  REQUEST_DELAY: number;
  RETRY_COUNT: number;
  TIMEOUT_MS: number;
  RESTART_BROWSER_EVERY: number;
  NAVIGATION_TIMEOUT_MS: number;
  INCLUDE_REVIEWS?: boolean;
}

export type RegionSelection =
  | { mode: 'all' }
  | { mode: 'provinces'; provinces: string[] }
  | { mode: 'kabupaten'; kabupatenKota: string[] };

export interface Task {
  id: string;
  name: string;
  keyword: string;
  category_group: string;
  region_selection: RegionSelection & { mode: string };
  config: TaskConfig;
  status: TaskStatus;
  phase: TaskPhase;
  urls_found: number;
  processed: number;
  successful: number;
  failed: number;
  current_province: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ResultRow {
  id: number;
  task_id: string;
  name: string;
  full_address: string;
  email: string;
  category: string;
  phones: string;
  latitude: number | null;
  longitude: number | null;
  rating?: string | number | null;
  total_reviews?: string | number | null;
  google_maps_url: string;
  website?: string | null;
  province: string | null;
  created_at: string;
}

export interface ReviewRow {
  id: number;
  task_id: string;
  result_id: number;
  author_name: string;
  rating: number | null;
  review_text: string;
  published_at: string;
  created_at: string;
}

export interface LogEntry {
  id: number;
  task_id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface DashboardStats {
  totalTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalBusinessesScraped: number;
}