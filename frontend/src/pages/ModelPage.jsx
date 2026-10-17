import { useEffect, useState } from 'react';
import { Activity, BarChart3, Cpu, ShieldCheck } from 'lucide-react';
import { API_BASE, getModelMetrics } from '../services/api.js';
import { EmptyState, ErrorNotice, Loader, PageHeader, RiskBadge, StatCard } from '../components/ui.jsx';

const fmtNum = (val, digits = 4) => (val != null && !isNaN(val) ? Number(val).toFixed(digits) : 'unavailable');
const fmtPct = (val, digits = 1) => (val != null && !isNaN(val) ? `${(Number(val) * 100).toFixed(digits)}%` : 'unavailable');

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
  } = data;

  const rawVal = validation_metrics.raw_model_val_at_optimal_tau || {};
  const calVal = validation_metrics.calibrated_model_val_at_tau_0_50 || {};

  // Fair metrics 2024 test benchmark (ml/reports/metrics.json -> fair_metrics_2024)
  const fairMetrics = metrics_summary.fair_metrics_2024 || {};
  // JSON Path: metrics_summary.fair_metrics_2024['ForestGuard Served Model (Calibrated Gradient Boosting)']
  const testServed = fairMetrics['ForestGuard Served Model (Calibrated Gradient Boosting)'] || {};
  // JSON Path: metrics_summary.fair_metrics_2024['Climatology (District + Month)']
  const climDistMonth = fairMetrics['Climatology (District + Month)'] || {};
  // JSON Path: metrics_summary.fair_metrics_2024['Climatology (Month Only)']
  const climMonthOnly = fairMetrics['Climatology (Month Only)'] || {};
  // JSON Path: metrics_summary.fair_metrics_2024['Logistic Regression (Baseline)']
  const logReg = fairMetrics['Logistic Regression (Baseline)'] || {};
  // JSON Path: metrics_summary.fair_metrics_2024['Rule-Based FWI / Drought Proxy']
  const ruleFwi = fairMetrics['Rule-Based FWI / Drought Proxy'] || {};

  // JSON Path: metrics_summary.rolling_origin_summary.by_year['2024'].fire_prevalence
  const prev2024 = metrics_summary.rolling_origin_summary?.by_year?.['2024']?.fire_prevalence;
  const prevDisplay = fmtPct(prev2024, 1);

  // JSON Path: metrics_summary.gain_reconciliation.bootstrap_ci_95 || metrics_summary.weekly_block_bootstrap.diff_pr_auc_ci
  const ci = metrics_summary.gain_reconciliation?.bootstrap_ci_95 || metrics_summary.weekly_block_bootstrap?.diff_pr_auc_ci;
  const ciText = ci && ci.length === 2 ? `[${Number(ci[0]).toFixed(4)}, ${Number(ci[1]).toFixed(4)}]` : 'unavailable';
  // JSON Path: metrics_summary.gain_reconciliation.bootstrap_mean_gain
  const gainMean = metrics_summary.gain_reconciliation?.bootstrap_mean_gain != null
    ? Number(metrics_summary.gain_reconciliation.bootstrap_mean_gain).toFixed(4)
    : (metrics_summary.weekly_block_bootstrap?.diff_pr_auc_mean != null
      ? Number(metrics_summary.weekly_block_bootstrap.diff_pr_auc_mean).toFixed(4)
      : 'unavailable');

  // JSON Path: metrics_summary.risk_level_validation.served_model_levels
  const observedLevels = metrics_summary.risk_level_validation?.served_model_levels || [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Machine learning evaluation"
        title="Model governance & validation"
        subtitle="Transparent evaluation, calibration diagnostics, and scientific limits for Uttarakhand pre-ignition fire forecasting."
      />

      {/* Headline KPI StatCards (E1: source attribute on all cards) */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Served architecture"
          value="HistGradientBoosting"
          icon={Cpu}
          accent="green"
          note="Calibrated via Sigmoid scaling (PredefinedSplit on 2023)"
          source="ForestGuard ML metrics (ml/reports/metrics.json)"
        />
        <StatCard
          label="Selection criterion"
          value="Validation PR-AUC"
          suffix={rawVal.pr_auc != null ? rawVal.pr_auc.toFixed(4) : (data.selection_record?.validation_pr_auc ? data.selection_record.validation_pr_auc.toFixed(4) : 'unavailable')}
          icon={Activity}
          accent="orange"
          note="Single pre-stated metric on held-out 2023 year"
          source="ForestGuard ML metrics (ml/reports/metrics.json)"
        />
        <StatCard
          label="2024 test PR-AUC"
          value={testServed.pr_auc != null ? testServed.pr_auc.toFixed(4) : 'unavailable'}
          icon={BarChart3}
          accent="amber"
          note={`Held-out 2024 test set (4,745 district-days, prevalence: ${prevDisplay})`}
          source="ForestGuard ML metrics (ml/reports/metrics.json)"
        />
        <StatCard
          label="Operating threshold (τ*)"
          value={testServed.threshold != null ? testServed.threshold.toFixed(2) : (data.served_model?.decision_threshold_tau != null ? data.served_model.decision_threshold_tau.toFixed(2) : 'unavailable')}
          icon={ShieldCheck}
          accent="slate"
          note="Validation-tuned decision threshold for headline F1"
          source="ForestGuard ML metrics (ml/reports/metrics.json)"
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
              <strong className="text-slate-900 dark:text-white">Primary Selection Metric:</strong> {selection_criterion || 'Validation PR-AUC on held-out 2023 validation set'}.
              PR-AUC was selected prior to model exploration because fire ignition days represent ~15–25% of observations (2024 test prevalence: {prevDisplay}).
              Unlike ROC-AUC, PR-AUC does not reward true negatives from easy winter non-fire days.
            </p>
            <p>
              <strong className="text-slate-900 dark:text-white">Served Pipeline:</strong> {architecture || 'CalibratedClassifierCV(HistGradientBoostingClassifier, method=\'sigmoid\')'}.
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
              <strong className="text-slate-900 dark:text-white">Validation-Tuned Decision Threshold (τ* = {testServed.threshold != null ? testServed.threshold.toFixed(2) : '0.33'}):</strong> Operating threshold tuned strictly on 2023 validation set to maximize F1-score for binary evaluation on the 2024 test headline.
            </p>
          </div>
        </section>
      </div>

      {/* Validation Reconciliation: Raw vs Calibrated vs Test 2024 */}
      <section className="card overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="eyebrow">Validation reconciliation & test benchmarks</p>
          <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Raw model (τ* = {rawVal.decision_threshold_tau ?? '0.47'}) vs. calibrated served pipeline (τ = {calVal.decision_threshold_tau ?? '0.50'} &amp; τ* = {testServed.threshold ?? '0.33'})</h2>
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
                <td className="font-mono text-xs">τ* = {rawVal.decision_threshold_tau != null ? rawVal.decision_threshold_tau.toFixed(2) : 'unavailable'}</td>
                <td className="font-mono text-xs">{fmtNum(rawVal.pr_auc)}</td>
                <td className="font-mono text-xs">{fmtNum(rawVal.roc_auc)}</td>
                <td className="font-mono text-xs">{fmtPct(rawVal.precision)}</td>
                <td className="font-mono text-xs">{fmtPct(rawVal.recall)}</td>
                <td className="font-mono text-xs font-bold text-forest-700 dark:text-emerald-300">{fmtNum(rawVal.f1_score)}</td>
              </tr>
              <tr>
                <td className="font-semibold">
                  Calibrated Served Pipeline (Validation 2023)
                  <span className="block text-[10px] font-normal text-slate-400">Evaluated on calibrated posterior probabilities at standard threshold</span>
                </td>
                <td className="font-mono text-xs">τ = {calVal.decision_threshold_tau != null ? calVal.decision_threshold_tau.toFixed(2) : 'unavailable'}</td>
                <td className="font-mono text-xs">{fmtNum(calVal.pr_auc)}</td>
                <td className="font-mono text-xs">{fmtNum(calVal.roc_auc)}</td>
                <td className="font-mono text-xs">{fmtPct(calVal.precision)}</td>
                <td className="font-mono text-xs">{fmtPct(calVal.recall)}</td>
                <td className="font-mono text-xs font-bold text-forest-700 dark:text-emerald-300">{fmtNum(calVal.f1_score)}</td>
              </tr>
              <tr>
                <td className="font-semibold">
                  Served Model (Held-Out Test Year 2024)
                  <span className="block text-[10px] font-normal text-slate-400">Final test evaluation on held-out year at validation-tuned threshold</span>
                </td>
                <td className="font-mono text-xs">τ* = {testServed.threshold != null ? testServed.threshold.toFixed(2) : 'unavailable'}</td>
                <td className="font-mono text-xs">{fmtNum(testServed.pr_auc)}</td>
                <td className="font-mono text-xs">{fmtNum(testServed.roc_auc)}</td>
                <td className="font-mono text-xs">{fmtPct(testServed.precision)}</td>
                <td className="font-mono text-xs">{fmtPct(testServed.recall)}</td>
                <td className="font-mono text-xs font-bold text-forest-700 dark:text-emerald-300">{fmtNum(testServed.f1_score)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Baseline Comparison Table (E5: read dynamically from /model/metrics fair_metrics_2024) */}
      <section className="card overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="eyebrow">Baseline comparison · 2024 test benchmark</p>
          <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Served model vs. climatology &amp; heuristic baselines (Held-out year 2024, N = 4,745)</h2>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Model / Baseline pipeline</th>
                <th>Threshold (τ)</th>
                <th>PR-AUC</th>
                <th>ROC-AUC</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1-score</th>
              </tr>
            </thead>
            <tbody>
              {/* Served Model: metrics_summary.fair_metrics_2024['ForestGuard Served Model (Calibrated Gradient Boosting)'] */}
              <tr className="bg-emerald-50/40 dark:bg-emerald-950/20">
                <td className="font-semibold text-slate-900 dark:text-white">
                  ForestGuard Served Model (Calibrated Gradient Boosting)
                  <span className="block text-[10px] font-normal text-forest-700 dark:text-emerald-400">Selected production model · 33 features</span>
                </td>
                <td className="font-mono text-xs">{testServed.threshold != null ? `τ* = ${testServed.threshold.toFixed(2)}` : 'unavailable'}</td>
                <td className="font-mono text-xs font-bold text-forest-700 dark:text-emerald-300">{fmtNum(testServed.pr_auc)}</td>
                <td className="font-mono text-xs font-bold text-forest-700 dark:text-emerald-300">{fmtNum(testServed.roc_auc)}</td>
                <td className="font-mono text-xs">{fmtPct(testServed.precision)}</td>
                <td className="font-mono text-xs">{fmtPct(testServed.recall)}</td>
                <td className="font-mono text-xs font-bold text-forest-700 dark:text-emerald-300">{fmtNum(testServed.f1_score)}</td>
              </tr>
              {/* Climatology District + Month: metrics_summary.fair_metrics_2024['Climatology (District + Month)'] */}
              <tr>
                <td className="font-semibold">
                  Climatology (District + Month Lookup)
                  <span className="block text-[10px] font-normal text-slate-400">Geographic &amp; calendar baseline</span>
                </td>
                <td className="font-mono text-xs">{climDistMonth.threshold != null ? `τ* = ${climDistMonth.threshold.toFixed(2)}` : 'unavailable'}</td>
                <td className="font-mono text-xs">{fmtNum(climDistMonth.pr_auc)}</td>
                <td className="font-mono text-xs">{fmtNum(climDistMonth.roc_auc)}</td>
                <td className="font-mono text-xs">{fmtPct(climDistMonth.precision)}</td>
                <td className="font-mono text-xs">{fmtPct(climDistMonth.recall)}</td>
                <td className="font-mono text-xs">{fmtNum(climDistMonth.f1_score)}</td>
              </tr>
              {/* Climatology Month Only: metrics_summary.fair_metrics_2024['Climatology (Month Only)'] */}
              <tr>
                <td className="font-semibold">
                  Climatology (Month Only)
                  <span className="block text-[10px] font-normal text-slate-400">Pure seasonal calendar baseline</span>
                </td>
                <td className="font-mono text-xs">{climMonthOnly.threshold != null ? `τ* = ${climMonthOnly.threshold.toFixed(2)}` : 'unavailable'}</td>
                <td className="font-mono text-xs">{fmtNum(climMonthOnly.pr_auc)}</td>
                <td className="font-mono text-xs">{fmtNum(climMonthOnly.roc_auc)}</td>
                <td className="font-mono text-xs">{fmtPct(climMonthOnly.precision)}</td>
                <td className="font-mono text-xs">{fmtPct(climMonthOnly.recall)}</td>
                <td className="font-mono text-xs">{fmtNum(climMonthOnly.f1_score)}</td>
              </tr>
              {/* Logistic Regression: metrics_summary.fair_metrics_2024['Logistic Regression (Baseline)'] */}
              <tr>
                <td className="font-semibold">
                  Logistic Regression (Baseline)
                  <span className="block text-[10px] font-normal text-slate-400">Standardized linear classifier</span>
                </td>
                <td className="font-mono text-xs">{logReg.threshold != null ? `τ* = ${logReg.threshold.toFixed(2)}` : 'unavailable'}</td>
                <td className="font-mono text-xs">{fmtNum(logReg.pr_auc)}</td>
                <td className="font-mono text-xs">{fmtNum(logReg.roc_auc)}</td>
                <td className="font-mono text-xs">{fmtPct(logReg.precision)}</td>
                <td className="font-mono text-xs">{fmtPct(logReg.recall)}</td>
                <td className="font-mono text-xs">{fmtNum(logReg.f1_score)}</td>
              </tr>
              {/* Rule-Based FWI / Drought Proxy: metrics_summary.fair_metrics_2024['Rule-Based FWI / Drought Proxy'] */}
              <tr>
                <td className="font-semibold">
                  Rule-Based FWI / Drought Proxy
                  <span className="block text-[10px] font-normal text-slate-400">Static weather threshold heuristic</span>
                </td>
                <td className="font-mono text-xs">{ruleFwi.threshold != null ? `τ* = ${ruleFwi.threshold.toFixed(4)}` : 'unavailable'}</td>
                <td className="font-mono text-xs">{fmtNum(ruleFwi.pr_auc)}</td>
                <td className="font-mono text-xs">{fmtNum(ruleFwi.roc_auc)}</td>
                <td className="font-mono text-xs">{fmtPct(ruleFwi.precision)}</td>
                <td className="font-mono text-xs">{fmtPct(ruleFwi.recall)}</td>
                <td className="font-mono text-xs">{fmtNum(ruleFwi.f1_score)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Risk Tier Calibration (E3: dynamic values without hardcoding) */}
        <section className="card overflow-hidden">
          <div className="p-4 sm:p-5">
            <p className="eyebrow">Risk tier calibration</p>
            <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Observed fire rates by risk tier (2024 test data)</h2>
          </div>
          {observedLevels.length ? (
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
                      <td className="font-mono text-xs">{fmtPct(lvl.mean_predicted_prob)}</td>
                      <td className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {fmtPct(lvl.observed_fire_rate)}
                      </td>
                      <td className="font-mono text-xs text-slate-500">{lvl.days_count ?? 'unavailable'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <EmptyState compact title="Calibration data unavailable" description="Run ML evaluation pipeline to populate tier validation." />
            </div>
          )}
        </section>

        {/* Scientific Boundary: 4 Honest Limits (E4) */}
        <section className="card p-4 sm:p-5">
          <div className="mb-4">
            <p className="eyebrow">Scientific boundary</p>
            <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Honest limits &amp; physical boundaries</h2>
          </div>
          <div className="space-y-2.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <p>
                <strong>Modest gain over geographic lookup:</strong> Improvement over the district+month lookup baseline is modest and not statistically significant (bootstrap mean difference: +{gainMean}, weekly block bootstrap 95% CI: {ciText}). Broad seasonality and district geography capture baseline risk; daily weather modulates it.
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
                <strong>Vegetation dryness proxy:</strong> Vegetation dryness is represented strictly by topsoil volumetric moisture (0–7 cm) and reference evapotranspiration (ET0). Satellite NDVI is not ingested.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Evaluation Artifacts (E2: caption mentions 2024 held-out test set) */}
      <div className="space-y-4">
        <div>
          <p className="eyebrow">Evaluation artifacts</p>
          <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Evaluation curves &amp; diagnostic figures</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {report_urls.calibration_reliability && (
            <section className="card overflow-hidden p-4 sm:p-5">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Probability calibration curve</h3>
              <p className="mt-1 text-[11px] text-slate-500">Sigmoid calibration reliability on 2024 held-out test set</p>
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
              <p className="mt-1 text-[11px] text-slate-500">Confusion matrix on 2024 held-out test data (τ* = {testServed.threshold ?? '0.33'})</p>
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
