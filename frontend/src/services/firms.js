import Papa from 'papaparse';
import { getRecentFires } from './api.js';
import { boxAsString } from '../data/region.js';
import { fetchWithTimeout, getFreshCache, loadFallback, saveCache, state } from './cache.js';

const CACHE_KEY = 'forestguard:fires:v1';
const CACHE_TTL = 30 * 60 * 1000;
const confidenceRank = (raw) => {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'n' || value === 'nominal') return 25;
  if (value === 'l' || value === 'low') return 55;
  if (value === 'h' || value === 'high') return 85;
  const numeric = Number(value);
  return Number.isFinite(numeric) && value !== '' ? numeric : null;
};
export function normalizeFire(row) {
  const get = (name, fallback = '') => row[name] ?? row[name.toUpperCase()] ?? row[name.toLowerCase()] ?? fallback;
  const latitude = Number(get('latitude')); const longitude = Number(get('longitude'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const rawConf = get('confidence'); const rawTime = String(get('acq_time', '')).replace(/\D/g, '').padStart(4, '0').slice(-4); const rawFrp = get('frp'); const rawBrightness = get('bright_ti4'); const acqDate = String(get('acq_date', ''));
  const frp = rawFrp == null || rawFrp === '' || !Number.isFinite(Number(rawFrp)) ? null : Number(rawFrp);
  const brightness = rawBrightness == null || rawBrightness === '' || !Number.isFinite(Number(rawBrightness)) ? null : Number(rawBrightness);
  const district = get('district') || null;
  const mixedAgricultural = Boolean(row.mixed_agricultural ?? row.mixedAgricultural);
  return { id: `${latitude.toFixed(4)}-${longitude.toFixed(4)}-${acqDate}-${rawTime}-${get('satellite', 'VIIRS')}`, latitude, longitude, brightness, frp, confidence: rawConf === '' ? null : String(rawConf), confidenceRank: confidenceRank(rawConf), satellite: String(get('satellite', 'Unknown')), instrument: String(get('instrument', 'VIIRS')), acqDate: acqDate || null, acqTime: rawTime || null, dayNight: String(get('daynight', 'Unknown')).toUpperCase(), district, mixedAgricultural };
}
export function parseFirmsCsv(text) { const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', dynamicTyping: false }); return (parsed.data || []).map(normalizeFire).filter(Boolean); }

async function readHistory() { return parseFirmsCsv(await loadFallback('/data/fires_history.csv', 'text')); }

export async function loadFires({ force = false } = {}) {
  if (!force) {
    const cached = getFreshCache(CACHE_KEY, CACHE_TTL);
    if (cached) return { fires: cached.data, meta: state(cached.status, cached.source, cached.fetchedAt, cached.error) };
  }

  try {
    const res = await getRecentFires(72);
    if (res.ok && res.data) {
      if (res.data.status === 'not_configured') {
        const reason = 'NASA FIRMS Map Key is not configured in backend/.env; active satellite detections are unavailable.';
        const fires = await readHistory().catch(() => []);
        const saved = saveCache(CACHE_KEY, fires, 'Local fires_history.csv', { status: 'Fallback', error: reason });
        return { fires, meta: state('Fallback', 'NASA FIRMS key not configured in backend/.env', saved.fetchedAt, reason) };
      }

      const fires = (res.data.fires || []).map(normalizeFire).filter(Boolean);
      const saved = saveCache(CACHE_KEY, fires, 'NASA FIRMS VIIRS_SNPP_NRT');
      return { fires, meta: state('Live', 'NASA FIRMS · VIIRS_SNPP_NRT', saved.fetchedAt) };
    }

    // Backend returned an error response
    throw new Error(res.error || 'Failed to retrieve active fire records from backend.');
  } catch (error) {
    try {
      const fires = await readHistory();
      const saved = saveCache(CACHE_KEY, fires, 'Local fires_history.csv', { status: 'Fallback', error });
      return { fires, meta: state('Fallback', saved.source, saved.fetchedAt, error) };
    } catch (fallbackError) {
      return { fires: [], meta: state('Fallback', 'No fire data available', null, `${error.message}; fallback: ${fallbackError.message}`) };
    }
  }
}
export function withinLastHours(fires, hours) {
  const cutoff = Date.now() - hours * 3600000;
  return fires.filter((fire) => { if (!fire.acqDate) return false; const hhmm = String(fire.acqTime || '0000').padStart(4, '0'); const date = new Date(`${fire.acqDate}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`).getTime(); return Number.isFinite(date) && date >= cutoff; });
}
