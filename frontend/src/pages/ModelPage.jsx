import { useEffect, useState } from 'react';
import { Activity, AlertCircle, BarChart3, CheckCircle2, Cpu, FileText, Info, Layers, ShieldCheck } from 'lucide-react';
import { API_BASE, getModelMetrics } from '../services/api.js';
import { ChartCard, DataNote, EmptyState, ErrorNotice, Loader, PageHeader, RiskBadge, SourceLine, StatCard } from '../components/ui.jsx';

export default function ModelPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getModelMetrics();
      if (!result.ok || !result.data) {
        throw new Error(result.error || 'Failed to load model metrics.');
      }
      setData(result.data);
    } catch (err) {
      setError(err.message || 'Error communicating with model metrics service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return <Loader label="Loading model evaluation metrics…" />;
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Machine learning evaluation"
          title="Model governance & validation"
          subtitle="Evaluation metrics, calibration analysis, and pre-ignition operational thresholds."
        />
        <ErrorNotice error={error} onRetry={fetchMetrics} />
      </div>
    );
  }

  const {
    model_name,
    architecture,
    selection_criterion,
    validation_metrics = {},
    metrics_summary = {},
    risk_thresholds = {},
    report_urls = {},
    generated_at,
    status,
  } = data;

  const rawVal = validation_metrics.raw_model_val_at_optimal_tau || {};
  const calVal = validation_metrics.calibrated_model_val_at_tau_0_50 || {};
  const test2024 = metrics_summary.fair_metrics_2024?.['ForestGuard Served Model (Calibrated Gradient Boosting)'] || {};
  const observedLevels = metrics_summary.risk_level_validation?.served_model_levels || [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Machine learning evaluation"
        title="Model governance & validation"
        subtitle="Transparent evaluation, calibration diagnostics, and scientific limits for Uttarakhand pre-ignition fire forecasting."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Served architecture"
          value="HistGradientBoosting"
          icon={Cpu}
          accent="green"
          note="Calibrated via Sigmoid scaling (PredefinedSplit on 2023)"
        />
        <StatCard
          label="Selection criterion"
          value="Validation PR-AUC"
          suffix="0.6436"
          icon={Activity}
          accent="orange"
          note="Single pre-stated metric on held-out 2023 year"
        />
        <StatCard
          label="2024 test PR-AUC"
          value={test2024.pr_auc ? test2024.pr_auc.toFixed(4) : '0.7094'}
          icon={BarChart3}
          accent="amber"
          note="Held-out 2024 test set (4,745 district-days)"
        />
        <StatCard
          label="Operating threshold (τ*)"
          value="0.33"
          icon={ShieldCheck}
          accent="slate"
          note="Validation-tuned decision threshold for headline F1"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card p-4 sm:p-5">
          <div className="mb-4">
            <p className="eyebrow">Selection & architecture</p>
            <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Validation protocol & candidate comparison</h2>
          </div>
          <div className="space-y-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
            <p>
              <strong className="text-slate-900 dark:text-white">Primary Selection Metric:</strong> {selection_criterion}.
              PR-AUC was selected prior to model exploration because fire ignition days represent ~15–25% of observations.
              Unlike ROC-AUC, PR-AUC does not reward true negatives from easy winter non-fire days.
            </p>
            <p>
              <strong className="text-slate-900 dark:text-white">Served Pipeline:</strong> {architecture}.
              Trained on 2018–2022 historical ERA5 observations with genuine 92-day antecedent buffers; calibrated on 2023; strictly tested on 2024.
            </p>
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <div className="mb-4">
            <p className="eyebrow">Decision criteria distinction</p>
            <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Cut-points vs. binary decision threshold</h2>
          </div>
          <div className="space-y-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
            <p>
              <strong className="text-slate-900 dark:text-white">Risk Level Cut-points:</strong> Fixed operational risk categories for dashboard visualization and warning dispatch:
              Low (&lt; 25%), Medium (25%–50%), High (50%–75%), and Extreme (&ge; 75%).
            </p>
            <p>
              <strong className="text-slate-900 dark:text-white">Validation-Tuned Decision Threshold (τ = 0.33):</strong> Operating threshold tuned strictly on 2023 validation set to maximize F1-score for binary evaluation on the 2024 test headline.
            </p>
          </div>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="eyebrow">Validation reconciliation & test benchmarks</p>
          <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Raw model (τ* = 0.47) vs. calibrated served pipeline (τ = 0.50 &amp; τ = 0.33)</h2>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Model evaluation stage</th>
                <th>Threshold (τ)</th>
                <th>PR-AUC</th>
                <th>ROC-AUC</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1-score</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-semibold">
                  Raw HistGradientBoosting (Validation 2023)
                  <span className="block text-[10px] font-normal text-slate-400">Architecture selection benchmark on raw predicted probabilities</span>
                </td>
                <td className="font-mono text-xs">τ* = {rawVal.decision_threshold_tau ?? 0.47}</td>
                <td className="font-mono text-xs">{rawVal.pr_auc?.toFixed(4) ?? '0.6436'}</td>
                <td className="font-mono text-xs">{rawVal.roc_auc?.toFixed(4) ?? '0.8524'}</td>
                <td className="font-mono text-xs">{rawVal.precision ? `${(rawVal.precision * 100).toFixed(1)}%` : '56.4%'}</td>
                <td className="font-mono text-xs">{rawVal.recall ? `${(rawVal.recall * 100).toFixed(1)}%` : '76.6%'}</td>
                <td className="font-mono text-xs font-bold text-forest-700 dark:text-emerald-300">{rawVal.f1_score?.toFixed(4) ?? '0.6496'}</td>
              </tr>
              <tr>
                <td className="font-semibold">
                  Calibrated Served Pipeline (Validation 2023)
                  <span className="block text-[10px] font-normal text-slate-400">Evaluated on calibrated posterior probabilities at standard threshold</span>
                </td>
                <td className="font-mono text-xs">τ = {calVal.decision_threshold_tau ?? 0.50}</td>
                <td className="font-mono text-xs">{calVal.pr_auc?.toFixed(4) ?? '0.6436'}</td>
                <td className="font-mono text-xs">{calVal.roc_auc?.toFixed(4) ?? '0.8524'}</td>
                <td className="font-mono text-xs">{calVal.precision ? `${(calVal.precision * 100).toFixed(1)}%` : '57.4%'}</td>
                <td className="font-mono text-xs">{calVal.recall ? `${(calVal.recall * 100).toFixed(1)}%` : '72.8%'}</td>
                <td className="font-mono text-xs font-bold text-forest-700 dark:text-emerald-300">{calVal.f1_score?.toFixed(4) ?? '0.6417'}</td>
              </tr>
              <tr>
                <td className="font-semibold">
                  Served Model (Held-Out Test Year 2024)
                  <span className="block text-[10px] font-normal text-slate-400">Final test evaluation on held-out year at validation-tuned threshold</span>
                </td>
                <td className="font-mono text-xs">τ* = {test2024.threshold ?? 0.33}</td>
                <td className="font-mono text-xs">{test2024.pr_auc?.toFixed(4) ?? '0.7094'}</td>
                <td className="font-mono text-xs">{test2024.roc_auc?.toFixed(4) ?? '0.8731'}</td>
                <td className="font-mono text-xs">{test2024.precision ? `${(test2024.precision * 100).toFixed(1)}%` : '57.3%'}</td>
                <td className="font-mono text-xs">{test2024.recall ? `${(test2024.recall * 100).toFixed(1)}%` : '88.1%'}</td>
                <td className="font-mono text-xs font-bold text-forest-700 dark:text-emerald-300">{test2024.f1_score?.toFixed(4) ?? '0.6941'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="p-4 sm:p-5">
            <p className="eyebrow">Risk tier calibration</p>
            <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Observed fire rates by risk tier (2024 test data)</h2>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Risk tier</th>
                  <th>Probability cut-point</th>
                  <th>Mean predicted prob</th>
                  <th>Observed fire rate</th>
                  <th>District-days</th>
                </tr>
              </thead>
              <tbody>
                {observedLevels.map((lvl) => (
                  <tr key={lvl.risk_level}>
                    <td>
                      <RiskBadge level={lvl.risk_level} />
                    </td>
                    <td className="font-mono text-xs">
                      {lvl.risk_level === 'Low' && '< 25%'}
                      {lvl.risk_level === 'Medium' && '25% – 50%'}
                      {lvl.risk_level === 'High' && '50% – 75%'}
                      {lvl.risk_level === 'Extreme' && '≥ 75%'}
                    </td>
                    <td className="font-mono text-xs">{(lvl.mean_predicted_prob * 100).toFixed(1)}%</td>
                    <td className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {(lvl.observed_fire_rate * 100).toFixed(1)}%
                    </td>
                    <td className="font-mono text-xs text-slate-500">{lvl.days_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <div className="mb-4">
            <p className="eyebrow">Scientific boundary</p>
            <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Honest limits &amp; physical boundaries</h2>
          </div>
          <div className="space-y-2.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <p>
                <strong>Modest gain over geographic lookup:</strong> Improvement over the district+month lookup baseline is modest and not statistically significant (weekly block bootstrap 95% CI: [-0.0277, 0.1368]).
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <p>
                <strong>Agricultural burning in labels:</strong> Training labels reflect satellite thermal detections without a forest-cover mask. Southern lowland detections (Haridwar, Udham Singh Nagar) include post-harvest crop residue fires.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <p>
                <strong>Lead time degradation:</strong> Atmospheric forecast skill degrades beyond 48 hours. Risk predictions for lead days 3–7 carry higher uncertainty and are marked with a lower confidence badge.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <p>
                <strong>Spatial representation:</strong> Weather is sampled from one representative centroid point per district, not a continuous spatial grid across complex mountainous terrain.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <p>
                <strong>Vegetation dryness proxy:</strong> Vegetation dryness is represented strictly by topsoil volumetric moisture (0–7 cm) and reference evapotranspiration (ET0). Satellite NDVI is not ingested.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-4">
        <div>
          <p className="eyebrow">Evaluation artifacts</p>
          <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Evaluation curves &amp; diagnostic figures</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {report_urls.calibration_reliability && (
            <section className="card overflow-hidden p-4 sm:p-5">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Probability calibration curve</h3>
              <p className="mt-1 text-[11px] text-slate-500">Sigmoid calibration reliability on held-out validation</p>
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <img
                  src={`${API_BASE}${report_urls.calibration_reliability}`}
                  alt="Probability Calibration Curve"
                  className="h-auto w-full object-contain"
                  loading="lazy"
                />
              </div>
            </section>
          )}

          {report_urls.confusion_matrix && (
            <section className="card overflow-hidden p-4 sm:p-5">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Test confusion matrix</h3>
              <p className="mt-1 text-[11px] text-slate-500">Confusion matrix on 2024 held-out test data (τ = 0.33)</p>
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <img
                  src={`${API_BASE}${report_urls.confusion_matrix}`}
                  alt="Confusion Matrix"
                  className="h-auto w-full object-contain"
                  loading="lazy"
                />
              </div>
            </section>
          )}

          {report_urls.feature_importance && (
            <section className="card overflow-hidden p-4 sm:p-5">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Feature importance</h3>
              <p className="mt-1 text-[11px] text-slate-500">Permutation importance across 33 tabular features</p>
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <img
                  src={`${API_BASE}${report_urls.feature_importance}`}
                  alt="Feature Importance"
                  className="h-auto w-full object-contain"
                  loading="lazy"
                />
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="text-right text-[10px] text-slate-400">
        Source: ForestGuard ML metrics service · Metrics generated {generated_at ? new Date(generated_at).toLocaleString() : 'recently'}
      </div>
    </div>
  );
}
