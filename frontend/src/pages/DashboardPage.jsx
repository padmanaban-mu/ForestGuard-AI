import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, ArrowRight, CloudSun, Droplets, Flame, Gauge, MapPin, RefreshCw, ShieldAlert, Wind } from 'lucide-react';
import { ChartCard, DataNote, EmptyState, Loader, PageHeader, RiskBadge, SeverityBadge, SourceLine, StatCard, StatusBadge } from '../components/ui.jsx';
import MapView from '../components/MapView.jsx';
import { useData } from '../context/DataContext.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { formatProbabilityPercent, useRiskForecast } from '../utils/useRiskForecast.js';
import { REGION } from '../data/region.js';
import { weatherValue } from '../services/weather.js';
import { withinLastHours } from '../services/firms.js';
import { dateLabel, fireDateTime, number } from '../utils/formatters.js';

export default function DashboardPage() {
  const { fires, weather, stations, zones: fallbackZones, sourceStatus, refresh: refreshData } = useData();
  const { alerts, earlyWarnings, earlyWarningsNew } = useAlerts();
  const {
    loading,
    wakingUp,
    error,
    forecast,
    districts,
    geoFeatures,
    tomorrowKolkata,
    todayKolkata,
    tomorrowDataByDistrict,
    forestStats,
    isStale,
    isExpired,
    envelope,
    refresh: refreshForecast,
  } = useRiskForecast();

  const navigate = useNavigate();
  const [selectedZoneName, setSelectedZoneName] = useState('Nainital');
  const [selectedDayOffset, setSelectedDayOffset] = useState(0); // 0 = tomorrow (day 1)

  const handleRefresh = async () => {
    await Promise.allSettled([
      refreshData({ force: true }),
      refreshForecast({ force: true }),
    ]);
  };

  const statusLabel = envelope?.status === 'live'
    ? 'Live'
    : (envelope?.stale || isStale)
    ? 'Stale'
    : 'Cached';

  const mapZones = geoFeatures.length ? geoFeatures : fallbackZones;

  // Day options for day selector
  const availableDays = useMemo(() => {
    if (!districts.length || !districts[0]?.forecast) return [];
    return districts[0].forecast.map((f, idx) => ({
      index: idx,
      risk_for_date: f.risk_for_date,
      weather_date: f.weather_date,
      lead_days: f.lead_days,
      reliability_note: f.reliability_note,
      label: idx === 0 ? `Tomorrow (${f.risk_for_date})` : `Day ${idx + 1} (${f.risk_for_date})`,
    }));
  }, [districts]);

  const currentSelectedDay = availableDays[selectedDayOffset] || availableDays[0];

  // Risk lookup for map by selected day
  const mapRiskLookup = useMemo(() => {
    const lookup = {};
    for (const d of districts) {
      const dayItem = d.forecast[selectedDayOffset] || d.forecast[0];
      if (!dayItem) continue;
      lookup[d.district] = {
        district: d.district,
        caveat: d.caveat,
        mixed_agricultural: Boolean(d.mixed_agricultural),
        centroid: d.centroid,
        elevation: d.elevation,
        probability: dayItem.probability,
        risk_level: dayItem.risk_level,
        weather_date: dayItem.weather_date,
        risk_for_date: dayItem.risk_for_date,
        lead_days: dayItem.lead_days,
        reliability_note: dayItem.reliability_note,
        score: dayItem.probability != null ? dayItem.probability * 100 : null,
      };
    }
    return lookup;
  }, [districts, selectedDayOffset]);

  // Selected district 7-day trend
  const selectedDistrictData = useMemo(() => {
    return districts.find((d) => d.district === selectedZoneName) || districts[0] || null;
  }, [districts, selectedZoneName]);

  const trendData = useMemo(() => {
    if (!selectedDistrictData?.forecast) return [];
    return selectedDistrictData.forecast.map((item) => ({
      date: item.risk_for_date,
      weather_date: item.weather_date,
      probability: item.probability != null ? Math.round(item.probability * 100) : null,
      lead_days: item.lead_days,
      risk_level: item.risk_level,
      reliability_note: item.reliability_note,
    }));
  }, [selectedDistrictData]);

  // Weather centroid values
  const currentTemp = weatherValue(weather, 'temperature_2m');
  const currentRh = weatherValue(weather, 'relative_humidity_2m');
  const currentWind = weatherValue(weather, 'wind_speed_10m');
  const currentDirection = weatherValue(weather, 'wind_direction_10m');

  const firmsUsable = sourceStatus.fires?.status === 'Live' || sourceStatus.fires?.status === 'Cached' || fires.length > 0;

  if (loading && !forecast) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={`Situation overview · ${REGION.name}`}
          title="Forest fire dashboard"
          subtitle="Pre-ignition machine learning risk predictions and early warning intelligence."
        />
        <Loader label={wakingUp ? 'Waking up the server (this may take up to 10 seconds)...' : 'Loading ForestGuard ML forecast…'} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Situation overview · ${REGION.name}`}
        title="Forest fire dashboard"
        subtitle="Pre-ignition machine learning risk predictions and early warning intelligence."
        action={
          <>
            <button className="btn-quiet" onClick={handleRefresh}>
              <RefreshCw size={15} /> Refresh forecast
            </button>
            <button className="btn-primary" onClick={() => navigate('/simulation')}>
              <Flame size={15} /> Simulate scenario
            </button>
          </>
        }
      />

      {isExpired && (
        <EmptyState
          compact
          title="Forecast is stale or expired"
          description="Cached forecast data is older than 24 hours. Connect to the ForestGuard backend or refresh sources to receive an up-to-date ML forecast."
          action={
            <button className="btn-primary mt-2" onClick={handleRefresh}>
              <RefreshCw size={14} className="mr-1 inline" /> Refresh now
            </button>
          }
        />
      )}

      {error && (
        <DataNote tone="red">
          <strong>Backend status:</strong> {error}
        </DataNote>
      )}

      {wakingUp && (
        <DataNote tone="amber">
          <strong>Waking up the server:</strong> Connecting to cold-started FastAPI backend instance...
        </DataNote>
      )}

      {/* 5 KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Highest predicted risk (tomorrow)"
          value={forestStats.highestDistrict ? forestStats.highestDistrict.district : '—'}
          suffix={forestStats.highestDistrict ? `(${formatProbabilityPercent(forestStats.highestDistrict.probability)})` : ''}
          icon={ShieldAlert}
          accent="red"
          note={
            forestStats.highestDistrict
              ? `Risk for ${forestStats.highestDistrict.risk_for_date} (from weather on ${forestStats.highestDistrict.weather_date})`
              : 'Awaiting forecast'
          }
          source="ForestGuard ML forecast"
          status={statusLabel}
          updatedAt={envelope?.generated_at}
        />

        <StatCard
          label="Zones at High/Extreme (tomorrow)"
          value={forestStats.highOrExtremeCount}
          suffix={`/ ${forestStats.monitoredCount}`}
          icon={AlertTriangle}
          accent={forestStats.highOrExtremeCount > 0 ? 'orange' : 'green'}
          note="Forest districts only (lowlands excluded)"
          source="ForestGuard ML forecast"
          status={statusLabel}
          updatedAt={envelope?.generated_at}
        />

        <StatCard
          label="Average predicted risk (tomorrow)"
          value={forestStats.averageProbability != null ? formatProbabilityPercent(forestStats.averageProbability) : '—'}
          icon={Gauge}
          accent={
            forestStats.averageScore >= 75
              ? 'red'
              : forestStats.averageScore >= 50
              ? 'orange'
              : 'green'
          }
          note="Mean probability of ≥1 fire detection across 11 forest districts"
          source="ForestGuard ML forecast"
          status={statusLabel}
          updatedAt={envelope?.generated_at}
        />

        <StatCard
          label="Forest zones monitored"
          value={forestStats.totalCount || 13}
          icon={MapPin}
          accent="green"
          note="11 forest districts · 2 mixed agricultural excluded from forest index"
          source="ForestGuard ML forecast"
          status={statusLabel}
          updatedAt={envelope?.generated_at}
        />

        <StatCard
          label="Early warnings (tomorrow)"
          value={earlyWarningsNew}
          suffix={earlyWarnings.length ? `(${earlyWarnings.length} total)` : ''}
          icon={Activity}
          accent={earlyWarningsNew > 0 ? 'red' : 'green'}
          note={
            earlyWarningsNew > 0
              ? 'High/Extreme predictions pending acknowledgement'
              : 'No active early warnings for tomorrow'
          }
          source="ForestGuard ML forecast"
          status={statusLabel}
          updatedAt={envelope?.generated_at}
        />
      </div>

      {/* Main Map & Conditions Grid */}
      <div className="grid gap-5 xl:grid-cols-[1.55fr_0.8fr]">
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <p className="eyebrow">Predicted pre-ignition risk map</p>
              <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                District risk forecast · {currentSelectedDay?.label}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="control text-xs"
                value={selectedDayOffset}
                onChange={(e) => setSelectedDayOffset(Number(e.target.value))}
                aria-label="Select forecast day"
              >
                {availableDays.map((day) => (
                  <option key={day.index} value={day.index}>
                    {day.label}
                  </option>
                ))}
              </select>
              <SourceLine
                source="ForestGuard ML forecast"
                status={statusLabel}
                fetchedAt={envelope?.generated_at}
              />
            </div>
          </div>

          {currentSelectedDay?.lead_days > 2 && (
            <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <span className="font-bold">Lower confidence (Lead {currentSelectedDay.lead_days} days):</span> Numerical weather forecast uncertainty increases beyond 48 hours. Operational skill is validated primarily for short-lead forecasts (days 1–2).
            </div>
          )}

          <div className="h-[350px] sm:h-[430px]">
            <MapView
              zones={mapZones}
              fires={fires}
              stations={stations}
              riskByName={mapRiskLookup}
              center={REGION.center}
              zoom={REGION.zoom}
              showHotspotsToggle={true}
              hotspotsNotice={firmsUsable ? `${fires.length} active detections` : 'FIRMS key not configured'}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400 dark:border-slate-800 sm:px-5">
            <div>Map tiles: OpenHikingMap · OpenStreetMap contributors</div>
            <div className="text-slate-500">
              Lowland districts (Haridwar, Udham Singh Nagar): Thermal detections reflect agricultural residue burning
            </div>
          </div>
        </section>

        {/* Current Weather & Risk Gauge */}
        <div className="space-y-5">
          <section className="card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Centroid conditions</p>
                <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                  {REGION.name} · regional baseline
                </h2>
              </div>
              <CloudSun size={19} className="text-forest-600" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { icon: CloudSun, name: 'Temperature', value: currentTemp == null ? '—' : `${number(currentTemp, 1)} °C` },
                { icon: Droplets, name: 'Humidity', value: currentRh == null ? '—' : `${number(currentRh)}%` },
                { icon: Wind, name: 'Wind speed', value: currentWind == null ? '—' : `${number(currentWind, 1)} m/s` },
                { icon: Activity, name: 'Wind direction', value: currentDirection == null ? '—' : `${number(currentDirection)}°` },
              ].map(({ icon: Icon, name, value }) => (
                <div key={name} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Icon size={13} />
                    {name}
                  </div>
                  <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-400">
              Source: Open-Meteo · Centroid weather
            </p>
          </section>

          <section className="card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="eyebrow">Risk gauge (tomorrow)</p>
                <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                  Forest districts mean
                </h2>
              </div>
              <Gauge size={18} className="text-amber-500" />
            </div>

            {forestStats.averageProbability == null ? (
              <EmptyState compact title="Forecast unavailable" description="Awaiting ML forecast from backend service." />
            ) : (
              <div className="flex items-center gap-4">
                <div
                  className="grid h-24 w-24 place-items-center rounded-full border-[10px]"
                  style={{
                    borderColor:
                      forestStats.averageScore >= 75
                        ? '#dc2626'
                        : forestStats.averageScore >= 50
                        ? '#ea580c'
                        : forestStats.averageScore >= 25
                        ? '#f59e0b'
                        : '#16a34a',
                  }}
                >
                  <span className="text-xl font-bold">{Math.round(forestStats.averageScore)}%</span>
                </div>
                <div>
                  <RiskBadge
                    level={
                      forestStats.averageScore >= 75
                        ? 'Extreme'
                        : forestStats.averageScore >= 50
                        ? 'High'
                        : forestStats.averageScore >= 25
                        ? 'Medium'
                        : 'Low'
                    }
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Mean probability of ≥1 fire detection across 11 forest districts.
                  </p>
                </div>
              </div>
            )}
            <p className="mt-3 text-[10px] text-slate-400">
              Source: ForestGuard ML forecast · Generated {dateLabel(envelope?.generated_at)}
            </p>
          </section>
        </div>
      </div>

      {/* 7-Day Trend Chart & Alert Feed */}
      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <ChartCard
          title={`7-day risk trend · ${selectedZoneName}`}
          subtitle={`Pre-ignition probability across upcoming forecast days for ${selectedZoneName}.`}
          source="ForestGuard ML forecast"
          updatedAt={envelope?.generated_at}
        >
          <div className="mb-3 flex items-center justify-between">
            <label className="text-xs text-slate-500">
              Select district:{' '}
              <select
                className="control ml-1 text-xs"
                value={selectedZoneName}
                onChange={(e) => setSelectedZoneName(e.target.value)}
                aria-label="Select district for 7-day trend"
              >
                {districts.map((d) => (
                  <option key={d.district} value={d.district}>
                    {d.district} {d.mixed_agricultural ? '(Mixed agri)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {selectedDistrictData?.mixed_agricultural && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                Mixed agricultural lowlands (crop burning)
              </span>
            )}
          </div>

          {trendData.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: -15, right: 10, top: 10 }}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ea580c" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#ea580c" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ece7" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    formatter={(val) => [`${val}%`, 'Detection probability']}
                    labelFormatter={(label) => `Risk target date: ${label}`}
                  />
                  <Area type="monotone" dataKey="probability" stroke="#ea580c" strokeWidth={2.5} fill="url(#riskGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState compact title="No forecast data" description="Awaiting 7-day forecast series from backend." />
          )}

          <div className="mt-2 text-[10px] text-slate-400">
            Note: Skill for lead days 3–7 is not validated against historical reanalysis; forecast uncertainty increases beyond 48 hours.
          </div>
        </ChartCard>

        {/* Early Warnings & Satellite Alert Feed */}
        <section className="card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="eyebrow">Early warning triage</p>
              <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                Upcoming High/Extreme warnings
              </h2>
            </div>
            <button className="text-xs font-bold text-forest-700 dark:text-emerald-300" onClick={() => navigate('/alerts')}>
              View all <ArrowRight size={13} className="inline" />
            </button>
          </div>

          {earlyWarnings.length ? (
            <div className="space-y-3">
              {earlyWarnings.slice(0, 5).map((warning) => (
                <button
                  key={warning.id}
                  onClick={() => navigate('/alerts')}
                  className="flex w-full items-start justify-between gap-2 rounded-xl bg-slate-50 p-3 text-left hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-slate-800 dark:text-white">
                      {warning.district}: {warning.severity} risk
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-500">
                      Risk for {warning.risk_for_date} (from weather on {warning.weather_date}) · {formatProbabilityPercent(warning.probability)}
                    </span>
                  </span>
                  <SeverityBadge level={warning.severity} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              title="No High/Extreme early warnings"
              description="No forest districts are currently predicted at High or Extreme fire detection risk for tomorrow."
            />
          )}

          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <SourceLine source="ForestGuard ML forecast" status={statusLabel} fetchedAt={envelope?.generated_at} />
          </div>
        </section>
      </div>

      <section className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow">Operational tools</p>
          <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Next analytical steps</h2>
          <p className="mt-1 text-xs text-slate-500">Explore district rankings, dispatch simulation, or inspect model governance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-quiet" onClick={() => navigate('/vulnerable-areas')}>
            <MapPin size={15} /> Vulnerable areas
          </button>
          <button className="btn-quiet" onClick={() => navigate('/model')}>
            <Activity size={15} /> Model evaluation
          </button>
          <button className="btn-primary" onClick={() => navigate('/simulation')}>
            <Flame size={15} /> Run spread simulation
          </button>
        </div>
      </section>

      <div className="text-right text-[10px] text-slate-400">
        Source: ForestGuard ML forecast · Dashboard refreshed {dateLabel(envelope?.generated_at || new Date())}
      </div>
    </div>
  );
}
