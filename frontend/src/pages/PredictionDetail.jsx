import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stethoscope, ArrowLeft, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { predictionApi } from "../services/api";

const RISK_COLOR = { "Low Risk": "#22c55e", "Standard Risk": "#f97316", "Elevated Risk": "#ef4444" };
const RISK_BADGE = { "Low Risk": "badge-green", "Standard Risk": "badge-orange", "Elevated Risk": "badge-red" };

export default function PredictionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    predictionApi.get(id)
      .then(r => setPrediction(r.data.prediction))
      .catch(() => setError("Prediction not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (error || !prediction) return <div className="page-body"><div className="alert alert-error">{error || "Not found"}</div></div>;

  const prob = Math.round((prediction.prolongedStayProbability || 0) * 100);
  const probColor = prob < 35 ? "#22c55e" : prob <= 65 ? "#f97316" : "#ef4444";

  // Build interval chart data
  const intervalData = [
    { label: "Lower (10th %ile)", days: prediction.intervalLower },
    { label: "Predicted", days: prediction.predictedLosDays },
    { label: "Upper (90th %ile)", days: prediction.intervalHigh },
  ];

  return (
    <>
      <div className="page-header">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}><ArrowLeft size={14} /></button>
        <Stethoscope size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>Prediction Detail</h2>
        <span className={`badge ${RISK_BADGE[prediction.riskCategory]}`} style={{ marginLeft: 8 }}>{prediction.riskCategory}</span>
      </div>

      <div className="page-body" style={{ maxWidth: 820, margin: "0 auto" }}>
        {/* Core metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div className="card" style={{ textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: "3rem", fontWeight: 700, color: "#0d9488", lineHeight: 1 }}>{prediction.predictedLosDays}</div>
            <div style={{ fontSize: ".85rem", color: "#64748b", marginTop: 4 }}>Predicted Days</div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: ".8rem", color: "#64748b", marginBottom: 8 }}>80% Prediction Interval</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{prediction.intervalLower} – {prediction.intervalHigh} days</div>
            <div style={{ fontSize: ".73rem", color: "#94a3b8", marginTop: 4 }}>Empirical tree percentile method · Not statistically calibrated</div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: ".8rem", color: "#64748b", marginBottom: 8 }}>Prolonged Stay Score (&gt;14d)</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: probColor }}>{prob}%</div>
            <div style={{ fontSize: ".73rem", color: "#94a3b8", marginTop: 4 }}>Experimental · Fraction of trees predicting &gt;14 days</div>
          </div>
        </div>

        {/* Interval chart */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">LOS Estimate Range</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={intervalData} layout="vertical">
                <XAxis type="number" domain={[0, Math.ceil(prediction.intervalHigh * 1.2)]} tick={{ fontSize: 11 }} unit="d" />
                <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v} days`} />
                <Bar dataKey="days" fill="#0d9488" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Input features */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Input Features (Admission-Time Snapshot)</span></div>
          <div className="card-body">
            <div className="form-grid">
              {Object.entries(prediction.inputFeatures || {}).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: ".75rem", color: "#64748b" }}>{k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</div>
                  <div style={{ fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Model & Audit</span></div>
          <div className="card-body">
            <div className="form-grid">
              {[
                ["Model Version", prediction.modelVersion],
                ["Predicted At", new Date(prediction.predictedAt).toLocaleString()],
                ["Requested By", prediction.requestedBy?.name || "—"],
                ["Patient", prediction.patientProfileId?.name || "—"],
              ].map(([k, v]) => (
                <div key={k}><div style={{ fontSize: ".75rem", color: "#64748b" }}>{k}</div><div style={{ fontWeight: 600 }}>{v}</div></div>
              ))}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="alert alert-warning" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Important Disclaimer</strong><br />
            {prediction.disclaimer || "This AI-generated estimate is for operational planning only and is not a clinical diagnosis, treatment plan, or medically approved discharge timeline. Actual length of stay is determined solely by the clinical team based on the patient's condition and readiness for discharge."}
          </div>
        </div>
      </div>
    </>
  );
}
