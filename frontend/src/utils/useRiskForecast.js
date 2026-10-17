import { useCallback, useEffect, useMemo, useState } from 'react';
import { getForecast } from '../services/api.js';

/**
 * Returns YYYY-MM-DD date string in Asia/Kolkata timezone with day offset.
 */
export function getKolkataDateString(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  const kolkataDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (offsetDays !== 0) {
    kolkataDate.setUTCDate(kolkataDate.getUTCDate() + offsetDays);
  }
  return kolkataDate.toISOString().slice(0, 10);
}

/**
 * Maps probability (0.0 to 1.0) to risk level category using calibrated operational cut-points.
 */
export function getRiskLevelFromProbability(prob) {
  if (prob == null || !Number.isFinite(Number(prob))) return 'Unavailable';
  const p = Number(prob);
  if (p >= 0.75) return 'Extreme';
  if (p >= 0.50) return 'High';
  if (p >= 0.25) return 'Medium';
  return 'Low';
}

/**
 * Probability formatted as percentage string.
 */
export function formatProbabilityPercent(prob, digits = 1) {
  if (prob == null || !Number.isFinite(Number(prob))) return '—';
  return `${(Number(prob) * 100).toFixed(digits)}%`;
}

// Module-level shared store for /forecast and zones.geojson
let cachedState = {
  forecast: null,
  geoFeatures: [],
  loading: true,
  wakingUp: false,
  error: null,
  refreshedAt: null,
  isOfflineWithMemory: false,
};

let inFlightPromise = null;
const listeners = new Set();

function broadcast() {
  for (const fn of listeners) {
    try {
      fn({ ...cachedState });
    } catch {
      // ignore detached listener errors
    }
  }
}

