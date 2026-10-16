import { CircleMarker, GeoJSON, MapContainer, Polygon, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { REGION } from '../data/region.js';
import { riskColor, riskLabel } from '../utils/formatters.js';

function PickHandler({ enabled, onPick }) {
  useMapEvents({ click(e) { if (enabled) onPick?.([e.latlng.lat, e.latlng.lng]); } });
  return null;
}
const firePos = (fire) => [fire.latitude, fire.longitude];
export default function MapView({ fires = [], stations = [], settlements = [], zones = [], onPick, pickEnabled = false, ignition = null, spreadPolygon = [], riskByName = {}, center = REGION.center, zoom = REGION.zoom, className = '', selectedFire = null }) {
  const features = zones.map((zone, index) => {
    const name = zone.properties?.name || zone.properties?.zone || zone.properties?.district || zone.properties?.division || `Zone ${index + 1}`;
    const score = riskByName[name];
    return { ...zone, properties: { ...zone.properties, _displayName: name, _riskScore: score } };
  });
  const styleZone = (feature) => { const color = riskColor(feature.properties?._riskScore); return { color, fillColor: color, weight: 1.5, opacity: 0.85, fillOpacity: 0.22 }; };
  return <div className={`relative overflow-hidden rounded-2xl ${className}`}>
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full min-h-[280px] w-full" aria-label="Interactive forest monitoring map">
      <PickHandler enabled={pickEnabled} onPick={onPick} />
      <TileLayer attribution='&copy; <a href="https://wiki.openstreetmap.org/wiki/OpenHikingMap">OpenHikingMap</a> · <a href="https://openmaps.fr/donate">Support OpenMaps.fr</a> · <a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap contributors</a>' url="https://tile.openmaps.fr/openhikingmap/{z}/{x}/{y}.png" referrerPolicy="origin" />
      {features.map((feature) => <GeoJSON key={`zone-${feature.id || feature.properties?._displayName}`} data={feature} style={styleZone} eventHandlers={{ click: () => {} }}><Popup><strong>{feature.properties?._displayName}</strong><br />Risk: {feature.properties?._riskScore == null ? 'Unavailable' : `${riskLabel(feature.properties._riskScore)} (${Math.round(feature.properties._riskScore)})`}</Popup></GeoJSON>)}
      {fires.map((fire) => <CircleMarker key={fire.id} center={firePos(fire)} radius={selectedFire?.id === fire.id ? 9 : 6} pathOptions={{ color: '#fff', weight: 1.5, fillColor: '#dc2626', fillOpacity: 0.9 }}><Popup><strong>Satellite fire detection</strong><br />{fire.acqDate || 'Date unavailable'} · {fire.satellite}<br />FRP: {fire.frp == null ? 'Not reported' : `${fire.frp} MW`}</Popup></CircleMarker>)}
      {stations.map((station) => { const [lon, lat] = station.geometry.coordinates; return <CircleMarker key={station.id} center={[lat, lon]} radius={5} pathOptions={{ color: '#fff', weight: 1, fillColor: '#2563eb', fillOpacity: 0.95 }}><Popup><strong>{station.properties?.name || 'Fire station'}</strong><br />OpenStreetMap · operational status simulated</Popup></CircleMarker>; })}
      {settlements.map((place) => { const [lon, lat] = place.geometry.coordinates; return <CircleMarker key={place.id} center={[lat, lon]} radius={3} pathOptions={{ color: '#fff', weight: 0.75, fillColor: '#64748b', fillOpacity: 0.8 }}><Popup>{place.properties?.name || 'Settlement'} · OpenStreetMap</Popup></CircleMarker>; })}
      {ignition && <CircleMarker center={ignition} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: '#ea580c', fillOpacity: 1 }}><Popup>Selected simulation ignition point</Popup></CircleMarker>}
      {spreadPolygon?.length > 2 && <Polygon positions={spreadPolygon} pathOptions={{ color: '#ea580c', weight: 2, fillColor: '#fb923c', fillOpacity: 0.28 }} />}
    </MapContainer>
    {pickEnabled && <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow dark:bg-slate-900/95 dark:text-slate-100">Click map to set ignition point</div>}
    <div className="absolute bottom-3 left-3 z-[400] flex flex-wrap gap-2 rounded-xl bg-white/95 px-3 py-2 text-[10px] font-semibold text-slate-600 shadow backdrop-blur dark:bg-slate-900/95 dark:text-slate-300"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-600" />Hotspot</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />Station</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-500" />Settlement</span></div>
  </div>;
}
