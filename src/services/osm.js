import { REGION } from '../data/region.js';
import { fetchWithTimeout, getFreshCache, loadFallback, saveCache, state } from './cache.js';

const CACHE_KEY = 'forestguard:osm:region:v1'; const CACHE_TTL = 6 * 60 * 60 * 1000;
const bboxQL = () => { const [west, south, east, north] = REGION.bbox; return `${south},${west},${north},${east}`; };
function elementsToFeatures(elements = []) {
  return elements.flatMap((item) => {
    const tags = item.tags || {}; const lat = item.lat ?? item.center?.lat; const lon = item.lon ?? item.center?.lon;
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return [];
    const type = tags.amenity === 'fire_station' ? 'station' : ['village', 'town'].includes(tags.place) ? 'settlement' : null; if (!type) return [];
    return [{ type: 'Feature', id: `osm-${item.type}-${item.id}`, geometry: { type: 'Point', coordinates: [Number(lon), Number(lat)] }, properties: { osmType: item.type, osmId: item.id, name: tags.name || (type === 'station' ? 'Unnamed OSM fire station' : 'Unnamed settlement'), type, amenity: tags.amenity || null, place: tags.place || null, district: tags['addr:district'] || tags['is_in:district'] || null, phone: tags.phone || tags['contact:phone'] || null, operator: tags.operator || null, address: [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', ') || null } }];
  });
}
const splitFeatures = (features) => ({ stations: features.filter((f) => f.properties?.type === 'station'), settlements: features.filter((f) => f.properties?.type === 'settlement') });
export async function loadOsm({ force = false } = {}) {
  if (!force) { const cached = getFreshCache(CACHE_KEY, CACHE_TTL); if (cached) return { ...cached.data, meta: state(cached.status, cached.source, cached.fetchedAt, cached.error) }; }
  const area = bboxQL(); const query = `[out:json][timeout:25];(node[amenity=fire_station](${area});way[amenity=fire_station](${area});relation[amenity=fire_station](${area});node[place~"^(village|town)$"](${area});way[place~"^(village|town)$"](${area});relation[place~"^(village|town)$"](${area}););out center tags;`;
  try {
    const response = await fetchWithTimeout('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: `data=${encodeURIComponent(query)}` }, 22000);
    if (!response.ok) throw new Error(`Overpass returned HTTP ${response.status}`);
    const result = await response.json(); const features = elementsToFeatures(result.elements); const data = splitFeatures(features); const saved = saveCache(CACHE_KEY, data, 'OpenStreetMap Overpass');
    return { ...data, meta: state('Live', saved.source, saved.fetchedAt) };
  } catch (error) {
    try {
      const fallback = await loadFallback('/data/fire_stations.geojson'); const features = Array.isArray(fallback.features) ? fallback.features.map((f) => ({ ...f, properties: { ...f.properties, type: f.properties?.type || 'station' } })) : [];
      const data = splitFeatures(features); const saved = saveCache(CACHE_KEY, data, 'Local fire_stations.geojson', { status: 'Fallback', error });
      return { ...data, meta: state('Fallback', saved.source, saved.fetchedAt, error) };
    } catch (fallbackError) { return { stations: [], settlements: [], meta: state('Fallback', 'No station data available', null, `${error.message}; ${fallbackError.message}`) }; }
  }
}
