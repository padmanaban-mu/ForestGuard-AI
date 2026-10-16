import { readSession, writeSession } from '../utils/storage.js';

export function getFreshCache(key, maxAgeMs) {
  const cached = readSession(key);
  if (!cached?.fetchedAt || (!Array.isArray(cached.data) && cached.data == null)) return null;
  if (Date.now() - new Date(cached.fetchedAt).getTime() > maxAgeMs) return null;
  // Local fallback data stays labelled Fallback even when read again from this session's cache.
  const status = cached.status === 'Fallback' ? 'Fallback' : 'Cached';
  return { ...cached, status, cached: true };
}
export function saveCache(key, data, source, { status = 'Live', error = null } = {}) {
  const record = { data, source, status, error: error ? String(error.message || error) : null, fetchedAt: new Date().toISOString() };
  writeSession(sessionStorage, key, record);
  return record;
}
export async function loadFallback(path, kind = 'json') {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Fallback ${path} returned ${response.status}`);
  return kind === 'text' ? response.text() : response.json();
}
export async function fetchWithTimeout(url, options = {}, timeout = 16000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(id); }
}
export const state = (status, source, fetchedAt, error = null) => ({ status, source, fetchedAt: fetchedAt || null, error: error ? String(error.message || error) : null });
