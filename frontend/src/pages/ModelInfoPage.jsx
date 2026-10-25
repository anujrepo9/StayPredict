import { useState, useEffect } from "react";
import { Info, AlertTriangle } from "lucide-react";
import { analyticsApi } from "../services/api";

export default function ModelInfoPage() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.model()
      .then(r => setInfo(r.data.modelInfo))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <Info size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>Model Information</h2>
      </div>
      <div className="page-body" style={{ maxWidth: 800, margin: "0 auto" }}>

        {!info ? (
          <div className="alert alert-warning">
            <AlertTriangle size={18} />
            <div><strong>ML service unavailable.</strong> Start the Python ML service with: <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 4 }}>uvicorn app.main:app --port 8000</code> from the <code>ml-service/</code> directory.</div>
          </div>
        ) : (
          <>
            {info.is_synthetic_data && (
              <div className="alert alert-warning" style={{ marginBottom: 20 }}>
                <AlertTriangle size={18} />
                <div><strong>Synthetic Dataset.</strong> This model was trained on synthetically generated data for demonstration purposes. Performance metrics do not reflect real clinical accuracy and should not be used for actual medical decisions.</div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              {/* Model overview */}
              <div className="card">
                <div className="card-header"><span className="card-title">Model Overview</span></div>
                <div className="card-body">
                  {[
                    ["Algorithm", "Random Forest Regressor"],
                    ["Model Version", info.model_version || "—"],
                    ["Trained At", info.trained_at ? new Date(info.trained_at).toLocaleString() : "—"],
                    ["Dataset Source", info.dataset_source || "—"],
                    ["Train Records", info.train_records?.toLocaleString() || "—"],
                    ["Test Records", info.test_records?.toLocaleString() || "—"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: ".875rem" }}>
                      <span style={{ color: "#64748b" }}>{k}</span>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance metrics */}
              <div className="card">
                <div className="card-header"><span className="card-title">Test Set Performance</span></div>
                <div className="card-body">
                  {[
                    ["MAE (Mean Abs Error)", info.mae != null ? `${info.mae} days` : "—", "Average prediction error in days"],
                    ["RMSE", info.rmse != null ? `${info.rmse} days` : "—", "Root mean square error"],
                    ["R² Score", info.r2 != null ? info.r2.toFixed(4) : "—", "Variance explained (1.0 = perfect)"],
                  ].map(([k, v, note]) => (
                    <div key={k} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: ".875rem", color: "#64748b" }}>{k}</span>
                        <span style={{ fontWeight: 700, fontSize: ".95rem" }}>{v}</span>
                      </div>
                      <div style={{ fontSize: ".72rem", color: "#94a3b8", marginTop: 2 }}>{note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><span className="card-title">Input Features (Admission-Time Only)</span></div>
              <div className="card-body">
                <div style={{ marginBottom: 12, fontSize: ".82rem", color: "#64748b" }}>Only features available at or before admission are used — no post-admission data, discharge details, or outcomes.</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[...(info.features?.numerical || []), ...(info.features?.categorical || [])].map(f => (
                    <span key={f} className="badge badge-navy" style={{ fontSize: ".8rem", padding: "5px 12px" }}>{f.replace(/_/g, " ")}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Feature importance */}
            {info.feature_importance && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header"><span className="card-title">Feature Importance</span></div>
                <div className="card-body">
                  {Object.entries(info.feature_importance).sort((a,b) => b[1]-a[1]).map(([feat, imp]) => (
                    <div key={feat} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".83rem", marginBottom: 4 }}>
                        <span style={{ textTransform: "capitalize" }}>{feat.replace(/_/g, " ")}</span>
                        <span style={{ fontWeight: 600 }}>{(imp * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4 }}>
                        <div style={{ width: `${imp * 100}%`, height: "100%", background: "#0d9488", borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interval info */}
            {info.interval_info && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header"><span className="card-title">Prediction Interval Method</span></div>
                <div className="card-body" style={{ fontSize: ".875rem" }}>
                  <div className="form-grid">
                    <div><div style={{ color: "#64748b", fontSize: ".78rem" }}>Method</div><div style={{ fontWeight: 600 }}>{info.interval_info.method?.replace(/_/g, " ")}</div></div>
                    <div><div style={{ color: "#64748b", fontSize: ".78rem" }}>Nominal Coverage</div><div style={{ fontWeight: 600 }}>{(info.interval_info.nominal_coverage * 100).toFixed(0)}%</div></div>
                    <div><div style={{ color: "#64748b", fontSize: ".78rem" }}>Actual Test Coverage</div><div style={{ fontWeight: 600 }}>{info.interval_info.actual_test_coverage != null ? `${(info.interval_info.actual_test_coverage * 100).toFixed(1)}%` : "—"}</div></div>
                  </div>
                  <div className="alert alert-warning" style={{ marginTop: 14, fontSize: ".8rem" }}>
                    <AlertTriangle size={14} />{info.interval_info.warning}
                  </div>
                </div>
              </div>
            )}

            {/* Limitations */}
            <div className="card">
              <div className="card-header"><span className="card-title">Limitations & Disclaimers</span></div>
              <div className="card-body" style={{ fontSize: ".875rem", lineHeight: 1.8, color: "#334155" }}>
                <ul style={{ paddingLeft: 20 }}>
                  <li>Trained on {info.is_synthetic_data ? "synthetic" : "publicly available"} data — real-world accuracy may differ significantly.</li>
                  <li>Prediction intervals are empirical (10th–90th percentile of tree outputs), not statistically calibrated confidence intervals.</li>
                  <li>Prolonged-stay probability is an experimental model-based score, not a calibrated clinical probability.</li>
                  <li>This system is for academic demonstration and operational decision support only — not autonomous medical decision-making.</li>
                  <li>This application is not HIPAA-compliant or certified for real hospital deployment. Real deployment requires legal, clinical, privacy, security, and infrastructure review.</li>
                  <li>Clinicians retain full authority over actual care and discharge decisions.</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
