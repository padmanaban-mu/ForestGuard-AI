import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, Polygon, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { REGION } from '../data/region.js';
import { riskColor, riskLabel } from '../utils/formatters.js';

function PickHandler({ enabled, onPick }) {
  useMapEvents({ click(e) { if (enabled) onPick?.([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

const firePos = (fire) => [fire.latitude, fire.longitude];

function extractBounds(features) {
  if (!features || !features.length) return null;
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  const checkPoint = (lon, lat) => {
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  };
  const scan = (coords) => {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      checkPoint(coords[0], coords[1]);
    } else {
      coords.forEach(scan);
    }
  };
  for (const f of features) {
    if (f.geometry?.coordinates) scan(f.geometry.coordinates);
  }
  if (minLat === Infinity) return null;
  return [[minLat, minLon], [maxLat, maxLon]];
}

function MapViewController({ center, zoom, bounds, triggerKey }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    if (bounds) {
      map.fitBounds(bounds, { padding: [16, 16], maxZoom: 9 });
    } else if (center) {
      map.setView(center, zoom ?? REGION.zoom);
    }
  }, [map, center, zoom, bounds, triggerKey]);

  useEffect(() => {
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [map]);

  return null;
}

function getFeatureColor(riskEntry) {
  if (riskEntry == null) return '#94a3b8';
  if (typeof riskEntry === 'number') return riskColor(riskEntry);
  if (typeof riskEntry === 'object') {
    const level = riskEntry.risk_level;
    if (level === 'Extreme') return '#dc2626';
    if (level === 'High') return '#ea580c';
    if (level === 'Medium') return '#f59e0b';
    if (level === 'Low') return '#16a34a';
    if (Number.isFinite(riskEntry.probability)) {
      const p = riskEntry.probability;
      if (p >= 0.75) return '#dc2626';
      if (p >= 0.50) return '#ea580c';
      if (p >= 0.25) return '#f59e0b';
      return '#16a34a';
    }
    if (Number.isFinite(riskEntry.score)) return riskColor(riskEntry.score);
  }
  return '#94a3b8';
}

export default function MapView({
  fires = [],
  stations = [],
  settlements = [],
  zones = [],
  onPick,
  pickEnabled = false,
  ignition = null,
  spreadPolygon = [],
  riskByName = {},
  center = REGION.center,
  zoom = REGION.zoom,
  className = '',
  style = {},
  heightStyle,
  selectedFire = null,
  showHotspotsToggle = false,
  hotspotsNotice = null,
  firmsConfigured = false,
  triggerKey = null,
}) {
  const [hotspotsActive, setHotspotsActive] = useState(false);
  const containerRef = useRef(null);

  const features = useMemo(() => {
    return zones.map((zone, index) => {
      const name = zone.properties?.name || zone.properties?.zone || zone.properties?.district || zone.properties?.division || `Zone ${index + 1}`;
      const riskEntry = riskByName[name] ?? null;
      return { ...zone, properties: { ...zone.properties, _displayName: name, _riskEntry: riskEntry } };
    });
  }, [zones, riskByName]);

  const bounds = useMemo(() => extractBounds(features), [features]);

  const styleZone = (feature) => {
    const entry = feature.properties?._riskEntry;
    const color = getFeatureColor(entry);
    return { color, fillColor: color, weight: 1.5, opacity: 0.85, fillOpacity: 0.25 };
  };

  const showFires = showHotspotsToggle ? (hotspotsActive && firmsConfigured) : fires.length > 0;
  const showPointsLegend = (showFires && fires.length > 0) || stations.length > 0 || settlements.length > 0;
  const showRiskLegend = features.length > 0;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl w-full ${className}`}
      style={{ height: heightStyle || 'clamp(320px, 52vh, 520px)', ...style }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className="w-full"
        style={{ height: '100%', width: '100%' }}
        aria-label="Interactive forest monitoring map"
      >
        <MapViewController center={center} zoom={zoom} bounds={bounds} triggerKey={triggerKey} />
        <PickHandler enabled={pickEnabled} onPick={onPick} />
        <TileLayer
          attribution='&copy; <a href="https://wiki.openstreetmap.org/wiki/OpenHikingMap">OpenHikingMap</a> · <a href="https://openmaps.fr/donate">Support OpenMaps.fr</a> · <a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap contributors</a>'
          url="https://tile.openmaps.fr/openhikingmap/{z}/{x}/{y}.png"
          referrerPolicy="origin"
        />

        {features.map((feature) => {
          const entry = feature.properties?._riskEntry;
          const isObj = entry && typeof entry === 'object';
          return (
            <GeoJSON key={`zone-${feature.id || feature.properties?._displayName}`} data={feature} style={styleZone}>
              <Popup>
                <strong>{feature.properties?._displayName}</strong>
                {isObj ? (
                  <div className="mt-1 space-y-1 text-xs">
                    {entry.mixed_agricultural ? (
                      <p className="font-semibold text-amber-700 dark:text-amber-300">
                        Fire-detection risk (mixed agricultural burning): {entry.probability != null ? `${(entry.probability * 100).toFixed(1)}%` : '—'}
                      </p>
                    ) : (
                      <p className="font-semibold">
                        Predicted risk: {entry.risk_level} ({entry.probability != null ? `${(entry.probability * 100).toFixed(1)}%` : '—'})
                      </p>
                    )}
                    {entry.risk_for_date && (
                      <p className="text-[10px] text-slate-500">
                        Risk for {entry.risk_for_date} (from weather on {entry.weather_date})
                      </p>
                    )}
                    {entry.lead_days > 2 && (
                      <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        Lower confidence ({entry.lead_days}d lead): numerical forecast uncertainty beyond 48h
                      </p>
                    )}
                    {entry.caveat && (
                      <p className="text-[10px] text-amber-800 dark:text-amber-300">
                        {entry.caveat}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 text-xs">
                    Risk: {entry == null ? 'Unavailable' : `${riskLabel(entry)} (${Math.round(entry)})`}
                  </div>
                )}
              </Popup>
            </GeoJSON>
          );
        })}

        {showFires && fires.map((fire) => (
          <CircleMarker
            key={fire.id}
            center={firePos(fire)}
            radius={selectedFire?.id === fire.id ? 9 : 6}
            pathOptions={{ color: '#fff', weight: 1.5, fillColor: '#dc2626', fillOpacity: 0.9 }}
          >
            <Popup>
              <strong>Satellite fire detection</strong>
              <br />
              {fire.acqDate || 'Date unavailable'} · {fire.satellite}
              <br />
              FRP: {fire.frp == null ? 'Not reported' : `${fire.frp} MW`}
            </Popup>
          </CircleMarker>
        ))}

        {stations.map((station) => {
          const [lon, lat] = station.geometry.coordinates;
          return (
            <CircleMarker
              key={station.id}
              center={[lat, lon]}
              radius={5}
              pathOptions={{ color: '#fff', weight: 1, fillColor: '#2563eb', fillOpacity: 0.95 }}
            >
              <Popup>
                <strong>{station.properties?.name || 'Fire station'}</strong>
                <br />
                OpenStreetMap · operational status simulated
              </Popup>
            </CircleMarker>
          );
        })}

        {settlements.map((place) => {
          const [lon, lat] = place.geometry.coordinates;
          return (
            <CircleMarker
              key={place.id}
              center={[lat, lon]}
              radius={3}
              pathOptions={{ color: '#fff', weight: 0.75, fillColor: '#64748b', fillOpacity: 0.8 }}
            >
              <Popup>{place.properties?.name || 'Settlement'} · OpenStreetMap</Popup>
            </CircleMarker>
          );
        })}

        {ignition && (
          <CircleMarker
            center={ignition}
            radius={8}
            pathOptions={{ color: '#fff', weight: 2, fillColor: '#ea580c', fillOpacity: 1 }}
          >
            <Popup>Selected simulation ignition point</Popup>
          </CircleMarker>
        )}

        {spreadPolygon?.length > 2 && (
          <Polygon positions={spreadPolygon} pathOptions={{ color: '#ea580c', weight: 2, fillColor: '#fb923c', fillOpacity: 0.28 }} />
        )}
      </MapContainer>

      {showHotspotsToggle && (
        <div className="absolute right-3 top-3 z-[400] flex items-center gap-2 rounded-xl bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow backdrop-blur dark:bg-slate-900/95 dark:text-slate-200">
          <label className={`flex items-center gap-1.5 text-[11px] ${firmsConfigured ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
            <input
              type="checkbox"
              disabled={!firmsConfigured}
              checked={hotspotsActive && firmsConfigured}
              onChange={(e) => setHotspotsActive(e.target.checked)}
              className="rounded text-forest-700 focus:ring-forest-500 disabled:opacity-50"
            />
            <span>Live FIRMS layer</span>
          </label>
          {hotspotsNotice && (
            <span className="text-[10px] font-normal text-slate-400">({hotspotsNotice})</span>
          )}
        </div>
      )}

      {pickEnabled && (
        <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow dark:bg-slate-900/95 dark:text-slate-100">
          Click map to set ignition point
        </div>
      )}

      {/* Dynamic Legends */}
      <div className="absolute bottom-3 left-3 z-[400] flex flex-col gap-1.5">
        {showRiskLegend && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/95 px-3 py-1.5 text-[10px] font-semibold text-slate-600 shadow backdrop-blur dark:bg-slate-900/95 dark:text-slate-300">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-600" />Low</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Medium</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-600" />High</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-600" />Extreme</span>
            <span className="border-l border-slate-200 pl-1.5 dark:border-slate-700 text-amber-700 dark:text-amber-400">
              <i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-700" />Mixed agri
            </span>
          </div>
        )}

        {showPointsLegend && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/95 px-3 py-1.5 text-[10px] font-semibold text-slate-600 shadow backdrop-blur dark:bg-slate-900/95 dark:text-slate-300">
            {showFires && fires.length > 0 && (
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-600" />Hotspot</span>
            )}
            {stations.length > 0 && (
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />Station</span>
            )}
            {settlements.length > 0 && (
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-500" />Settlement</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
