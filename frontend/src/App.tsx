import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ToastProvider } from '@/components/ui/Toast';
import { Dashboard } from '@/pages/Dashboard';
import { NewTask } from '@/pages/NewTask';
import { TaskHistory } from '@/pages/TaskHistory';
import { TaskDetail } from '@/pages/TaskDetail';
import { DataDirectory } from '@/pages/DataDirectory';
export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new-task" element={<NewTask />} />
            <Route path="/tasks" element={<TaskHistory />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/directory" element={<DataDirectory />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
