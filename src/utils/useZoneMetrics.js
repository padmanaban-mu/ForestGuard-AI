import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../context/DataContext.jsx';
import { geometryCenter } from './geo.js';
import { loadWeather } from '../services/weather.js';
import { computeZoneMetrics } from '../services/risk.js';

export function useZoneMetrics() {
  const { zones, fires, ndvi, sourceStatus, forceRefreshVersion = 0 } = useData();
  const [weatherRows, setWeatherRows] = useState([]); const [loading, setLoading] = useState(false);
  const lastForceRefreshVersion = useRef(forceRefreshVersion);
  useEffect(() => {
    let alive = true;
    const force = forceRefreshVersion !== lastForceRefreshVersion.current;
    lastForceRefreshVersion.current = forceRefreshVersion;
    if (!zones.length) { setWeatherRows([]); setLoading(false); return () => { alive = false; }; }
    setLoading(true);
    Promise.all(zones.map(async (zone, index) => {
      const name = zone.properties?.name || zone.properties?.zone || zone.properties?.district || zone.properties?.division || `Zone ${index + 1}`;
      const center = geometryCenter(zone.geometry);
      if (!center) return { name, weather: null, meta: { status: 'Fallback', source: 'Zone centroid unavailable', fetchedAt: null } };
      const result = await loadWeather(center, `zone-${encodeURIComponent(name)}`, { force });
      return { name, weather: result.weather, meta: result.meta };
    })).then((rows) => { if (alive) { setWeatherRows(rows); setLoading(false); } }).catch(() => { if (alive) { setWeatherRows([]); setLoading(false); } });
    return () => { alive = false; };
  }, [zones, forceRefreshVersion]);
  const usable = sourceStatus.fires?.status === 'Live' || sourceStatus.fires?.status === 'Cached' || fires.length > 0;
  const metrics = useMemo(() => computeZoneMetrics(zones, fires, weatherRows, ndvi, usable), [zones, fires, weatherRows, ndvi, usable]);
  const weatherSource = weatherRows.length ? weatherRows.find((row) => row.meta?.status === 'Live')?.meta || weatherRows[0].meta : null;
  return { metrics, weatherRows, loading, weatherSource };
}
