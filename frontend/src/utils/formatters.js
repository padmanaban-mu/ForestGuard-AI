import { format, isValid, parseISO } from 'date-fns';

export const number = (value, digits = 0) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(value)) : '—';
export const compactNumber = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value)) : '—';
export const dateLabel = (value) => {
  if (!value) return '—';
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(d) ? format(d, 'dd MMM yyyy') : String(value);
};
export const timeLabel = (value) => {
  if (!value) return 'Not refreshed';
  const d = new Date(value);
  return isValid(d) ? format(d, 'dd MMM, HH:mm') : 'Not refreshed';
};
export const relativeLabel = (value) => {
  if (!value) return 'not yet refreshed';
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return 'not yet refreshed';
  const mins = Math.floor(elapsed / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};
export const fireDateTime = (fire) => {
  if (!fire?.acqDate) return '—';
  const time = fire.acqTime ? `${String(fire.acqTime).padStart(4, '0').slice(0, 2)}:${String(fire.acqTime).padStart(4, '0').slice(2)}` : '';
  return `${dateLabel(fire.acqDate)}${time ? ` · ${time} UTC` : ''}`;
};
export const severityClass = (level) => ({
  Extreme: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900',
  Critical: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900',
  High: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900',
  Moderate: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  Medium: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  Low: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
}[level]);
export const riskColor = (score) => score == null ? '#94a3b8' : score >= 75 ? '#dc2626' : score >= 50 ? '#ea580c' : score >= 25 ? '#f59e0b' : '#16a34a';
export const riskLabel = (score) => score == null ? 'Unavailable' : score >= 75 ? 'Extreme' : score >= 50 ? 'High' : score >= 25 ? 'Medium' : 'Low';
export const confidenceLabel = (code) => {
  if (code == null || code === '') return 'Not reported';
  const value = String(code).trim().toLowerCase();
  return ({ n: 'Nominal', l: 'Low', h: 'High' })[value] || `${code}`;
};
