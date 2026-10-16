import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loadFires } from '../services/firms.js';
import { loadWeather } from '../services/weather.js';
import { loadOsm } from '../services/osm.js';
import { loadNdvi, loadZones } from '../services/risk.js';
import { REGION } from '../data/region.js';

const DataContext = createContext(null);
const empty = { fires: [], weather: { current: null, hourly: { time: [] } }, stations: [], settlements: [], zones: [], ndvi: [], sourceStatus: {}, loading: true, refreshedAt: null, forceRefreshVersion: 0 };
export function DataProvider({ children }) {
  const [data, setData] = useState(empty); const ran = useRef(false);
  const refresh = useCallback(async ({ force = false } = {}) => {
    setData((current) => ({ ...current, loading: true, forceRefreshVersion: current.forceRefreshVersion + (force ? 1 : 0) }));
    const jobs = await Promise.allSettled([loadFires({ force }), loadWeather(REGION.center, 'region', { force }), loadOsm({ force }), loadZones({ force }), loadNdvi({ force })]);
    const [fireResult, weatherResult, osmResult, zoneResult, ndviResult] = jobs;
    const fires = fireResult.status === 'fulfilled' ? fireResult.value : { fires: [], meta: { status: 'Fallback', source: 'Fire data unavailable', error: fireResult.reason?.message } };
    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : { weather: empty.weather, meta: { status: 'Fallback', source: 'Weather data unavailable', error: weatherResult.reason?.message } };
    const osm = osmResult.status === 'fulfilled' ? osmResult.value : { stations: [], settlements: [], meta: { status: 'Fallback', source: 'OSM unavailable', error: osmResult.reason?.message } };
    const zones = zoneResult.status === 'fulfilled' ? zoneResult.value : { data: [], meta: { status: 'Fallback', source: 'Zone dataset unavailable', error: zoneResult.reason?.message } };
    const ndvi = ndviResult.status === 'fulfilled' ? ndviResult.value : { data: [], meta: { status: 'Fallback', source: 'NDVI dataset unavailable', error: ndviResult.reason?.message } };
    setData((current) => ({ ...current, fires: fires.fires, weather: weather.weather, stations: osm.stations, settlements: osm.settlements, zones: zones.data, ndvi: ndvi.data, sourceStatus: { fires: fires.meta, weather: weather.meta, osm: osm.meta, zones: zones.meta, ndvi: ndvi.meta }, loading: false, refreshedAt: new Date().toISOString() }));
  }, []);
  useEffect(() => { if (!ran.current) { ran.current = true; refresh(); } }, [refresh]);
  const value = useMemo(() => ({ ...data, refresh }), [data, refresh]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
export const useData = () => useContext(DataContext);
