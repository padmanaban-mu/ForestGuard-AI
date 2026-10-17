import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Leaf, Thermometer } from 'lucide-react';
import { ChartCard, DataNote, Drawer, EmptyState, PageHeader, RiskBadge, SourceLine, StatCard } from '../components/ui.jsx';
import { useData } from '../context/DataContext.jsx';
import { useZoneMetrics } from '../utils/useZoneMetrics.js';
import { number } from '../utils/formatters.js';

const clamp = (value) => Math.max(0, Math.min(100, value));
const numeric = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
function scoreZoneHealth(metric, weather) {
  const current = weather?.current || {};
  const ndvi = numeric(metric.ndvi);
  const soilRaw = numeric(weather?.hourly?.soil_moisture_0_to_7cm?.[0]);
  const humidity = numeric(current.relative_humidity_2m);
  const temperature = numeric(current.temperature_2m);
  const rainfall = numeric(current.precipitation);
  const inputs = [ndvi, soilRaw, humidity, temperature, rainfall];
  const soilMoisture = soilRaw != null ? (soilRaw <= 1 ? soilRaw * 100 : soilRaw) : null;
  if (inputs.some((value) => value == null)) return { ...metric, soilMoisture, temperature, rainfall, healthScore: null };
  const vegetation = clamp(ndvi * 100);
  const moisture = clamp(soilMoisture);
  const humiditySupport = clamp(humidity);
  const thermalComfort = clamp(100 - Math.abs(temperature - 20) * 3);
  const rainfallSupport = clamp(rainfall / 10 * 100);
  const healthScore = clamp(0.30 * vegetation + 0.25 * moisture + 0.20 * humiditySupport + 0.15 * thermalComfort + 0.10 * rainfallSupport);
  return { ...metric, soilMoisture, temperature, rainfall, healthScore };
}

