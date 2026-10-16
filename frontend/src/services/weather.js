import { REGION } from '../data/region.js';
import { fetchWithTimeout, getFreshCache, loadFallback, saveCache, state } from './cache.js';

const CACHE_TTL = 30 * 60 * 1000;
const rounded = (value) => Number(Number(value).toFixed(3));
export async function loadWeather(point = REGION.center, cacheId = 'region', { force = false } = {}) {
  const key = `forestguard:weather:${cacheId}:v1`;
  if (!force) { const cached = getFreshCache(key, CACHE_TTL); if (cached) return { weather: cached.data, meta: state(cached.status, cached.source, cached.fetchedAt, cached.error) }; }
  try {
    const params = new URLSearchParams({ latitude: rounded(point[0]), longitude: rounded(point[1]), current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m', hourly: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,soil_moisture_0_to_7cm', forecast_days: '7', timezone: 'auto', wind_speed_unit: 'ms' });
    const response = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?${params}`); if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}`);
    const data = await response.json(); if (!data?.current) throw new Error('Open-Meteo response had no current weather');
    const saved = saveCache(key, data, 'Open-Meteo'); return { weather: data, meta: state('Live', saved.source, saved.fetchedAt) };
  } catch (error) {
    try { const fallback = await loadFallback('/data/weather.json'); const weather = { ...fallback, latitude: point[0], longitude: point[1] }; const saved = saveCache(key, weather, 'Local weather.json (empty)', { status: 'Fallback', error }); return { weather, meta: state('Fallback', saved.source, saved.fetchedAt, error) }; }
    catch (fallbackError) { return { weather: { current: null, hourly: { time: [] }, latitude: point[0], longitude: point[1] }, meta: state('Fallback', 'No offline weather available', null, `${error.message}; ${fallbackError.message}`) }; }
  }
}
export const weatherValue = (weather, field) => { const value = weather?.current?.[field]; return value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value); };
