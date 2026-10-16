import { createContext, useContext, useMemo, useState } from 'react';
import { readLocal, writeLocal } from '../utils/storage.js';
import { recordAudit } from '../services/audit.js';
import { useData } from './DataContext.jsx';
import { useAuth } from './AuthContext.jsx';
const AlertsContext = createContext(null);
const DEFAULT_THRESHOLDS = { criticalConfidence: 80, criticalFrp: 50, highConfidence: 60, highFrp: 20, mediumConfidence: 40, mediumFrp: 5 };
function buildAlerts(fires, thresholds, statuses) {
  return fires.map((fire) => {
    const conf = fire.confidenceRank; const frp = fire.frp;
    let severity = 'Low';
    if (conf != null && Number.isFinite(frp) && conf >= thresholds.criticalConfidence && frp >= thresholds.criticalFrp) severity = 'Critical';
    else if ((conf != null && conf >= thresholds.highConfidence) || (Number.isFinite(frp) && frp >= thresholds.highFrp)) severity = 'High';
    else if ((conf != null && conf >= thresholds.mediumConfidence) || (Number.isFinite(frp) && frp >= thresholds.mediumFrp)) severity = 'Medium';
    return { ...fire, severity, status: statuses[fire.id] || 'New' };
  }).sort((a, b) => (['Critical', 'High', 'Medium', 'Low'].indexOf(a.severity) - ['Critical', 'High', 'Medium', 'Low'].indexOf(b.severity)) || String(b.acqDate).localeCompare(String(a.acqDate)));
}
export function AlertsProvider({ children }) {
  const { fires } = useData(); const { user, role } = useAuth();
  const [thresholds, setThresholdState] = useState(() => ({ ...DEFAULT_THRESHOLDS, ...readLocal('forestguard:thresholds', {}) }));
  const [statuses, setStatuses] = useState(() => readLocal('forestguard:alert-statuses', {}));
  const setThresholds = (next) => {
    const merged = { ...thresholds, ...next };
    for (const key of Object.keys(DEFAULT_THRESHOLDS)) merged[key] = Math.max(0, Math.min(key.toLowerCase().includes('confidence') ? 100 : 1000, Number(merged[key]) || 0));
    setThresholdState(merged); writeLocal('forestguard:thresholds', merged);
    recordAudit({ user, role: role || 'Guest', action: 'Updated alert thresholds', module: 'Settings' });
  };
  const changeStatus = (id, next) => {
    setStatuses((old) => {
      const updated = { ...old, [id]: next }; writeLocal('forestguard:alert-statuses', updated);
      recordAudit({ user, role: role || 'Guest', action: `${next} alert`, module: 'Alert Center', details: id });
      return updated;
    });
  };
  const alerts = useMemo(() => buildAlerts(fires, thresholds, statuses), [fires, thresholds, statuses]);
  const value = useMemo(() => ({ alerts, thresholds, setThresholds, acknowledge: (id) => changeStatus(id, 'Acknowledged'), resolve: (id) => changeStatus(id, 'Resolved'), dispatch: (id) => recordAudit({ user, role: role || 'Guest', action: 'Dispatch initiated (simulated)', module: 'Fire Engine', details: id }), newCount: alerts.filter((a) => a.status === 'New').length, acknowledgedCount: alerts.filter((a) => a.status === 'Acknowledged').length, resolvedCount: alerts.filter((a) => a.status === 'Resolved').length }), [alerts, thresholds, user, role]);
  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}
export const useAlerts = () => useContext(AlertsContext);
