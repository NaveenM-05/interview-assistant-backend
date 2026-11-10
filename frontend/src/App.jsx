import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Landing from './pages/Landing';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';

// The interview room pulls in Monaco, so load it only when needed.
const InterviewRoom = lazy(() => import('./pages/InterviewRoom'));

function RouteFallback() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6" aria-busy="true">
      <div className="skeleton h-10 w-72" />
      <div className="skeleton h-32 w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="skeleton h-[26rem]" />
        <div className="skeleton h-[26rem]" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Landing />} />
        <Route path="setup" element={<Setup />} />
        <Route
          path="interview"
          element={
            <Suspense fallback={<RouteFallback />}>
              <InterviewRoom />
            </Suspense>
          }
        />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
