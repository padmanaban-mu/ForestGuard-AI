import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Check, Info, LoaderCircle, X } from 'lucide-react';
import { relativeLabel, riskColor, riskLabel, severityClass } from '../utils/formatters.js';
import { readLocal } from '../utils/storage.js';
import { useData } from '../context/DataContext.jsx';

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div>{eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}<h1 className="page-title">{title}</h1>{subtitle && <p className="page-subtitle max-w-3xl">{subtitle}</p>}</div>{action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}</div>;
}
export function StatCard({ label, value, suffix, icon: Icon, accent = 'green', note, status, source, updatedAt }) {
  const data = useData(); const sources = [...new Set(Object.values(data?.sourceStatus || {}).map((item) => item?.source).filter(Boolean))];
  const latest = Object.values(data?.sourceStatus || {}).map((item) => item?.fetchedAt).filter(Boolean).sort().at(-1);
  const sourceText = source || sources.join(' · '); const freshness = updatedAt || latest;
  const colors = { green: 'bg-emerald-50 text-forest-700 dark:bg-emerald-950/50 dark:text-emerald-300', orange: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300', amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', red: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300', slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
  return <div className="card p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p><div className="mt-2 flex items-baseline gap-1"><span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value ?? '—'}</span>{suffix && <span className="text-xs font-medium text-slate-500">{suffix}</span>}</div></div>{Icon && <div className={`rounded-xl p-2.5 ${colors[accent]}`}><Icon size={19} aria-hidden="true" /></div>}</div><div className="mt-3 space-y-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400"><p className="flex items-start gap-2">{status && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />}{note || 'Source data unavailable'}</p><p className="line-clamp-2 break-words text-[9px] leading-3 text-slate-400" title={`Sources: ${sourceText || 'Not loaded'} · Last updated ${relativeLabel(freshness)}`}>Sources: {sourceText || 'Not loaded'} · Last updated {relativeLabel(freshness)}</p></div></div>;
}
export function RiskBadge({ score, level }) {
  const name = level || riskLabel(score); const color = riskColor(score);
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset" style={{ color, backgroundColor: `${color}18`, '--tw-ring-color': `${color}45` }}>{score != null && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />}{name}{score != null && <span className="tabular-nums opacity-80">{Math.round(score)}</span>}</span>;
}
export function StatusBadge({ status }) {
  const color = status === 'Live' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900' : status === 'Cached' ? 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900' : 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${color}`}>{status || 'Fallback'}</span>;
}
export function SeverityBadge({ level }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${severityClass(level) || severityClass('Low')}`}>{level}</span>; }
export function ChartCard({ title, subtitle, source, updatedAt, children, className = '' }) {
  return <section className={`card min-w-0 p-4 sm:p-5 ${className}`}><div className="mb-4"><h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>{subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}</div>{children}<p className="mt-4 border-t border-slate-100 pt-3 text-[10px] text-slate-400 dark:border-slate-800 dark:text-slate-500">Source: {source || 'Public source / user dataset'} · Last updated {relativeLabel(updatedAt)}</p></section>;
}
export function EmptyState({ title = 'No records available', description = 'No matching source data is available for this view yet.', action, icon: Icon = Info, compact = false }) {
  return <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-7' : 'min-h-[220px] py-10'}`}><div className="mb-3 rounded-2xl bg-slate-100 p-3 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><Icon size={21} /></div><h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3><p className="mt-1 max-w-md text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}
export function Loader({ label = 'Loading source data…', compact = false }) { return <div className={`flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400 ${compact ? 'py-8' : 'min-h-[220px]'}`} role="status"><LoaderCircle size={17} className="animate-spin text-forest-500" /><span>{label}</span></div>; }
export function ErrorNotice({ error, onRetry }) { return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" role="alert"><span className="flex items-center gap-2"><AlertCircle size={16} />{error || 'The source request failed. Local fallback is being used.'}</span>{onRetry && <button className="btn-quiet !px-3 !py-1.5" onClick={onRetry}>Retry</button>}</div>; }
export function SourceLine({ source, fetchedAt, status }) { return <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500"><StatusBadge status={status} /><span>Source: {source || 'Not loaded'}</span><span>·</span><span>Last updated {relativeLabel(fetchedAt)}</span></div>; }
export function DataNote({ children, tone = 'amber' }) { const cls = tone === 'red' ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'; return <div className={`rounded-xl border px-4 py-3 text-xs leading-5 ${cls}`}>{children}</div>; }

export function Modal({ open, title, onClose, children, width = 'max-w-xl' }) {
  const reduceMotion = useReducedMotion();
  useEffect(() => { if (!open) return undefined; const onKey = (event) => event.key === 'Escape' && onClose?.(); window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [open, onClose]);
  return <AnimatePresence>{open && <motion.div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduceMotion ? { duration: 0 } : undefined} onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}><motion.div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[90vh] w-full ${width} overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-6`} initial={reduceMotion ? false : { y: 12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 8, scale: 0.98 }} transition={reduceMotion ? { duration: 0 } : undefined}><div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>{children}</motion.div></motion.div>}</AnimatePresence>;
}
export function Drawer({ open, title, onClose, children, width = 'max-w-lg' }) {
  const reduceMotion = useReducedMotion();
  useEffect(() => { if (!open) return undefined; const onKey = (event) => event.key === 'Escape' && onClose?.(); window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [open, onClose]);
  return <AnimatePresence>{open && <><motion.button aria-label="Close details panel" className="fixed inset-0 z-[70] cursor-default bg-slate-950/30" onClick={onClose} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduceMotion ? { duration: 0 } : undefined} /><motion.aside role="dialog" aria-modal="true" aria-label={title} className={`fixed inset-y-0 right-0 z-[71] w-full ${width} overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-950 sm:p-7`} initial={reduceMotion ? false : { x: '100%' }} animate={{ x: 0 }} exit={reduceMotion ? { x: 0 } : { x: '100%' }} transition={reduceMotion ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 260 }}><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2><button className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close details" onClick={onClose}><X size={18} /></button></div>{children}</motion.aside></>}</AnimatePresence>;
}
const ToastContext = createContext(() => {});
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]); const reduceMotion = useReducedMotion();
  const push = (message, kind = 'success') => { const id = `${Date.now()}-${Math.random()}`; setToasts((items) => [...items, { id, message, kind }]); window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3800); };
  useEffect(() => {
    const onAlert = (event) => {
      const preferences = readLocal('forestguard:notifications', { inAppAlerts: true });
      if (!preferences.inAppAlerts) return;
      const id = `${Date.now()}-${Math.random()}`; const message = String(event.detail || 'New fire alert available.');
      setToasts((items) => [...items, { id, message, kind: 'info' }]);
      window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3800);
    };
    window.addEventListener('forestguard:in-app-alert', onAlert);
    return () => window.removeEventListener('forestguard:in-app-alert', onAlert);
  }, []);
  const value = useMemo(() => push, []);
  return <ToastContext.Provider value={value}>{children}<div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">{toasts.map((toast) => <motion.div key={toast.id} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reduceMotion ? { duration: 0 } : undefined} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl dark:bg-slate-100 dark:text-slate-900">{toast.kind === 'success' ? <Check size={16} className="text-emerald-400" /> : <Info size={16} className="text-amber-400" />}{toast.message}</motion.div>)}</div></ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
