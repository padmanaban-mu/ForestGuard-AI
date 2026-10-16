const R = 6371000;
const rad = (degrees) => degrees * Math.PI / 180;

export function haversineMeters(a, b) {
  if (!a || !b || ![...a, ...b].every(Number.isFinite)) return Infinity;
  const [lat1, lon1] = a.map(rad); const [lat2, lon2] = b.map(rad);
  const dLat = lat2 - lat1; const dLon = lon2 - lon1;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function geometryCenter(geometry) {
  if (!geometry?.coordinates) return null;
  const points = [];
  const collect = (value) => {
    if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') points.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
  };
  collect(geometry.coordinates);
  if (!points.length) return null;
  const xs = points.map((p) => p[0]); const ys = points.map((p) => p[1]);
  return [(Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...xs) + Math.max(...xs)) / 2];
}

function ringContains(point, ring) {
  const [lat, lon] = point; let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    const crosses = (yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}
export function pointInGeometry(point, geometry) {
  if (!point || !geometry) return false;
  const c = geometry.coordinates;
  if (geometry.type === 'Polygon') return Array.isArray(c) && c.length > 0 && ringContains(point, c[0]) && !c.slice(1).some((r) => ringContains(point, r));
  if (geometry.type === 'MultiPolygon') return c.some((poly) => poly.length > 0 && ringContains(point, poly[0]) && !poly.slice(1).some((r) => ringContains(point, r)));
  return false;
}

// Local planar approximation is suitable for demo station ranking, not routing along roads.
export const straightLineKm = (a, b) => haversineMeters(a, b) / 1000;

export function ellipsePolygon(center, majorM, minorM, bearingDegrees, samples = 48) {
  if (!center || !Number.isFinite(majorM) || !Number.isFinite(minorM)) return [];
  const [lat, lon] = center; const phi = rad(bearingDegrees); const out = [];
  for (let i = 0; i <= samples; i += 1) {
    const theta = 2 * Math.PI * i / samples;
    const along = majorM * Math.cos(theta); const across = minorM * Math.sin(theta);
    const east = along * Math.sin(phi) + across * Math.cos(phi);
    const north = along * Math.cos(phi) - across * Math.sin(phi);
    out.push([lat + (north / R) * 180 / Math.PI, lon + (east / (R * Math.cos(rad(lat)))) * 180 / Math.PI]);
  }
  return out;
}

export function withinEllipse(point, center, majorM, minorM, bearingDegrees) {
  if (!point || !center || majorM <= 0 || minorM <= 0) return false;
  const latScale = R * Math.PI / 180; const lonScale = latScale * Math.cos(rad(center[0]));
  const north = (point[0] - center[0]) * latScale; const east = (point[1] - center[1]) * lonScale;
  const phi = rad(bearingDegrees); const along = east * Math.sin(phi) + north * Math.cos(phi); const across = east * Math.cos(phi) - north * Math.sin(phi);
  return (along / majorM) ** 2 + (across / minorM) ** 2 <= 1;
}
