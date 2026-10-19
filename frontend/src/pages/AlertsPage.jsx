import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCheck, Clock3, Flame, Navigation, Search, ShieldAlert } from 'lucide-react';
import { DataNote, Drawer, EmptyState, PageHeader, RiskBadge, SeverityBadge, SourceLine, useToast } from '../components/ui.jsx';
import MapView from '../components/MapView.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { formatProbabilityPercent } from '../utils/useRiskForecast.js';
import { fireDateTime, number } from '../utils/formatters.js';

const statusTabs = ['New', 'Acknowledged', 'Resolved'];

const recommendation = (severity) => ({
  Extreme: 'Escalate to the responsible officer and verify conditions with official channels.',
  Critical: 'Escalate to the responsible officer and verify conditions with official channels.',
  High: 'Review the location and consider a simulated dispatch.',
  Medium: 'Monitor the next satellite observation and check local conditions.',
  Low: 'Retain for review; do not treat this as confirmed ground truth.',
})[severity] || 'Review source details.';

export default function AlertsPage() {
  const {
    alerts,
    acknowledge,
    resolve,
    dispatch,
    newCount,
    acknowledgedCount,
    resolvedCount,
    earlyWarnings,
    earlyWarningsNew,
    earlyWarningsAcknowledged,
    earlyWarningsResolved,
    acknowledgeWarning,
    resolveWarning,
    isForecastStale,
    isForecastExpired,
    isForecastOffline,
    forecastEnvelope,
  } = useAlerts();

  const { sourceStatus, stations } = useData();
  const toast = useToast();
  const navigate = useNavigate();

  // Mode: 'early_warnings' (ML forecast) vs 'active_fires' (NASA FIRMS satellite)
  const [mode, setMode] = useState('early_warnings');
  const [tab, setTab] = useState('New');
  const [severity, setSeverity] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedFire, setSelectedFire] = useState(null);
  const [selectedWarning, setSelectedWarning] = useState(null);

  const forecastStatusLabel = isForecastOffline
    ? 'Offline'
    : isForecastExpired
    ? 'Expired'
    : (forecastEnvelope?.stale || isForecastStale)
    ? 'Stale'
    : forecastEnvelope?.status === 'live'
    ? 'Live'
    : 'Cached';

  // Filtered early warnings
  const filteredWarnings = useMemo(() => {
    return earlyWarnings.filter((w) => {
      const matchesStatus = w.status === tab;
      const matchesSeverity = severity === 'All' || w.severity === severity;
      const query = `${w.district} ${w.risk_for_date} ${w.weather_date} ${w.severity}`.toLowerCase();
      const matchesSearch = query.includes(search.toLowerCase());
      return matchesStatus && matchesSeverity && matchesSearch;
    });
  }, [earlyWarnings, tab, severity, search]);

  // Filtered active fires
  const filteredFires = useMemo(() => {
    return alerts.filter((a) => {
      const matchesStatus = a.status === tab;
      const matchesSeverity = severity === 'All' || a.severity === severity;
      const query = `${a.latitude} ${a.longitude} ${a.district || ''} ${a.acqDate} ${a.satellite} ${a.severity}`.toLowerCase();
      const matchesSearch = query.includes(search.toLowerCase());
      return matchesStatus && matchesSeverity && matchesSearch;
    });
  }, [alerts, tab, severity, search]);

  const handleAckFire = (alert) => {
    acknowledge(alert.id);
    toast('Fire alert acknowledged.');
    setSelectedFire(null);
  };

  const handleResolveFire = (alert) => {
    resolve(alert.id);
    toast('Fire alert marked resolved.');
    setSelectedFire(null);
  };

  const handleDispatchFire = (alert) => {
    dispatch(alert.id);
    toast('Simulated dispatch logged; review the nearest station.');
    setSelectedFire(null);
    navigate('/fire-engine', { state: { fireId: alert.id } });
  };

  const handleAckWarning = (warning) => {
    acknowledgeWarning(warning.id);
    toast('Early warning acknowledged.');
    setSelectedWarning(null);
  };

  const handleResolveWarning = (warning) => {
    resolveWarning(warning.id);
    toast('Early warning marked resolved.');
    setSelectedWarning(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Risk triage & alerts"
        title="Alert center"
        subtitle="Manage upcoming pre-ignition early warnings from the ML forecast alongside active FIRMS satellite detections."
      />

      {isForecastStale && (
        <DataNote tone="amber">
          <strong>Forecast cache stale:</strong> Cached forecast data is older than 24 hours. Early warning generation is paused until a fresh forecast is received.
        </DataNote>
      )}

      {/* Mode switcher tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => { setMode('early_warnings'); setTab('New'); }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors ${
            mode === 'early_warnings'
              ? 'border-forest-600 text-forest-700 dark:border-emerald-400 dark:text-emerald-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <ShieldAlert size={16} />
          <span>ML early warnings (tomorrow)</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
            {earlyWarningsNew}
          </span>
        </button>

        <button
          onClick={() => { setMode('active_fires'); setTab('New'); }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors ${
            mode === 'active_fires'
              ? 'border-forest-600 text-forest-700 dark:border-emerald-400 dark:text-emerald-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Flame size={16} />
          <span>Active satellite fires (FIRMS)</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
            {newCount}
          </span>
        </button>
      </div>

      {/* 3 Status KPI Buttons */}
      <div className="grid gap-3 sm:grid-cols-3">
        <button onClick={() => setTab('New')} className="text-left">
          <div className="card p-4">
            <p className="text-xs text-slate-500">New</p>
            <p className="mt-1 text-2xl font-bold">
              {mode === 'early_warnings' ? earlyWarningsNew : newCount}
            </p>
          </div>
        </button>
        <button onClick={() => setTab('Acknowledged')} className="text-left">
          <div className="card p-4">
            <p className="text-xs text-slate-500">Acknowledged</p>
            <p className="mt-1 text-2xl font-bold">
              {mode === 'early_warnings' ? earlyWarningsAcknowledged : acknowledgedCount}
            </p>
          </div>
        </button>
        <button onClick={() => setTab('Resolved')} className="text-left">
          <div className="card p-4">
            <p className="text-xs text-slate-500">Resolved</p>
            <p className="mt-1 text-2xl font-bold">
              {mode === 'early_warnings' ? earlyWarningsResolved : resolvedCount}
            </p>
          </div>
        </button>
      </div>

      {/* Main Alert List Section */}
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`rounded-xl px-4 py-2 text-xs font-bold ${
                  tab === item
                    ? 'bg-forest-700 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {item}{' '}
                <span className="ml-1 opacity-70">
                  {mode === 'early_warnings'
                    ? item === 'New' ? earlyWarningsNew : item === 'Acknowledged' ? earlyWarningsAcknowledged : earlyWarningsResolved
                    : item === 'New' ? newCount : item === 'Acknowledged' ? acknowledgedCount : resolvedCount}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="control w-full pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={mode === 'early_warnings' ? 'Search district, date…' : 'Search location, date, satellite…'}
                aria-label="Search alerts"
              />
            </label>
            <select
              className="control"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              aria-label="Filter alert severity"
            >
              {['All', 'Extreme', 'High', 'Medium', 'Low'].map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>

          <SourceLine
            source={mode === 'early_warnings' ? 'ForestGuard ML forecast' : (sourceStatus.fires?.source || 'NASA FIRMS')}
            status={mode === 'early_warnings' ? forecastStatusLabel : sourceStatus.fires?.status}
            fetchedAt={mode === 'early_warnings' ? forecastEnvelope?.generated_at : sourceStatus.fires?.fetchedAt}
          />
        </div>

        {/* Content switch */}
        {mode === 'early_warnings' ? (
          filteredWarnings.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredWarnings.map((warning) => (
                <button
                  key={warning.id}
                  onClick={() => setSelectedWarning(warning)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:px-5"
                >
                  <span className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 rounded-xl bg-orange-50 p-2 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300">
                      <AlertTriangle size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">
                        {warning.district}: {warning.severity} pre-ignition risk
                      </span>
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        Risk for {warning.risk_for_date} (from weather on {warning.weather_date}) · {formatProbabilityPercent(warning.probability)} probability
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        Topsoil moisture: {warning.key_inputs?.soil_moisture_mean != null ? `${warning.key_inputs.soil_moisture_mean} m³/m³` : '—'} · Max temp: {warning.key_inputs?.temp_max != null ? `${warning.key_inputs.temp_max}°C` : '—'}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <SeverityBadge level={warning.severity} />
                    <span className="hidden items-center gap-1 text-[10px] text-slate-400 sm:flex">
                      <Clock3 size={12} />
                      {warning.status}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title={tab === 'New' ? 'No High/Extreme risk predicted for forest districts' : `No ${tab.toLowerCase()} early warnings`}
              description={
                tab === 'New'
                  ? 'No forest districts are currently predicted at High or Extreme fire detection risk for tomorrow.'
                  : `No early warnings in status ${tab}.`
              }
            />
          )
        ) : (
          filteredFires.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredFires.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => setSelectedFire(alert)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:px-5"
                >
                  <span className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 rounded-xl bg-red-50 p-2 text-red-600 dark:bg-red-950/40 dark:text-red-300">
                      <AlertTriangle size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="block text-sm font-bold text-slate-900 dark:text-white">
                          Satellite fire detection{alert.district ? ` · ${alert.district}` : ''}
                        </span>
                        {(alert.mixedAgricultural || alert.district === 'Haridwar' || alert.district === 'Udham Singh Nagar') && (
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
                            Mixed agricultural
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)} · {fireDateTime(alert)} · {alert.satellite}
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        FRP {alert.frp == null ? 'not reported' : `${number(alert.frp, 1)} MW`} · confidence {alert.confidence ?? 'not reported'}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <SeverityBadge level={alert.severity} />
                    <span className="hidden items-center gap-1 text-[10px] text-slate-400 sm:flex">
                      <Clock3 size={12} />
                      {alert.status}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title={tab === 'New' ? 'No new active fire detections' : `No ${tab.toLowerCase()} active fire alerts`}
              description="The FIRMS data feed and bundled history are empty or no records match the current filters. Add genuine source data or configure FIRMS_MAP_KEY in backend/.env to generate alerts."
            />
          )
        )}
      </section>

      {/* Drawer for Early Warning */}
      <Drawer
        open={Boolean(selectedWarning)}
        title={selectedWarning ? `${selectedWarning.district} · Early Warning` : 'Early warning details'}
        onClose={() => setSelectedWarning(null)}
      >
        {selectedWarning && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SeverityBadge level={selectedWarning.severity} />
              <span className="text-xs text-slate-500">Status: {selectedWarning.status}</span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
              <p className="text-[10px] text-slate-500">Pre-ignition risk prediction:</p>
              <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
                {selectedWarning.district}: {selectedWarning.severity} risk
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Probability of ≥1 satellite fire detection: <strong>{formatProbabilityPercent(selectedWarning.probability)}</strong>
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Target date: <strong>{selectedWarning.risk_for_date}</strong> (modeled from weather on {selectedWarning.weather_date})
              </p>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Key meteorological conditions (heuristic, not model attribution)
              </h3>
              <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Max temperature</span>
                  <p className="font-bold">{selectedWarning.key_inputs?.temp_max ?? '—'} °C</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Relative humidity</span>
                  <p className="font-bold">{selectedWarning.key_inputs?.humidity_mean ?? '—'} %</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Wind speed max</span>
                  <p className="font-bold">{selectedWarning.key_inputs?.wind_speed_max ?? '—'} km/h</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Days without rain</span>
                  <p className="font-bold">{selectedWarning.key_inputs?.days_since_rain ?? '—'} days</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <strong>Pre-ignition Advisory:</strong> High or Extreme pre-ignition risk indicates elevated ignition susceptibility. Verify field dryness and consider preventative patrols before potential ignition.
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedWarning.status === 'New' && (
                <button className="btn-primary flex-1" onClick={() => handleAckWarning(selectedWarning)}>
                  <CheckCheck size={15} /> Acknowledge
                </button>
              )}
              {selectedWarning.status !== 'Resolved' && (
                <button className="btn-quiet flex-1" onClick={() => handleResolveWarning(selectedWarning)}>
                  Resolve
                </button>
              )}
            </div>

            <p className="text-[10px] text-slate-400">
              Source: ForestGuard ML forecast · Generated {forecastEnvelope?.generated_at ? new Date(forecastEnvelope.generated_at).toLocaleString() : 'recently'}
            </p>
          </div>
        )}
      </Drawer>

      {/* Drawer for Active Fire Alert */}
      <Drawer
        open={Boolean(selectedFire)}
        title="Active fire details"
        onClose={() => setSelectedFire(null)}
      >
        {selectedFire && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SeverityBadge level={selectedFire.severity} />
                {(selectedFire.mixedAgricultural || selectedFire.district === 'Haridwar' || selectedFire.district === 'Udham Singh Nagar') && (
                  <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
                    Mixed agricultural
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500">Status: {selectedFire.status}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] text-slate-500">District</p>
                <p className="mt-1 text-xs font-bold">{selectedFire.district || 'Unassigned / border'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] text-slate-500">Acquisition</p>
                <p className="mt-1 text-xs font-bold">{fireDateTime(selectedFire)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] text-slate-500">FRP</p>
                <p className="mt-1 text-xs font-bold">
                  {selectedFire.frp == null ? 'Not reported' : `${number(selectedFire.frp, 1)} MW`}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] text-slate-500">Confidence</p>
                <p className="mt-1 text-xs font-bold">
                  {selectedFire.confidence ?? 'Not reported'}
                  {['n', 'l', 'h'].includes(String(selectedFire.confidence).toLowerCase()) ? ' · categorical' : ''}
                </p>
              </div>
              <div className="col-span-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] text-slate-500">Coordinates</p>
                <p className="mt-1 text-xs font-bold">
                  {selectedFire.latitude.toFixed(5)}, {selectedFire.longitude.toFixed(5)}
                </p>
              </div>
            </div>

            <div className="h-48 overflow-hidden rounded-xl">
              <MapView fires={[selectedFire]} stations={stations} center={[selectedFire.latitude, selectedFire.longitude]} zoom={9} />
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <strong>Recommended action:</strong> {recommendation(selectedFire.severity)} Satellite detections require ground verification.
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedFire.status === 'New' && (
                <button className="btn-primary flex-1" onClick={() => handleAckFire(selectedFire)}>
                  <CheckCheck size={15} /> Acknowledge
                </button>
              )}
              {selectedFire.status !== 'Resolved' && (
                <button className="btn-quiet flex-1" onClick={() => handleResolveFire(selectedFire)}>
                  Resolve
                </button>
              )}
              <button className="btn-quiet flex-1" onClick={() => handleDispatchFire(selectedFire)} disabled={!stations.length}>
                <Navigation size={15} /> Dispatch · simulated
              </button>
            </div>

            <p className="text-[10px] text-slate-400">
              Source: NASA FIRMS · {sourceStatus.fires?.status || 'Fallback'}
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
