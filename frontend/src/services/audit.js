import { readLocal, writeLocal } from '../utils/storage.js';

const KEY = 'forestguard:audit:v1';
export function recordAudit({ user = 'Guest', role = 'Guest', action, module, status = 'Success', details = '' }) {
  if (!action || !module) return null;
  const entries = readLocal(KEY, []);
  const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, user, role, action, module, timestamp: new Date().toISOString(), status, details };
  writeLocal(KEY, [item, ...entries].slice(0, 1000));
  return item;
}
export const getAuditEntries = () => readLocal(KEY, []);
export const clearAuditEntries = () => writeLocal(KEY, []);
