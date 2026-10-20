import { lazy, Suspense, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Sidebar from './components/Sidebar.jsx';
import Navbar from './components/Navbar.jsx';
import { AlertsProvider } from './context/AlertsContext.jsx';
import { Loader, ToastProvider } from './components/ui.jsx';

const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const FireEnginePage = lazy(() => import('./pages/FireEnginePage.jsx'));
const ForestHealthPage = lazy(() => import('./pages/ForestHealthPage.jsx'));
const VulnerableAreasPage = lazy(() => import('./pages/VulnerableAreasPage.jsx'));
const SimulationPage = lazy(() => import('./pages/SimulationPage.jsx'));
const ChangeDetectionPage = lazy(() => import('./pages/ChangeDetectionPage.jsx'));
const AlertsPage = lazy(() => import('./pages/AlertsPage.jsx'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage.jsx'));
const ModelPage = lazy(() => import('./pages/ModelPage.jsx'));
const HistoryPage = lazy(() => import('./pages/HistoryPage.jsx'));
const AuditSettingsPage = lazy(() => import('./pages/AuditSettingsPage.jsx'));

function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false); const location = useLocation();
  const reduceMotion = useReducedMotion();
  return <div className="min-h-screen bg-[#f8faf7] text-slate-800 dark:bg-slate-950 dark:text-slate-100">
    <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
    <div className="min-h-screen lg:pl-[260px]"><Navbar onMenu={() => setMobileOpen(true)} />
      <AnimatePresence mode="wait"><motion.main key={location.pathname} initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.16 }} className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8"><Suspense fallback={<Loader label="Opening workspace view…" />}><Outlet /></Suspense></motion.main></AnimatePresence>
    </div>
  </div>;
}
export default function App() {
  return <ToastProvider><AlertsProvider><Routes><Route element={<Layout />}>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LandingPage />} />
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/fire-engine" element={<FireEnginePage />} />
    <Route path="/forest-health" element={<ForestHealthPage />} />
    <Route path="/vulnerable-areas" element={<VulnerableAreasPage />} />
    <Route path="/simulation" element={<SimulationPage />} />
    <Route path="/change-detection" element={<ChangeDetectionPage />} />
    <Route path="/alerts" element={<AlertsPage />} />
    <Route path="/analytics" element={<AnalyticsPage />} />
    <Route path="/model" element={<ModelPage />} />
    <Route path="/history" element={<HistoryPage />} />
    <Route path="/audit-settings" element={<AuditSettingsPage />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Route></Routes></AlertsProvider></ToastProvider>;
}
