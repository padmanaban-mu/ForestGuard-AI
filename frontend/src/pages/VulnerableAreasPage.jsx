import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, AlertTriangle, CloudSun, Droplets, Info, MapPinned, ShieldAlert, Wind } from 'lucide-react';
import { ChartCard, DataNote, Drawer, EmptyState, Loader, PageHeader, RiskBadge, SourceLine, StatCard, StatusBadge } from '../components/ui.jsx';
import MapView from '../components/MapView.jsx';
import { useRiskForecast, formatProbabilityPercent } from '../utils/useRiskForecast.js';
import { REGION } from '../data/region.js';
import { dateLabel, number } from '../utils/formatters.js';

export default function VulnerableAreasPage() {
  const {
    loading,
    wakingUp,
    error,
    districts,
    geoFeatures,
    tomorrowKolkata,
    tomorrowDataByDistrict,
    forestStats,
    isStale,
    isExpired,
    envelope,
  } = useRiskForecast();

  const [riskFilter, setRiskFilter] = useState('All');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [selectedDistrictName, setSelectedDistrictName] = useState(null);

  const statusLabel = envelope?.status === 'live'
    ? 'Live'
    : (envelope?.stale || isStale)
    ? 'Stale'
    : 'Cached';

  // All tomorrow district items
  const allItems = useMemo(() => {
    return districts.map((d) => tomorrowDataByDistrict[d.district]).filter(Boolean);
  }, [districts, tomorrowDataByDistrict]);

  // Ranked descending by predicted probability
  const ranked = useMemo(() => {
    return [...allItems].sort((a, b) => (b.probability ?? -1) - (a.probability ?? -1));
  }, [allItems]);

  // Filtered list
  const filtered = useMemo(() => {
    return ranked.filter((item) => {
      const matchesRisk = riskFilter === 'All' || item.risk_level === riskFilter;
      const matchesType =
        districtFilter === 'All' ||
        (districtFilter === 'Forest districts only' && !item.mixed_agricultural) ||
        (districtFilter === 'Mixed agricultural lowlands only' && item.mixed_agricultural) ||
        item.district === districtFilter;
      return matchesRisk && matchesType;
    });
  }, [ranked, riskFilter, districtFilter]);

  const selectedItem = selectedDistrictName ? tomorrowDataByDistrict[selectedDistrictName] : null;

  // Selected item inputs formatted for BarChart
  const factorData = useMemo(() => {
    if (!selectedItem?.key_inputs) return [];
    const inp = selectedItem.key_inputs;
    return [
      { factor: 'Temp (°C)', value: inp.temp_max ?? 0, unit: '°C' },
      { factor: 'Humidity (%)', value: inp.humidity_mean ?? 0, unit: '%' },
      { factor: 'Wind (km/h)', value: inp.wind_speed_max ?? 0, unit: 'km/h' },
      { factor: 'Rain 24h (mm)', value: inp.rain_sum ?? 0, unit: 'mm' },
      { factor: 'Soil moisture', value: (inp.soil_moisture_mean ?? 0) * 100, unit: '%' },
      { factor: 'Days no rain', value: inp.days_since_rain ?? 0, unit: 'days' },
    ];
  }, [selectedItem]);

  // Map risk lookup
  const mapRiskLookup = useMemo(() => {
    const lookup = {};
    for (const item of allItems) {
      lookup[item.district] = {
        district: item.district,
        caveat: item.caveat,
        mixed_agricultural: item.mixed_agricultural,
        probability: item.probability,
        risk_level: item.risk_level,
        weather_date: item.weather_date,
        risk_for_date: item.risk_for_date,
        lead_days: item.lead_days,
        reliability_note: item.reliability_note,
        score: item.probability != null ? item.probability * 100 : null,
      };
    }
    return lookup;
  }, [allItems]);

  if (loading && !districts.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Prioritization · ML forecast"
          title="Vulnerable areas"
          subtitle="Ranked pre-ignition fire risk predictions based on meteorological and soil moisture features."
        />
        <Loader label={wakingUp ? 'Waking up the server (this may take up to 10 seconds)...' : 'Loading vulnerable areas ranking…'} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Prioritization · ML forecast"
        title="Vulnerable areas"
        subtitle="Ranked pre-ignition fire risk predictions for Uttarakhand districts for tomorrow."
      />

      {/* Replaced formula banner with calibrated ML explanation in the same banner style */}
      <DataNote tone="amber">
        <strong>Pre-ignition prediction model:</strong> ForestGuard predicts the probability of at least one satellite fire detection in the district on the target risk date (day <em>t+1</em>), modeled from antecedent weather observations, evaporative demand (ET0), and topsoil moisture (day <em>t</em>).
        Calibrated operational cut-points: <strong>Low (&lt; 25%)</strong>, <strong>Medium (25%–50%)</strong>, <strong>High (50%–75%)</strong>, and <strong>Extreme (≥ 75%)</strong>.
        <br />
        <span className="mt-1 block text-slate-600 dark:text-slate-300">
          <strong>Lowland caveat:</strong> Haridwar and Udham Singh Nagar reflect seasonal post-harvest crop residue burning without a forest canopy mask. Their scores are labelled <em>&quot;Fire-detection risk (mixed agricultural burning)&quot;</em> and excluded from forest totals by default.
        </span>
      </DataNote>

      {error && (
        <DataNote tone="red">
          <strong>Backend status:</strong> {error}
        </DataNote>
      )}

      {/* 3 KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Districts monitored"
          value={districts.length || 13}
          icon={MapPinned}
          note="11 forest districts · 2 mixed agricultural lowlands"
          source="ForestGuard ML forecast"
          status={statusLabel}
          updatedAt={envelope?.generated_at}
        />
        <StatCard
          label="Forest districts scored"
          value={forestStats.monitoredCount || 11}
          icon={ShieldAlert}
          accent="amber"
          note={`Average detection probability: ${forestStats.averageProbability != null ? formatProbabilityPercent(forestStats.averageProbability) : '—'}`}
          source="ForestGuard ML forecast"
          status={statusLabel}
          updatedAt={envelope?.generated_at}
        />
        <StatCard
          label="Highest predicted risk (tomorrow)"
          value={forestStats.highestDistrict ? forestStats.highestDistrict.district : '—'}
          suffix={forestStats.highestDistrict ? `(${formatProbabilityPercent(forestStats.highestDistrict.probability)})` : ''}
          icon={AlertTriangle}
          accent="red"
          note={forestStats.highestDistrict ? `Risk for ${forestStats.highestDistrict.risk_for_date} (weather on ${forestStats.highestDistrict.weather_date})` : 'Awaiting forecast'}
          source="ForestGuard ML forecast"
          status={statusLabel}
          updatedAt={envelope?.generated_at}
        />
      </div>

      {/* Map & Contributing Factors */}
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="card overflow-hidden">
          <div className="p-4 sm:p-5">
            <p className="eyebrow">District vulnerability map</p>
            <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
              Polygon color = predicted risk tier (tomorrow)
            </h2>
            <SourceLine
              source="ForestGuard ML forecast"
              status={statusLabel}
              fetchedAt={envelope?.generated_at}
            />
          </div>
          <div className="h-[370px]">
            <MapView
              zones={geoFeatures}
              fires={[]}
              riskByName={mapRiskLookup}
              center={REGION.center}
              zoom={REGION.zoom}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[10px] text-slate-500">
            <div className="flex flex-wrap gap-3">
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Low (&lt; 25%)</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Medium (25%–50%)</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-600" />High (50%–75%)</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-600" />Extreme (≥ 75%)</span>
            </div>
            <span className="text-slate-400">Click a zone in the table to inspect input weather</span>
          </div>
        </section>

        <ChartCard
          title="Daily input measurements"
          subtitle={selectedItem ? `${selectedItem.district} · weather on ${selectedItem.weather_date}` : 'Select a district row to inspect daily features.'}
          source="Open-Meteo operational forecast"
          updatedAt={envelope?.generated_at}
        >
          {selectedItem && factorData.length ? (
            <div className="space-y-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={factorData} layout="vertical" margin={{ left: 8, right: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7ece7" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis dataKey="factor" type="category" width={95} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip formatter={(val, name, item) => [`${val} ${item.payload.unit}`, item.payload.factor]} />
                    <Bar dataKey="value" fill="#ea580c" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/70">
                <div className="flex items-center gap-2">
                  <RiskBadge level={selectedItem.risk_level} />
                  <span className="font-semibold text-slate-800 dark:text-white">
                    {formatProbabilityPercent(selectedItem.probability)} probability
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Risk for {selectedItem.risk_for_date} (from weather on {selectedItem.weather_date})
                </p>
                {selectedItem.mixed_agricultural && (
                  <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    Mixed agricultural lowlands: includes post-harvest crop residue burning.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              compact
              title={selectedItem ? 'Inputs unavailable' : 'Select a district'}
              description={selectedItem ? 'Weather input values are not reported.' : 'Click any district in the ranking table below to inspect its weather inputs.'}
            />
          )}
        </ChartCard>
      </div>

      {/* Vulnerability Ranking Table */}
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div>
            <p className="eyebrow">District vulnerability ranking</p>
            <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
              Districts by predicted pre-ignition fire risk (tomorrow)
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="control"
              aria-label="Filter by risk tier"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
            >
              {['All', 'Extreme', 'High', 'Medium', 'Low'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              className="control"
              aria-label="Filter by district type"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
            >
              <option value="All">All districts</option>
              <option value="Forest districts only">Forest districts only (11)</option>
              <option value="Mixed agricultural lowlands only">Mixed agricultural lowlands only (2)</option>
              {districts.map((d) => (
                <option key={d.district} value={d.district}>{d.district}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>District / Terrain</th>
                  <th>Risk tier</th>
                  <th>Predicted probability</th>
                  <th>Forecast date target</th>
                  <th>Contributing conditions &amp; notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, index) => {
                  const isLowland = item.mixed_agricultural;
                  return (
                    <tr
                      key={item.district}
                      onClick={() => setSelectedDistrictName(item.district)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="font-mono text-xs">{String(index + 1).padStart(2, '0')}</td>
                      <td className="font-semibold">
                        {item.district}
                        {isLowland ? (
                          <span className="block text-[10px] font-normal text-amber-600 dark:text-amber-400">
                            Mixed agricultural lowlands (crop residue burning)
                          </span>
                        ) : (
                          <span className="block text-[10px] font-normal text-slate-400">
                            Forest district · Elevation {item.elevation ? `${Math.round(item.elevation)} m` : '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        <RiskBadge level={item.risk_level} />
                      </td>
                      <td className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {formatProbabilityPercent(item.probability)}
                      </td>
                      <td className="text-xs text-slate-600 dark:text-slate-300">
                        {item.risk_for_date}
                        <span className="block text-[10px] text-slate-400">
                          From weather on {item.weather_date}
                        </span>
                      </td>
                      <td className="max-w-xs text-xs text-slate-500">
                        {isLowland ? (
                          <span className="text-amber-700 dark:text-amber-300">
                            Fire-detection risk (mixed agricultural burning)
                          </span>
                        ) : (
                          <span>
                            {item.key_inputs?.temp_max ? `${item.key_inputs.temp_max}°C` : ''} ·{' '}
                            {item.key_inputs?.humidity_mean ? `${item.key_inputs.humidity_mean}% RH` : ''} ·{' '}
                            {item.key_inputs?.wind_speed_max ? `${item.key_inputs.wind_speed_max} km/h wind` : ''} ·{' '}
                            {item.key_inputs?.days_since_rain != null ? `${item.key_inputs.days_since_rain}d dry` : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No matching districts"
            description="No districts matched the selected risk tier and region filter."
          />
        )}
      </section>

      {/* Detail Drawer */}
      <Drawer
        open={Boolean(selectedItem)}
        title={selectedItem ? `${selectedItem.district} · Risk details` : 'District details'}
        onClose={() => setSelectedDistrictName(null)}
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <RiskBadge level={selectedItem.risk_level} />
              <span className="font-mono text-xs font-bold">
                {formatProbabilityPercent(selectedItem.probability)} probability
              </span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
              <p className="text-[10px] text-slate-500">Probability semantics:</p>
              <p className="mt-1 font-semibold text-slate-800 dark:text-white">
                Probability of at least one satellite fire detection in {selectedItem.district} on {selectedItem.risk_for_date}.
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Modeled from antecedent weather observations on {selectedItem.weather_date}.
              </p>
            </div>

            {selectedItem.mixed_agricultural && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <strong>Agricultural Lowland Caveat:</strong> {selectedItem.caveat || 'Thermal detections reflect seasonal post-harvest crop residue burning without a forest canopy mask.'}
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Key conditions (heuristic, not model attribution)
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Rule-based physical meteorological indicators for field context.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Maximum temperature</span>
                  <p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-white">
                    {selectedItem.key_inputs?.temp_max != null ? `${selectedItem.key_inputs.temp_max} °C` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Relative humidity</span>
                  <p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-white">
                    {selectedItem.key_inputs?.humidity_mean != null ? `${selectedItem.key_inputs.humidity_mean} %` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Wind speed max</span>
                  <p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-white">
                    {selectedItem.key_inputs?.wind_speed_max != null ? `${selectedItem.key_inputs.wind_speed_max} km/h` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Precipitation 24h</span>
                  <p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-white">
                    {selectedItem.key_inputs?.rain_sum != null ? `${selectedItem.key_inputs.rain_sum} mm` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Topsoil volumetric moisture</span>
                  <p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-white">
                    {selectedItem.key_inputs?.soil_moisture_mean != null ? `${selectedItem.key_inputs.soil_moisture_mean} m³/m³` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Days without rain</span>
                  <p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-white">
                    {selectedItem.key_inputs?.days_since_rain != null ? `${selectedItem.key_inputs.days_since_rain} days` : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 text-[10px] text-slate-400 dark:border-slate-800">
              Source: ForestGuard ML forecast · Generated {dateLabel(envelope?.generated_at)}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
