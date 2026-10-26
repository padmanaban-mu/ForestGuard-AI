/**
 * ForestGuard AI Backend API Client
 * Connects to FastAPI backend at VITE_API_URL (default: http://127.0.0.1:8000)
 * NO API keys or secrets are stored or transmitted from the frontend.
 */

export const API_BASE = (
  import.meta.env.VITE_API_URL != null && import.meta.env.VITE_API_URL !== ''
    ? import.meta.env.VITE_API_URL
    : (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')
).replace(/\/+$/, '');

async function request(path, { timeoutMs = 12000, onSlow = null, ...customConfig } = {}) {
  const controller = new AbortController();
  let slowTimer = null;

  if (typeof onSlow === 'function') {
    slowTimer = setTimeout(() => {
      onSlow(true);
    }, 2500);
  }

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...customConfig,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(customConfig.headers || {}),
      },
    });

    if (slowTimer) clearTimeout(slowTimer);
    if (typeof onSlow === 'function') onSlow(false);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status} from ${path}: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return { ok: true, data, status: data.status || 'ok' };
  } catch (err) {
    if (slowTimer) clearTimeout(slowTimer);
    if (typeof onSlow === 'function') onSlow(false);
    clearTimeout(timeoutId);

    const isAbort = err.name === 'AbortError';
    const message = isAbort
      ? 'Request timed out while waiting for server response.'
      : (err.message || 'Network error connecting to ForestGuard API.');

    return {
      ok: false,
      error: message,
      status: 'error',
      data: null,
    };
  }
}

export async function getHealth() {
  return request('/health', { timeoutMs: 8000 });
}

export async function getZones() {
  return request('/zones', { timeoutMs: 10000 });
}

export async function getForecast(days = 7, { onSlow = null } = {}) {
  const d = Math.max(1, Math.min(7, days));
  return request(`/forecast?days=${d}`, { timeoutMs: 70000, onSlow });
}

export async function getRecentFires(hours = 72) {
  return request(`/fires/recent?hours=${hours}`, { timeoutMs: 10000 });
}

export async function getModelMetrics() {
  return request('/model/metrics', { timeoutMs: 8000 });
}
