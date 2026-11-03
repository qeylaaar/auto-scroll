/**
 * WebSocket gateway (Socket.IO).
 * Frontend join room `task:{taskId}` untuk terima event realtime task
 * tersebut: task_started, phase_changed, province_started, item_success,
 * item_failed, progress_updated, task_paused, task_completed, task_failed.
 */

function setupSocket(io) {
  io.on('connection', (socket) => {
    socket.on('subscribe_task', (taskId) => {
      socket.join(`task:${taskId}`);
    });

    socket.on('unsubscribe_task', (taskId) => {
      socket.leave(`task:${taskId}`);
    });
  });
}

module.exports = { setupSocket };
