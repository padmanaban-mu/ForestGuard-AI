import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowRight, CloudSun, Droplets, Flame, Gauge, MapPin, RefreshCw, Siren, Wind } from 'lucide-react';
import { ChartCard, DataNote, EmptyState, PageHeader, RiskBadge, SeverityBadge, SourceLine, StatCard } from '../components/ui.jsx';
import MapView from '../components/MapView.jsx';
import { useData } from '../context/DataContext.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { useZoneMetrics } from '../utils/useZoneMetrics.js';
import { dailyFireTrend } from '../utils/analytics.js';
import { REGION } from '../data/region.js';
import { weatherValue } from '../services/weather.js';
import { withinLastHours } from '../services/firms.js';
import { dateLabel, fireDateTime, number } from '../utils/formatters.js';

export default function DashboardPage() {
  const { fires, weather, stations, zones, sourceStatus, loading, refreshedAt, refresh } = useData(); const { alerts, newCount } = useAlerts(); const { metrics } = useZoneMetrics(); const navigate = useNavigate();
  const recent = useMemo(() => withinLastHours(fires, 24), [fires]);
  const fireFeedUsable = sourceStatus.fires?.status === 'Live' || sourceStatus.fires?.status === 'Cached' || fires.length > 0;
  const avgRisk = metrics.length && metrics.every((m) => m.score != null) ? metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length : null;
  const current = weatherValue(weather, 'temperature_2m'); const rh = weatherValue(weather, 'relative_humidity_2m'); const wind = weatherValue(weather, 'wind_speed_10m'); const direction = weatherValue(weather, 'wind_direction_10m');
  const trend = useMemo(() => dailyFireTrend(withinLastHours(fires, 24 * 8), 7), [fires]);
  const trendReady = fireFeedUsable && fires.some((f) => f.acqDate);
  const riskLookup = Object.fromEntries(metrics.map((m) => [m.name, m.score]));
  const weatherSource = sourceStatus.weather;
  const lastUpdate = sourceStatus.fires?.fetchedAt || refreshedAt;
  return <div className="space-y-6">
    <PageHeader eyebrow={`Situation overview · ${REGION.name}`} title="Forest fire dashboard" subtitle="A source-transparent view of detections, readiness and forest conditions." action={<><button className="btn-quiet" onClick={() => refresh({ force: true })}><RefreshCw size={15} /> Refresh sources</button><button className="btn-primary" onClick={() => navigate('/simulation')}><Flame size={15} /> Simulate scenario</button></>} />
    {sourceStatus.fires?.error && <DataNote><strong>Fire source:</strong> {sourceStatus.fires.error}</DataNote>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Active fire detections · 24h" value={fireFeedUsable ? recent.length : '—'} icon={Flame} accent="orange" note={sourceStatus.fires?.source || 'Awaiting fire data'} />
      <StatCard label="Forest zones monitored" value={zones.length || '—'} icon={MapPin} accent="green" note={zones.length ? 'Source: supplied zone boundaries' : 'Supply zones.geojson'} />
      <StatCard label="Average risk score" value={avgRisk == null ? '—' : number(avgRisk)} suffix={avgRisk == null ? '' : '/100'} icon={Gauge} accent={avgRisk >= 75 ? 'red' : avgRisk >= 50 ? 'orange' : 'green'} note={avgRisk == null ? 'Requires boundaries + complete factors' : 'Calculated from available zone factors'} />
      <StatCard label="Open alerts" value={fireFeedUsable ? newCount : '—'} icon={Activity} accent="red" note={fireFeedUsable ? 'Generated from loaded fire detections' : 'No verified fire feed available'} />
      <StatCard label="Fire stations nearby" value={stations.length || (sourceStatus.osm?.status === 'Live' ? 0 : '—')} icon={Siren} accent="amber" note={`${sourceStatus.osm?.source || 'OpenStreetMap'} · location real`} />
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.55fr_0.8fr]">
      <section className="card overflow-hidden"><div className="flex items-center justify-between gap-3 p-4 sm:p-5"><div><p className="eyebrow">Field map</p><h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Satellite detections & response context</h2></div><SourceLine source={`${sourceStatus.fires?.source || 'NASA FIRMS'} · ${sourceStatus.osm?.source || 'OSM'}`} status={sourceStatus.fires?.status} fetchedAt={sourceStatus.fires?.fetchedAt} /></div><div className="h-[350px] sm:h-[430px]"><MapView fires={fires} zones={zones} stations={stations} riskByName={riskLookup} center={REGION.center} zoom={REGION.zoom} /></div><div className="px-4 py-3 text-[10px] text-slate-400 sm:px-5">Map tiles: OpenHikingMap · OpenStreetMap contributors · Hazard interpretation depends on source coverage.</div></section>
      <div className="space-y-5">
        <section className="card p-4 sm:p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">Current conditions</p><h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{REGION.name} · region centroid</h2></div><CloudSun size={19} className="text-forest-600" /></div><div className="mt-4 grid grid-cols-2 gap-3">{[{ icon: CloudSun, name: 'Temperature', value: current == null ? '—' : `${number(current, 1)} °C` }, { icon: Droplets, name: 'Humidity', value: rh == null ? '—' : `${number(rh)}%` }, { icon: Wind, name: 'Wind speed', value: wind == null ? '—' : `${number(wind, 1)} m/s` }, { icon: Activity, name: 'Wind direction', value: direction == null ? '—' : `${number(direction)}°` }].map(({ icon: Icon, name, value }) => <div key={name} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70"><div className="flex items-center gap-1.5 text-[10px] text-slate-500"><Icon size={13} />{name}</div><p className="mt-1 text-base font-bold text-slate-900 dark:text-white">{value}</p></div>)}</div><p className="mt-3 text-[10px] text-slate-400">Source: {weatherSource?.source || 'Open-Meteo'} · Last updated {dateLabel(weatherSource?.fetchedAt)}</p></section>
        <section className="card p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><div><p className="eyebrow">Risk index</p><h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Zone score coverage</h2></div><Gauge size={18} className="text-amber-500" /></div>{avgRisk == null ? <EmptyState compact title="Risk score unavailable" description="Zone boundaries and the required real environmental factors are needed before a score can be calculated." /> : <div className="flex items-center gap-4"><div className="grid h-24 w-24 place-items-center rounded-full border-[10px]" style={{ borderColor: avgRisk >= 75 ? '#dc2626' : avgRisk >= 50 ? '#ea580c' : avgRisk >= 25 ? '#f59e0b' : '#16a34a' }}><span className="text-2xl font-bold">{number(avgRisk)}</span></div><div><RiskBadge score={avgRisk} /><p className="mt-2 text-xs text-slate-500">Weighted score, only when all factors are present.</p></div></div>}<p className="mt-2 text-[10px] text-slate-400">Source: FIRMS · Open-Meteo · NDVI / soil moisture · Last updated {dateLabel(lastUpdate)}</p></section>
      </div>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
      <ChartCard title="Fire detections · last 7 days" subtitle="Daily observations from the available FIRMS/history feed." source={sourceStatus.fires?.source} updatedAt={sourceStatus.fires?.fetchedAt}>
        {trendReady ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ left: -20, right: 8, top: 6 }}><defs><linearGradient id="fireFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ea580c" stopOpacity={0.25} /><stop offset="100%" stopColor="#ea580c" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ece7" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><Tooltip /><Area type="monotone" dataKey="detections" stroke="#ea580c" fill="url(#fireFill)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div> : <EmptyState compact title="No fire observations in the current feed" description="The real NASA feed needs a Map Key; the bundled real-history fallback is currently empty. Add the supplied CSV or configure a key." />}
      </ChartCard>
      <section className="card p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Alert feed</p><h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Latest detections</h2></div><button className="text-xs font-bold text-forest-700 dark:text-emerald-300" onClick={() => navigate('/alerts')}>View all <ArrowRight size={13} className="inline" /></button></div>{alerts.length ? <div className="space-y-3">{alerts.slice(0, 5).map((alert) => <button key={alert.id} onClick={() => navigate('/alerts')} className="flex w-full items-start justify-between gap-2 rounded-xl bg-slate-50 p-3 text-left hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800"><span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-800 dark:text-white">Satellite fire detection</span><span className="mt-1 block text-[10px] text-slate-500">{alert.latitude.toFixed(3)}, {alert.longitude.toFixed(3)} · {fireDateTime(alert)}</span></span><SeverityBadge level={alert.severity} /></button>)}</div> : <EmptyState compact title="No verified alerts" description="Alerts are created only from real loaded fire detections." />}</section>
    </div>

    <section className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div><p className="eyebrow">Response tools</p><h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Choose the next step</h2><p className="mt-1 text-xs text-slate-500">Operational resources and response times in this demo are simulated.</p></div><div className="flex flex-wrap gap-2"><button className="btn-quiet" onClick={() => navigate('/fire-engine')}><Siren size={15} /> Fire stations</button><button className="btn-quiet" onClick={() => navigate('/vulnerable-areas')}><MapPin size={15} /> Vulnerable areas</button><button className="btn-primary" onClick={() => navigate('/simulation')}><Flame size={15} /> Run spread simulation</button></div></section>
    <div className="text-right text-[10px] text-slate-400">{loading ? 'Refreshing public sources…' : `Dashboard refreshed ${dateLabel(refreshedAt)}`}</div>
  </div>;
}