async function loadSharedForecast({ force = false } = {}) {
  if (!force && cachedState.forecast && cachedState.geoFeatures.length > 0) {
    return cachedState;
  }
  if (inFlightPromise) {
    return inFlightPromise;
  }

  cachedState = { ...cachedState, loading: true, error: null };
  broadcast();

  inFlightPromise = (async () => {
    try {
      const [forecastResult, geoResult] = await Promise.all([
        getForecast(7, {
          onSlow: (isSlow) => {
            cachedState = { ...cachedState, wakingUp: isSlow };
            broadcast();
          },
        }),
        fetch('/data/zones.geojson').then((res) => (res.ok ? res.json() : null)).catch(() => null),
      ]);

      const features =
        geoResult?.type === 'FeatureCollection' && Array.isArray(geoResult.features)
          ? geoResult.features
          : cachedState.geoFeatures;

      if (!forecastResult.ok || !forecastResult.data) {
        if (cachedState.forecast) {
          // Offline with memory state
          const genAt = cachedState.forecast.generated_at;
          const timeStr = genAt ? new Date(genAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'earlier';
          cachedState = {
            ...cachedState,
            loading: false,
            wakingUp: false,
            isOfflineWithMemory: true,
            error: `Cannot reach the ForestGuard server. Showing the last forecast received at ${timeStr}.`,
            refreshedAt: new Date().toISOString(),
          };
        } else {
          cachedState = {
            ...cachedState,
            loading: false,
            wakingUp: false,
            isOfflineWithMemory: false,
            error: forecastResult.error || 'Failed to retrieve ML forecast.',
            refreshedAt: new Date().toISOString(),
          };
        }
      } else {
        cachedState = {
          ...cachedState,
          forecast: forecastResult.data,
          geoFeatures: features,
          loading: false,
          wakingUp: false,
          isOfflineWithMemory: false,
          error: null,
          refreshedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      if (cachedState.forecast) {
        const genAt = cachedState.forecast.generated_at;
        const timeStr = genAt ? new Date(genAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'earlier';
        cachedState = {
          ...cachedState,
          loading: false,
          wakingUp: false,
          isOfflineWithMemory: true,
          error: `Cannot reach the ForestGuard server. Showing the last forecast received at ${timeStr}.`,
          refreshedAt: new Date().toISOString(),
        };
      } else {
        cachedState = {
          ...cachedState,
          loading: false,
          wakingUp: false,
          isOfflineWithMemory: false,
          error: err.message || 'Error communicating with backend.',
          refreshedAt: new Date().toISOString(),
        };
      }
    } finally {
      inFlightPromise = null;
      broadcast();
    }
    return cachedState;
  })();

  return inFlightPromise;
}

export function useRiskForecast() {
  const [state, setState] = useState(() => ({ ...cachedState }));

  useEffect(() => {
    listeners.add(setState);
    if (!cachedState.forecast && !inFlightPromise) {
      loadSharedForecast();
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const refresh = useCallback((opts = {}) => {
    return loadSharedForecast({ force: true, ...opts });
  }, []);

  const tomorrowKolkata = useMemo(() => getKolkataDateString(1), []);
  const todayKolkata = useMemo(() => getKolkataDateString(0), []);

  const districts = state.forecast?.districts || [];

  // Expiration check: > 24 hours old OR risk_for_date no longer in future
  const isExpired = useMemo(() => {
    if (!state.forecast) return false;
    const genAt = state.forecast.generated_at;
    if (genAt) {
      const ageHours = (Date.now() - new Date(genAt).getTime()) / (3600 * 1000);
      if (ageHours >= 24) return true;
    }
    if (districts.length > 0) {
      const allPastOrToday = districts.every((d) =>
        d.forecast.every((f) => f.risk_for_date <= todayKolkata)
      );
      if (allPastOrToday) return true;
    }
    return false;
  }, [state.forecast, districts, todayKolkata]);

  // 60-second auto-retry, paused while tab is hidden, stopped once forecast is Expired
  useEffect(() => {
    let timer = null;

    const startTimer = () => {
      if (timer) clearInterval(timer);
      if (isExpired) return;
      timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !isExpired) {
          loadSharedForecast({ force: true });
        }
      }, 60000);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!isExpired) {
          loadSharedForecast({ force: true });
        }
        startTimer();
      } else {
        if (timer) clearInterval(timer);
      }
    };

    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !isExpired) {
      startTimer();
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [isExpired]);

  // Categorize districts into forest vs mixed agricultural lowlands
  const { forestDistricts, lowlandDistricts } = useMemo(() => {
    const forest = [];
    const lowland = [];
    for (const d of districts) {
      if (d.mixed_agricultural || d.district === 'Haridwar' || d.district === 'Udham Singh Nagar') {
        lowland.push(d);
      } else {
        forest.push(d);
      }
    }
    return { forestDistricts: forest, lowlandDistricts: lowland };
  }, [districts]);

  // Target date entry lookup per district
  const tomorrowDataByDistrict = useMemo(() => {
    const lookup = {};
    for (const d of districts) {
      const match =
        (!isExpired && d.forecast.find((f) => f.risk_for_date === tomorrowKolkata)) ||
        d.forecast.find((f) => !f.expired) ||
        d.forecast[0] ||
        null;
      lookup[d.district] = {
        district: d.district,
        caveat: d.caveat,
        mixed_agricultural: Boolean(d.mixed_agricultural),
        centroid: d.centroid,
        elevation: d.elevation,
        forecastItem: match,
        probability: match?.probability ?? null,
        risk_level: match?.risk_level ?? 'Unavailable',
        weather_date: match?.weather_date ?? null,
        risk_for_date: match?.risk_for_date ?? null,
        lead_days: match?.lead_days ?? 1,
        reliability_note: match?.reliability_note ?? null,
        key_inputs: match?.key_inputs ?? {},
        expired: isExpired || Boolean(match?.expired),
      };
    }
    return lookup;
  }, [districts, tomorrowKolkata, isExpired]);

  // Forest districts risk stats
  const forestStats = useMemo(() => {
    const forestItems = forestDistricts
      .map((d) => tomorrowDataByDistrict[d.district])
      .filter(Boolean);

    const validProbs = forestItems
      .map((item) => item.probability)
      .filter((p) => p != null && Number.isFinite(p));

    const avgProb = validProbs.length
      ? validProbs.reduce((a, b) => a + b, 0) / validProbs.length
      : null;

    const highOrExtreme = isExpired
      ? []
      : forestItems.filter(
          (item) => item.risk_level === 'High' || item.risk_level === 'Extreme'
        );

    const sortedByRisk = [...forestItems].sort(
      (a, b) => (b.probability ?? -1) - (a.probability ?? -1)
    );

    const highest = sortedByRisk[0] || null;

    return {
      averageProbability: avgProb,
      averageScore: avgProb != null ? avgProb * 100 : null,
      highOrExtremeCount: highOrExtreme.length,
      highOrExtremeDistricts: highOrExtreme,
      highestDistrict: highest,
      monitoredCount: forestDistricts.length,
      totalCount: districts.length,
    };
  }, [forestDistricts, districts, tomorrowDataByDistrict, isExpired]);

  // Check if forecast is stale or offline
  const isStale = Boolean(state.forecast?.stale) || state.isOfflineWithMemory;

  // Compute statusLabel
  const statusLabel = isExpired
    ? 'Expired'
    : state.isOfflineWithMemory
    ? 'Offline'
    : state.forecast?.status === 'live'
    ? 'Live'
    : 'Cached';

  return {
    ...state,
    refresh,
    todayKolkata,
    tomorrowKolkata,
    districts,
    forestDistricts,
    lowlandDistricts,
    tomorrowDataByDistrict,
    forestStats,
    isStale,
    isExpired,
    statusLabel,
    envelope: state.forecast
      ? {
          model: state.forecast.model,
          weather_source: state.forecast.weather_source,
          generated_at: state.forecast.generated_at,
          status: state.forecast.status,
          cache_age_hours: state.forecast.cache_age_hours,
          static_cache_age_hours: state.forecast.static_cache_age_hours,
          stale: state.forecast.stale,
        }
      : null,
  };
}
