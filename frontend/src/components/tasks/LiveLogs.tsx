import * as React from 'react';
import { Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { LogEntry } from '@/types';
import { format } from 'date-fns';

const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  info: 'var(--color-text-secondary)',
  warn: 'var(--color-status-paused)',
  error: 'var(--color-status-failed)',
};

export function LiveLogs({ logs, onClear }: { logs: LogEntry[]; onClear: () => void }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);

  React.useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  function downloadLogs() {
    const text = logs.map((l) => `[${format(new Date(l.timestamp), 'HH:mm:ss')}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scraping-logs.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-ink)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <p className="text-xs font-medium text-white/70">Live Logs</p>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-white/60 hover:bg-white/10 hover:text-white" onClick={downloadLogs}>
            <Download className="h-3 w-3" /> Download
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-white/60 hover:bg-white/10 hover:text-white" onClick={onClear}>
            <Trash2 className="h-3 w-3" /> Clear
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
        }}
        className="h-72 overflow-y-auto px-4 py-3 font-mono-data text-[12px] leading-relaxed"
      >
        {logs.length === 0 && <p className="text-white/30">Belum ada log.</p>}
        {logs.map((log) => (
          <div key={log.id} className={cn('whitespace-pre-wrap break-all')}>
            <span className="text-white/30">[{format(new Date(log.timestamp), 'HH:mm:ss')}]</span>{' '}
            <span style={{ color: LEVEL_COLOR[log.level] === 'var(--color-text-secondary)' ? 'rgba(255,255,255,0.85)' : LEVEL_COLOR[log.level] }}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
