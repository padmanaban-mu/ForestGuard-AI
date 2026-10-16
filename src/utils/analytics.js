import { format, subDays, startOfDay, parseISO } from 'date-fns';

export function dailyFireTrend(fires, days = 7) {
  const now = startOfDay(new Date());
  return Array.from({ length: days }, (_, i) => {
    const day = subDays(now, days - 1 - i); const key = format(day, 'yyyy-MM-dd');
    return { date: format(day, 'dd MMM'), dayKey: key, detections: fires.filter((fire) => fire.acqDate && format(parseISO(fire.acqDate), 'yyyy-MM-dd') === key).length };
  });
}
export function groupFiresByMonth(fires) {
  const groups = new Map();
  fires.forEach((fire) => { if (!fire.acqDate) return; const date = parseISO(fire.acqDate); if (Number.isNaN(date.getTime())) return; const key = format(date, 'yyyy-MM'); groups.set(key, (groups.get(key) || 0) + 1); });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ month: format(parseISO(`${key}-01`), 'MMM yy'), key, detections: count }));
}
export const fireConfidenceDistribution = (fires) => {
  const counts = new Map();
  fires.forEach((fire) => { const label = fire.confidence == null ? 'Not reported' : ({ n: 'Nominal', l: 'Low', h: 'High' })[String(fire.confidence).toLowerCase()] || String(fire.confidence); counts.set(label, (counts.get(label) || 0) + 1); });
  return [...counts.entries()].map(([name, value]) => ({ name, value }));
};
export const frpDistribution = (fires) => {
  const bins = [{ label: '0–5', min: 0, max: 5 }, { label: '5–10', min: 5, max: 10 }, { label: '10–20', min: 10, max: 20 }, { label: '20–50', min: 20, max: 50 }, { label: '50+', min: 50, max: Infinity }];
  return bins.map((bin) => ({ range: bin.label, detections: fires.filter((fire) => Number.isFinite(fire.frp) && fire.frp >= bin.min && fire.frp < bin.max).length }));
};
export function monthYearGrid(fires) {
  const years = [...new Set(fires.map((f) => f.acqDate?.slice(0, 4)).filter(Boolean))].sort();
  return years.flatMap((year) => Array.from({ length: 12 }, (_, i) => ({ year, month: format(new Date(Number(year), i, 1), 'MMM'), monthNo: i + 1, detections: fires.filter((f) => f.acqDate?.startsWith(`${year}-${String(i + 1).padStart(2, '0')}`)).length })));
}
