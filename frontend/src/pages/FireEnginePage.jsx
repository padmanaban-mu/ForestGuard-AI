import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Clock3, Droplets, MapPin, Navigation, RefreshCw, Siren, Users } from 'lucide-react';
import { ChartCard, DataNote, Drawer, EmptyState, Modal, PageHeader, SourceLine, StatCard, StatusBadge, useToast } from '../components/ui.jsx';
import MapView from '../components/MapView.jsx';
import { useData } from '../context/DataContext.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { haversineMeters } from '../utils/geo.js';
import { number } from '../utils/formatters.js';
import { REGION } from '../data/region.js';

const STATUSES = ['Available', 'Dispatched', 'Returning', 'Maintenance'];
function stableSeed(station, index) {
  const id = String(station.properties?.osmId || station.id || index);
  let hash = 0; for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}
function simulatedStation(station, index, dispatched) {
  const seed = stableSeed(station, index);
  return { status: dispatched ? 'Dispatched' : STATUSES[seed % STATUSES.length], crew: 4 + seed % 5, water: 45 + (seed * 17) % 56 };
}
export default function FireEnginePage() {
  const { stations, fires, sourceStatus, loading, refresh } = useData(); const { dispatch } = useAlerts(); const { user, role } = useAuth(); const toast = useToast(); const location = useLocation();
  const [filter, setFilter] = useState('All'); const [fireId, setFireId] = useState(location.state?.fireId || fires[0]?.id || ''); const [modalOpen, setModalOpen] = useState(false); const [selected, setSelected] = useState(null); const [dispatched, setDispatched] = useState([]);
  const fire = fires.find((f) => f.id === fireId) || null;
  const rows = useMemo(() => stations.map((station, index) => {
    const [lon, lat] = station.geometry.coordinates; const status = simulatedStation(station, index, dispatched.includes(station.id));
    const distanceKm = fire ? haversineMeters([fire.latitude, fire.longitude], [lat, lon]) / 1000 : null;
    // Estimated road response is only a transparent straight-line proxy, not routing or an actual ETA.
    const etaMinutes = distanceKm == null ? null : 5 + distanceKm / 30 * 60;
    return { station, index, lat, lon, distanceKm, etaMinutes, ...status };
  }).sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)), [stations, fire, dispatched]);
  const visible = rows.filter((r) => filter === 'All' || r.status === filter);
  const nearest = fire ? rows[0] : null;
  const confirmDispatch = () => {
    if (!selected || !fire) return;
    setDispatched((current) => current.includes(selected.station.id) ? current : [...current, selected.station.id]);
    dispatch(fire.id); setModalOpen(false); toast('Simulated dispatch recorded in this browser.');
  };
  return <div className="space-y-6">
    <PageHeader eyebrow="Response readiness" title="Fire engine stations" subtitle="Real station locations from OpenStreetMap, with explicitly simulated resource readiness and response estimates." action={<button className="btn-quiet" onClick={() => refresh({ force: true })}><RefreshCw size={15} /> Refresh OSM</button>} />
    <DataNote><strong>Simulated:</strong> availability, dispatch/return/maintenance status, crew count, water level and ETA. ETA uses straight-line distance at an assumed 30 km/h plus 5 minutes; it is not a road-routing or emergency dispatch system.</DataNote>
    {sourceStatus.osm?.error && <DataNote>{sourceStatus.osm.error}</DataNote>}
    <div className="grid gap-3 sm:grid-cols-3"><StatCard label="OSM fire stations" value={stations.length || (sourceStatus.osm?.status === 'Live' ? 0 : '—')} icon={Siren} accent="blue" note={sourceStatus.osm?.source || 'OpenStreetMap'} /><StatCard label="Nearest station" value={nearest?.station.properties?.name || (stations.length ? 'Select a detection' : '—')} icon={Navigation} accent="green" note={nearest ? `${number(nearest.distanceKm, 1)} km · straight-line` : 'Real detection required'} /><StatCard label="Estimated arrival" value={nearest ? number(nearest.etaMinutes) : '—'} suffix={nearest ? 'min · simulated' : ''} icon={Clock3} accent="amber" note={nearest ? 'At assumed 30 km/h + 5 min dispatch' : 'Requires fire detection and station'} /></div>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <ChartCard title="Station & fire detection map" subtitle="Pins are live OSM locations and available satellite observations." source={`${sourceStatus.osm?.source || 'OpenStreetMap'} · ${sourceStatus.fires?.source || 'NASA FIRMS'}`} updatedAt={sourceStatus.osm?.fetchedAt} className="!p-0"><div className="h-[370px] overflow-hidden rounded-b-2xl"><MapView fires={fires} stations={stations} center={REGION.center} zoom={REGION.zoom} /></div></ChartCard>
      <section className="card p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Dispatch suggestion</p><h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Nearest station to a detection</h2></div><Siren size={19} className="text-forest-700 dark:text-emerald-300" /></div><label className="mt-4 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="fire-target">Fire detection</label><select className="control mt-2 w-full" id="fire-target" value={fireId} onChange={(e) => setFireId(e.target.value)}><option value="">Select a loaded detection</option>{fires.map((f) => <option key={f.id} value={f.id}>{f.acqDate} · {f.latitude.toFixed(3)}, {f.longitude.toFixed(3)} · {f.satellite}</option>)}</select>{nearest ? <div className="mt-4 rounded-xl bg-forest-50 p-4 dark:bg-forest-900/30"><p className="text-[10px] font-bold uppercase tracking-wider text-forest-700 dark:text-emerald-300">Nearest · simulated ETA</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{nearest.station.properties?.name || 'Unnamed OSM station'}</p><p className="mt-1 text-xs text-slate-500">{number(nearest.distanceKm, 1)} km straight-line · ~{number(nearest.etaMinutes)} min estimated</p><button className="btn-primary mt-4 w-full" onClick={() => { setSelected(nearest); setModalOpen(true); }}>Review dispatch <Navigation size={15} /></button></div> : <EmptyState compact icon={MapPin} title="No selected detection" description={fires.length ? 'Select a real NASA/local fire record to compare station distance.' : 'No fire detections are loaded. Configure FIRMS or supply real history first.'} />}</section>
    </div>
    <section className="card overflow-hidden"><div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><p className="eyebrow">Verified locations · simulated readiness</p><h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Fire station directory</h2><SourceLine source={sourceStatus.osm?.source} status={sourceStatus.osm?.status} fetchedAt={sourceStatus.osm?.fetchedAt} /></div><select aria-label="Filter station status" className="control w-full sm:w-48" value={filter} onChange={(e) => setFilter(e.target.value)}><option>All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
      {loading ? <div className="p-6 text-sm text-slate-500">Loading OpenStreetMap stations…</div> : visible.length === 0 ? <EmptyState title="No station records available" description={stations.length ? 'No stations match this simulated status filter.' : 'The Overpass query returned no usable stations, or the fallback GeoJSON is empty.'} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Station · real OSM location</th><th>Coordinates</th><th>Readiness · simulated</th><th>Crew · simulated</th><th>Water · simulated</th><th>Distance / ETA</th><th></th></tr></thead><tbody>{visible.map((row) => <tr key={row.station.id}><td><span className="font-semibold text-slate-800 dark:text-slate-100">{row.station.properties?.name || 'Unnamed station'}</span><span className="block text-[10px] text-slate-400">{row.station.properties?.district || row.station.properties?.address || 'OSM tags not provided'}</span></td><td className="font-mono text-[11px]">{row.lat.toFixed(4)}, {row.lon.toFixed(4)}</td><td><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${row.status === 'Available' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : row.status === 'Dispatched' ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>{row.status} · Simulated</span></td><td><span className="inline-flex items-center gap-1 text-xs"><Users size={13} />{row.crew}</span></td><td><span className="inline-flex items-center gap-1 text-xs"><Droplets size={13} />{row.water}%</span></td><td>{row.distanceKm == null ? '—' : <span className="text-xs">{number(row.distanceKm, 1)} km<br /><span className="text-[10px] text-slate-400">~{number(row.etaMinutes)} min sim.</span></span>}</td><td><button disabled={!fire} className="btn-quiet !px-3 !py-1.5" onClick={() => { setSelected(row); setModalOpen(true); }}>Dispatch</button></td></tr>)}</tbody></table></div>}</section>
    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Review simulated dispatch"><p className="text-sm text-slate-600 dark:text-slate-300">The selected real detection is at <strong>{fire?.latitude.toFixed(4)}, {fire?.longitude.toFixed(4)}</strong>.</p>{selected && <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="text-sm font-bold">{selected.station.properties?.name || 'Unnamed OSM fire station'}</p><p className="mt-2 text-xs text-slate-500">Real station coordinates are sourced from OpenStreetMap. Distance {number(selected.distanceKm, 1)} km; estimated {number(selected.etaMinutes)} min (simulated straight-line proxy).</p></div>}<div className="mt-5 flex justify-end gap-2"><button className="btn-quiet" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" onClick={confirmDispatch} disabled={!fire || !selected}>Confirm simulated dispatch</button></div><p className="mt-3 text-[10px] text-slate-400">User: {user} · {role || 'Guest'} · No real dispatch is transmitted.</p></Modal>
  </div>;
}
