import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ClipboardList, Activity, AlertCircle, ArrowLeft } from "lucide-react";
import { admissionApi } from "../services/api";

const STATUS_OPTS = ["admitted","under_treatment","pending_discharge","discharged"];
const RISK_BADGE = { "Low Risk": "badge-green", "Standard Risk": "badge-orange", "Elevated Risk": "badge-red" };

export default function AdmissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [admission, setAdmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = () => {
    setLoading(true);
    admissionApi.get(id).then(r => { setAdmission(r.data.admission); setStatus(r.data.admission.status); }).catch(() => setError("Admission not found")).finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const runPrediction = async () => {
    setPredicting(true); setError("");
    try { const r = await admissionApi.predict(id); setAdmission(a => ({ ...a, latestPredictionId: r.data.prediction })); }
    catch (err) { setError(err.response?.data?.error || "Prediction failed"); }
    finally { setPredicting(false); }
  };

  const updateStatus = async () => {
    setUpdating(true);
    try { await admissionApi.update(id, { status }); load(); }
    catch (err) { setError(err.response?.data?.error || "Update failed"); setUpdating(false); }
  };

  const fmt = d => d ? new Date(d).toLocaleString() : "—";

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!admission) return <div className="page-body"><div className="alert alert-error">Admission not found</div></div>;

  const pred = admission.latestPredictionId;
  const patient = admission.patientProfileId;

  return (
    <>
      <div className="page-header">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate("/admissions")}><ArrowLeft size={14} /></button>
        <ClipboardList size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>Admission Detail</h2>
      </div>
      <div className="page-body" style={{ maxWidth: 800, margin: "0 auto" }}>
        {error && <div className="alert alert-error"><AlertCircle size={16} />{error}</div>}

        {/* Patient info */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Patient</span></div>
          <div className="card-body">
            <div className="form-grid">
              {[["Name", patient?.name],["Demo ID", patient?.demoId],["Age", patient?.age],["Gender", patient?.gender],["Blood Group", patient?.bloodGroup]].map(([k,v]) => (
                <div key={k}><div style={{ fontSize: ".75rem", color: "#64748b" }}>{k}</div><div style={{ fontWeight: 600 }}>{v || "—"}</div></div>
              ))}
            </div>
          </div>
        </div>

        {/* Admission info */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Admission</span>
            <div style={{ display: "flex", gap: 8 }}>
              <select className="form-select" style={{ width: 180, padding: "6px 10px", fontSize: ".8rem" }} value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={updateStatus} disabled={updating}>{updating ? "…" : "Update"}</button>
            </div>
          </div>
          <div className="card-body">
            <div className="form-grid">
              {[["Admitted", fmt(admission.admissionDate)],["Type", admission.admissionType],["Condition", admission.medicalCondition],["Insurance", admission.insurance],["Ward", admission.wardId?.name || "—"],["Bed", admission.bedId?.bedNumber || "—"]].map(([k,v]) => (
                <div key={k}><div style={{ fontSize: ".75rem", color: "#64748b" }}>{k}</div><div style={{ fontWeight: 600 }}>{v}</div></div>
              ))}
            </div>
            {admission.notes && <div style={{ marginTop: 14, fontSize: ".85rem", color: "#64748b" }}><strong>Notes:</strong> {admission.notes}</div>}
          </div>
        </div>

        {/* Prediction panel */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">LOS Prediction</span>
            <button className="btn btn-primary btn-sm" onClick={runPrediction} disabled={predicting}>
              <Activity size={14} />{predicting ? "Predicting…" : "Re-run Prediction"}
            </button>
          </div>
          <div className="card-body">
            {!pred
              ? <div style={{ textAlign: "center", padding: "24px 0", color: "#64748b", fontSize: ".875rem" }}>No prediction yet — click "Re-run Prediction" to get an AI estimate.</div>
              : <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div style={{ textAlign: "center", padding: 16, background: "#f0fdfa", borderRadius: 8 }}>
                      <div style={{ fontSize: "2rem", fontWeight: 700, color: "#0d9488" }}>{pred.predictedLosDays}d</div>
                      <div style={{ fontSize: ".78rem", color: "#64748b" }}>Predicted LOS</div>
                      <div style={{ fontSize: ".72rem", color: "#94a3b8" }}>{pred.intervalLower}–{pred.intervalHigh} days (80% interval)</div>
                    </div>
                    <div style={{ textAlign: "center", padding: 16, background: "#f8fafc", borderRadius: 8 }}>
                      <div style={{ fontSize: "2rem", fontWeight: 700 }}>{Math.round((pred.prolongedStayProbability || 0) * 100)}%</div>
                      <div style={{ fontSize: ".78rem", color: "#64748b" }}>Prolonged Stay Score</div>
                    </div>
                    <div style={{ textAlign: "center", padding: 16, background: "#f8fafc", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <span className={`badge ${RISK_BADGE[pred.riskCategory]}`}>{pred.riskCategory}</span>
                      <div style={{ fontSize: ".78rem", color: "#64748b" }}>Risk Category</div>
                    </div>
                  </div>
                  <div className="disclaimer" style={{ marginBottom: 12 }}>⚠️ {pred.disclaimer}</div>
                  <button className="btn btn-outline btn-sm" onClick={() => navigate(`/predictions/${pred._id}`)}>Full Prediction Details →</button>
                </div>
            }
          </div>
        </div>
      </div>
    </>
  );
}
