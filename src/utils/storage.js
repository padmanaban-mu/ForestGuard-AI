export function readJSON(storage, key, fallback = null) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(storage, key, value) {
  try { storage?.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const readLocal = (key, fallback = null) => readJSON(globalThis.localStorage, key, fallback);
export const writeLocal = (key, value) => writeJSON(globalThis.localStorage, key, value);
export const readSession = (key, fallback = null) => readJSON(globalThis.sessionStorage, key, fallback);
export const writeSession = (key, value) => writeJSON(globalThis.sessionStorage, key, value);