export default function ForestHealthPage() {
  const { ndvi, sourceStatus } = useData();
  const { metrics, weatherRows, loading, weatherSource } = useZoneMetrics();
  const [selected, setSelected] = useState(null);
  const healthMetrics = useMemo(() => metrics.map((metric) => scoreZoneHealth(metric, weatherRows.find((row) => row.name === metric.name)?.weather)), [metrics, weatherRows]);
  const chartNdvi = useMemo(() => ndvi.slice().sort((a, b) => String(a.month).localeCompare(String(b.month))).map((row) => ({ ...row, ndvi: Number(row.ndvi), month: String(row.month).slice(0, 7) })), [ndvi]);
  const comparison = healthMetrics.filter((metric) => metric.healthScore != null).map((metric) => ({ zone: metric.name, health: Math.round(metric.healthScore) }));
  const dryData = healthMetrics.map((metric) => ({ zone: metric.name, dryness: metric.dryness, soilMoisture: metric.soilMoisture })).filter((row) => row.dryness != null || row.soilMoisture != null);
  const avgHealth = comparison.length ? comparison.reduce((sum, row) => sum + row.health, 0) / comparison.length : null;
  const getWeather = (metric) => weatherRows.find((row) => row.name === metric.name)?.weather;
  const selectedWeather = selected ? getWeather(selected) : null;
  return <div className="space-y-6">
    <PageHeader eyebrow="Environmental conditions" title="Forest health" subtitle="Zone-level health is scored only when all five named, real inputs are available." />
    {(loading || sourceStatus.zones?.error || sourceStatus.ndvi?.error) && <DataNote>{loading ? 'Loading Open-Meteo for real zone centroids…' : `${sourceStatus.zones?.error || ''} ${sourceStatus.ndvi?.error || ''}`}</DataNote>}
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard label="Zones with boundaries" value={metrics.length || '—'} icon={Leaf} note={metrics.length ? 'Source: supplied GeoJSON' : 'No zones.geojson supplied'} />
      <StatCard label="Average health score" value={avgHealth == null ? '—' : number(avgHealth)} suffix={avgHealth == null ? '' : '/100'} icon={Leaf} accent="green" note={avgHealth == null ? 'Requires all five real inputs' : 'Weighted five-factor index'} />
      <StatCard label="NDVI observations" value={ndvi.length || '—'} icon={Thermometer} accent="amber" note={ndvi.length ? 'Source: supplied monthly CSV' : 'No ndvi.csv supplied'} />
    </div>
    <DataNote><strong>Measured inputs:</strong> monthly NDVI and zone boundaries from the supplied files, plus soil moisture, humidity, temperature and current precipitation from Open-Meteo at real zone centroids. Health index = 0.30 × NDVI support + 0.25 × soil moisture + 0.20 × humidity + 0.15 × temperature comfort + 0.10 × rainfall support (each normalized 0–100). Temperature comfort = clamp(100 − 3 × |°C − 20|); rainfall support saturates at 10 mm. Any missing input leaves the score unavailable. This is an educational index, not a forestry survey.</DataNote>
    <div className="grid gap-5 xl:grid-cols-2">
      <ChartCard title="Vegetation trend · NDVI" subtitle="Monthly observations from the supplied zone CSV only." source={sourceStatus.ndvi?.source} updatedAt={sourceStatus.ndvi?.fetchedAt}>{chartNdvi.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartNdvi} margin={{ left: -20, right: 10, top: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ece7" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><YAxis domain={[0, 1]} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><Tooltip /><Line type="monotone" dataKey="ndvi" name="NDVI" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div> : <EmptyState compact title="No NDVI observations" description="Add authentic monthly values to public/data/ndvi.csv (zone, month, ndvi)." />}</ChartCard>
      <ChartCard title="Moisture vs dryness" subtitle="Dryness = 100 − soil moisture (%), or 100 − NDVI (% scale)." source="Open-Meteo · supplied NDVI" updatedAt={weatherSource?.fetchedAt}>{dryData.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={dryData} margin={{ left: -20, right: 10, top: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ece7" /><XAxis dataKey="zone" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><Tooltip /><Bar dataKey="soilMoisture" name="Soil moisture (%)" fill="#3b82f6" radius={[5, 5, 0, 0]} /><Bar dataKey="dryness" name="Dryness index (%)" fill="#ea580c" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState compact title="No moisture measurements" description="A zone boundary dataset with usable centroids is needed to query Open-Meteo by zone." />}</ChartCard>
    </div>
    <ChartCard title="Zone health comparison" subtitle="Only zones with all five measured inputs receive a score." source="Supplied NDVI · Open-Meteo soil moisture/humidity/temperature/precipitation" updatedAt={weatherSource?.fetchedAt}>{comparison.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison} margin={{ left: -15, right: 10, top: 10 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ece7" /><XAxis dataKey="zone" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><Tooltip /><Bar dataKey="health" name="Health score" fill="#16a34a" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState compact title="No complete zone scores" description="Supply zones.geojson, ndvi.csv, and Open-Meteo observations for soil moisture, humidity, temperature and rainfall." />}</ChartCard>
    <section className="card overflow-hidden"><div className="p-4 sm:p-5"><p className="eyebrow">Zone inventory</p><h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Five-input health summary</h2><SourceLine source="User zones · NDVI · Open-Meteo" status={sourceStatus.ndvi?.status} fetchedAt={sourceStatus.ndvi?.fetchedAt} /></div>{healthMetrics.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Zone</th><th>NDVI</th><th>Soil</th><th>Humidity</th><th>Temp.</th><th>Rain</th><th>Wind</th><th>Health</th></tr></thead><tbody>{healthMetrics.map((metric) => <tr key={metric.name} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setSelected(metric)}><td className="font-semibold">{metric.name}</td><td>{metric.ndvi == null ? '—' : number(metric.ndvi, 2)}</td><td>{metric.soilMoisture == null ? '—' : `${number(metric.soilMoisture)}%`}</td><td>{metric.humidity == null ? '—' : `${number(metric.humidity)}%`}</td><td>{metric.temperature == null ? '—' : `${number(metric.temperature, 1)}°`}</td><td>{metric.rainfall == null ? '—' : `${number(metric.rainfall, 1)}mm`}</td><td>{metric.windMs == null ? '—' : `${number(metric.windMs, 1)} m/s`}</td><td>{metric.healthScore == null ? <RiskBadge score={null} /> : <span className="font-bold">{number(metric.healthScore)}/100</span>}</td></tr>)}</tbody></table></div> : <EmptyState title="No forest zones loaded" description="No zones.geojson was attached. The valid empty fallback is ready for your real boundary file." />}</section>
    <Drawer open={Boolean(selected)} title={selected?.name || 'Zone detail'} onClose={() => setSelected(null)}>{selected && <div className="space-y-5"><div className="rounded-xl bg-forest-50 p-4 dark:bg-forest-900/30"><p className="eyebrow">Calculated health · 5 measured inputs</p><p className="mt-2 text-3xl font-bold text-forest-800 dark:text-emerald-300">{selected.healthScore == null ? '—' : `${number(selected.healthScore)}/100`}</p><p className="mt-1 text-xs text-slate-500">The score remains blank if NDVI, soil moisture, humidity, temperature or rainfall is missing.</p></div><div className="grid grid-cols-2 gap-3">{[['NDVI', selected.ndvi == null ? '—' : number(selected.ndvi, 2)], ['Soil moisture', selected.soilMoisture == null ? '—' : `${number(selected.soilMoisture)}%`], ['Humidity', selected.humidity == null ? '—' : `${number(selected.humidity)}%`], ['Temperature', selected.temperature == null ? '—' : `${number(selected.temperature, 1)} °C`], ['Current rainfall', selected.rainfall == null ? '—' : `${number(selected.rainfall, 1)} mm`], ['Wind', selected.windMs == null ? '—' : `${number(selected.windMs, 1)} m/s`]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 font-bold">{value}</p></div>)}</div><p className="text-xs text-slate-500">Zone weather source: {weatherRows.find((row) => row.name === selected.name)?.meta?.source || 'No centroid weather loaded'}.</p></div>}</Drawer>
  </div>;
}
