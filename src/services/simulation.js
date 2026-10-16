import { ellipsePolygon, withinEllipse } from '../utils/geo.js';

export function simulateSpread({ center, windSpeed = 0, windDirection = 0, humidity = 50, temperature = 25, fuelDryness = 50, hours = 3, settlements = [] }) {
  if (!center || center.length !== 2 || !center.every(Number.isFinite)) return null;
  const dryness = Math.max(0, Math.min(100, Number(fuelDryness)));
  const wind = Math.max(0, Number(windSpeed));
  const rh = Math.max(0, Math.min(100, Number(humidity)));
  const temp = Number(temperature);
  // Educational heuristic: base m/min = 0.2 + 0.04*wind(m/s) + 0.003*dryness(%).
  // Humidity/temp scale spread conservatively; wind stretches the ellipse downwind.
  const moistureFactor = Math.max(0.55, Math.min(1.35, 1 + (50 - rh) / 150 + (temp - 25) / 250));
  const baseRate = (0.2 + 0.04 * wind + 0.003 * dryness) * moistureFactor;
  const majorM = baseRate * Number(hours) * 60 * (1 + wind / 20);
  const minorM = majorM / (1 + wind / 10);
  const areaHa = Math.PI * majorM * minorM / 10000;
  const affected = settlements.filter((settlement) => {
    const coords = settlement.geometry?.coordinates;
    return Array.isArray(coords) && withinEllipse([coords[1], coords[0]], center, majorM, minorM, Number(windDirection));
  });
  return { center, hours: Number(hours), baseRateMMin: baseRate, majorRadiusM: majorM, minorRadiusM: minorM, areaHa, polygon: ellipsePolygon(center, majorM, minorM, Number(windDirection)), affectedSettlements: affected };
}
