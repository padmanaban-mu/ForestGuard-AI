import Papa from 'papaparse';
import { getFreshCache, loadFallback, saveCache, state } from './cache.js';
import { pointInGeometry, geometryCenter } from '../utils/geo.js';

export const RISK_WEIGHTS = { frequency: 0.35, inverseHumidity: 0.25, wind: 0.2, dryness: 0.2 };
const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const numericOrNull = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
export function normalizeRiskFactor({ fireCount, maxFireCount, humidity, windMs, ndvi, soilMoisture }) {
  const frequency = Number.isFinite(fireCount) && maxFireCount != null ? (maxFireCount ? clamp(fireCount / maxFireCount * 100) : 0) : null;
  const inverseHumidity = Number.isFinite(humidity) ? clamp(100 - humidity) : null;
  const wind = Number.isFinite(windMs) ? clamp(windMs / 20 * 100) : null;
  let dryness = null;
  if (Number.isFinite(soilMoisture)) { const moisturePct = soilMoisture <= 1 ? soilMoisture * 100 : soilMoisture; dryness = clamp(100 - moisturePct); }
  else if (Number.isFinite(ndvi)) { const ndviPct = ndvi <= 1 ? ndvi * 100 : ndvi; dryness = clamp(100 - ndviPct); }
  const factors = { frequency, inverseHumidity, wind, dryness };
  const complete = Object.values(factors).every(Number.isFinite);
  const score = complete ? clamp(RISK_WEIGHTS.frequency * frequency + RISK_WEIGHTS.inverseHumidity * inverseHumidity + RISK_WEIGHTS.wind * wind + RISK_WEIGHTS.dryness * dryness) : null;
  return { factors, score, complete };
}
export async function loadNdvi({ force = false } = {}) {
  const key = 'forestguard:ndvi:user-file:v1';
  if (!force) { const cached = getFreshCache(key, 24 * 60 * 60 * 1000); if (cached) return { data: cached.data, meta: state(cached.status, cached.source, cached.fetchedAt, cached.error) }; }
  try {
    const csv = await loadFallback('/data/ndvi.csv', 'text'); const parsed = Papa.parse(csv, { header: true, skipEmptyLines: 'greedy', dynamicTyping: true });
    const data = (parsed.data || []).filter((row) => row.zone && row.month && row.ndvi != null && row.ndvi !== '' && Number.isFinite(Number(row.ndvi))); const error = data.length ? null : 'No NDVI measurements supplied.';
    const saved = saveCache(key, data, 'Local ndvi.csv', { status: 'Fallback', error });
    return { data, meta: state('Fallback', saved.source, saved.fetchedAt, error) };
  } catch (error) { return { data: [], meta: state('Fallback', 'Local NDVI file unavailable', null, error) }; }
}
export async function loadZones({ force = false } = {}) {
  const key = 'forestguard:zones:user-file:v1';
  if (!force) { const cached = getFreshCache(key, 24 * 60 * 60 * 1000); if (cached) return { data: cached.data, meta: state(cached.status, cached.source, cached.fetchedAt, cached.error) }; }
  try {
    const data = await loadFallback('/data/zones.geojson'); const features = data?.type === 'FeatureCollection' && Array.isArray(data.features) ? data.features.filter((f) => f.geometry) : [];
    const error = features.length ? null : 'No zone boundaries supplied.'; const saved = saveCache(key, features, 'Local zones.geojson', { status: 'Fallback', error });
    return { data: features, meta: state('Fallback', saved.source, saved.fetchedAt, error) };
  } catch (error) { return { data: [], meta: state('Fallback', 'Local zone file unavailable', null, error) }; }
}
export function zoneName(zone, index = 0) { const p = zone?.properties || {}; return p.name || p.zone || p.district || p.division || `Zone ${index + 1}`; }
export function computeZoneMetrics(zones, fires, weatherRows = [], ndviRows = [], fireSourceUsable = false, sharedFrequencyMax = null) {
  const counts = zones.map((zone) => fireSourceUsable ? fires.filter((fire) => pointInGeometry([fire.latitude, fire.longitude], zone.geometry)).length : null);
  const max = sharedFrequencyMax == null ? Math.max(0, ...counts.filter(Number.isFinite)) : sharedFrequencyMax;
  return zones.map((zone, index) => {
    const name = zoneName(zone, index); const center = geometryCenter(zone.geometry);
    const containedFires = fireSourceUsable ? fires.filter((fire) => pointInGeometry([fire.latitude, fire.longitude], zone.geometry)) : [];
    const weather = weatherRows.find((row) => row.name === name || row.name === zoneName(zone, index));
    const humidity = numericOrNull(weather?.weather?.current?.relative_humidity_2m); const windMs = numericOrNull(weather?.weather?.current?.wind_speed_10m);
    const ndvi = numericOrNull(ndviRows.filter((r) => String(r.zone).toLowerCase() === name.toLowerCase()).sort((a, b) => String(b.month).localeCompare(String(a.month)))[0]?.ndvi);
    const soilMoisture = numericOrNull(weather?.weather?.hourly?.soil_moisture_0_to_7cm?.[0]);
    const result = normalizeRiskFactor({ fireCount: counts[index], maxFireCount: max, humidity, windMs, ndvi, soilMoisture });
    const frps = containedFires.map((fire) => fire.frp).filter(Number.isFinite); const dates = containedFires.map((fire) => fire.acqDate).filter(Boolean).sort();
    const daysSinceLastFire = dates.length ? Math.max(0, Math.floor((Date.now() - new Date(`${dates.at(-1)}T00:00:00Z`)) / 86400000)) : null;
    return { zone, name, center, fireCount: counts[index], averageFrp: frps.length ? frps.reduce((a, b) => a + b, 0) / frps.length : null, daysSinceLastFire, humidity, windMs, ndvi, dryness: result.factors.dryness, score: result.score, factors: result.factors, complete: result.complete };
  });
}
