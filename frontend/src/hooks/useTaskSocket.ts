import * as React from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Task, LogEntry } from '@/types';

let sharedSocket: Socket | null = null;
function getSocket() {
  if (!sharedSocket) {
    sharedSocket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
  }
  return sharedSocket;
}

/**
 * Subscribe ke event realtime untuk 1 task tertentu.
 * Nama event mengikuti brief: task_started, phase_changed, province_started,
 * item_success, item_failed, progress_updated, task_paused, task_completed, task_failed.
 */
export function useTaskSocket(taskId: string | undefined, onUpdate: (patch: Partial<Task>) => void) {
  const [connected, setConnected] = React.useState(false);
  const [liveLogs, setLiveLogs] = React.useState<LogEntry[]>([]);
  const logIdCounter = React.useRef(0);

  React.useEffect(() => {
    if (!taskId) return;
    const socket = getSocket();

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    const handleLog = (payload: { message: string; level: 'info' | 'warn' | 'error' }) => {
      logIdCounter.current += 1;
      setLiveLogs((prev) => [
        ...prev.slice(-499),
        { id: logIdCounter.current, task_id: taskId, timestamp: new Date().toISOString(), level: payload.level, message: payload.message },
      ]);
    };

    const handlePhase = (payload: { phase: string }) => onUpdate({ phase: payload.phase as Task['phase'] });
    const handleProgress = (payload: { processed?: number; successful?: number; failed?: number; urlsFound?: number }) => {
      onUpdate({
        ...(payload.processed !== undefined ? { processed: payload.processed } : {}),
        ...(payload.successful !== undefined ? { successful: payload.successful } : {}),
        ...(payload.failed !== undefined ? { failed: payload.failed } : {}),
        ...(payload.urlsFound !== undefined ? { urls_found: payload.urlsFound } : {}),
      });
    };
    const handleProvinceStarted = (payload: { province: string }) => onUpdate({ current_province: payload.province });
    const handleStatusEvent = (status: Task['status']) => () => onUpdate({ status });

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('log', handleLog);
    socket.on('phase_changed', handlePhase);
    socket.on('progress_updated', handleProgress);
    socket.on('province_started', handleProvinceStarted);
    socket.on('task_started', handleStatusEvent('running'));
    socket.on('task_paused', handleStatusEvent('paused'));
    socket.on('task_completed', handleStatusEvent('completed'));
    socket.on('task_failed', handleStatusEvent('failed'));

    socket.emit('subscribe_task', taskId);
    setConnected(socket.connected);

    return () => {
      socket.emit('unsubscribe_task', taskId);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('log', handleLog);
      socket.off('phase_changed', handlePhase);
      socket.off('progress_updated', handleProgress);
      socket.off('province_started', handleProvinceStarted);
      socket.off('task_started');
      socket.off('task_paused');
      socket.off('task_completed');
      socket.off('task_failed');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  return { connected, liveLogs };
}
