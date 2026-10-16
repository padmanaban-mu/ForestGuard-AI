import { createContext, useContext, useMemo, useState } from 'react';
import { readLocal, writeLocal } from '../utils/storage.js';
import { recordAudit } from '../services/audit.js';
import { useData } from './DataContext.jsx';
import { useAuth } from './AuthContext.jsx';

const AlertsContext = createContext(null);

const DEFAULT_THRESHOLDS = {
  extremeConfidence: 80,
  extremeFrp: 50,
  highConfidence: 60,
  highFrp: 20,
  mediumConfidence: 40,
  mediumFrp: 5,
};

function getInitialThresholds() {
  const saved = readLocal('forestguard:thresholds', {});
  let migrated = false;
  const next = { ...saved };

  if (next.criticalConfidence != null && next.extremeConfidence == null) {
    next.extremeConfidence = next.criticalConfidence;
    migrated = true;
  }
  if (next.criticalFrp != null && next.extremeFrp == null) {
    next.extremeFrp = next.criticalFrp;
    migrated = true;
  }
  if ('criticalConfidence' in next) {
    delete next.criticalConfidence;
    migrated = true;
  }
  if ('criticalFrp' in next) {
    delete next.criticalFrp;
    migrated = true;
  }

  if (migrated) {
    writeLocal('forestguard:thresholds', next);
  }

  return { ...DEFAULT_THRESHOLDS, ...next };
}

function buildAlerts(fires, thresholds, statuses) {
  return fires.map((fire) => {
    const conf = fire.confidenceRank;
    const frp = fire.frp;
    let severity = 'Low';
    if (conf != null && Number.isFinite(frp) && conf >= thresholds.extremeConfidence && frp >= thresholds.extremeFrp) severity = 'Extreme';
    else if ((conf != null && conf >= thresholds.highConfidence) || (Number.isFinite(frp) && frp >= thresholds.highFrp)) severity = 'High';
    else if ((conf != null && conf >= thresholds.mediumConfidence) || (Number.isFinite(frp) && frp >= thresholds.mediumFrp)) severity = 'Medium';
    return { ...fire, severity, status: statuses[fire.id] || 'New' };
  }).sort((a, b) => (['Extreme', 'Critical', 'High', 'Medium', 'Low'].indexOf(a.severity) - ['Extreme', 'Critical', 'High', 'Medium', 'Low'].indexOf(b.severity)) || String(b.acqDate).localeCompare(String(a.acqDate)));
}

export function AlertsProvider({ children }) {
  const { fires } = useData();
  const { user, role } = useAuth();
  const [thresholds, setThresholdState] = useState(getInitialThresholds);
  const [statuses, setStatuses] = useState(() => readLocal('forestguard:alert-statuses', {}));

  const setThresholds = (next) => {
    const merged = {};
    for (const key of Object.keys(DEFAULT_THRESHOLDS)) {
      const val = next[key] ?? thresholds[key] ?? DEFAULT_THRESHOLDS[key];
      merged[key] = Math.max(0, Math.min(key.toLowerCase().includes('confidence') ? 100 : 1000, Number(val) || 0));
    }
    setThresholdState(merged);
    writeLocal('forestguard:thresholds', merged);
    recordAudit({ user, role: role || 'Guest', action: 'Updated alert thresholds', module: 'Settings' });
  };

  const changeStatus = (id, next) => {
    setStatuses((old) => {
      const updated = { ...old, [id]: next };
      writeLocal('forestguard:alert-statuses', updated);
      recordAudit({ user, role: role || 'Guest', action: `${next} alert`, module: 'Alert Center', details: id });
      return updated;
    });
  };

  const alerts = useMemo(() => buildAlerts(fires, thresholds, statuses), [fires, thresholds, statuses]);
  const value = useMemo(() => ({
    alerts,
    thresholds,
    setThresholds,
    acknowledge: (id) => changeStatus(id, 'Acknowledged'),
    resolve: (id) => changeStatus(id, 'Resolved'),
    dispatch: (id) => recordAudit({ user, role: role || 'Guest', action: 'Dispatch initiated (simulated)', module: 'Fire Engine', details: id }),
    newCount: alerts.filter((a) => a.status === 'New').length,
    acknowledgedCount: alerts.filter((a) => a.status === 'Acknowledged').length,
    resolvedCount: alerts.filter((a) => a.status === 'Resolved').length,
  }), [alerts, thresholds, user, role]);

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export const useAlerts = () => useContext(AlertsContext);
