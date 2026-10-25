import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Stethoscope } from "lucide-react";
import { predictionApi } from "../services/api";

const RISK_BADGE = { "Low Risk": "badge-green", "Standard Risk": "badge-orange", "Elevated Risk": "badge-red" };

export default function PredictionsPage() {
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [riskFilter, setRiskFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    predictionApi.list({ page, limit: 20, riskCategory: riskFilter || undefined })
      .then(r => { setPredictions(r.data.predictions); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, riskFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="page-header">
        <Stethoscope size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>Predictions <span style={{ fontSize: ".85rem", color: "#64748b", fontWeight: 400 }}>({total})</span></h2>
        <div style={{ marginLeft: "auto" }}>
          <select className="form-select" style={{ width: 160, padding: "7px 10px", fontSize: ".8rem" }} value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(1); }}>
            <option value="">All Risk Levels</option>
            <option value="Low Risk">Low Risk</option>
            <option value="Standard Risk">Standard Risk</option>
            <option value="Elevated Risk">Elevated Risk</option>
          </select>
        </div>
      </div>
      <div className="page-body">
        <div className="card">
          {loading ? <div className="loading-center"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Patient</th><th>Condition</th><th>Predicted LOS</th><th>80% Interval</th><th>Prolonged Score</th><th>Risk</th><th>Predicted At</th><th></th></tr>
                </thead>
                <tbody>
                  {predictions.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#64748b" }}>No predictions yet.</td></tr>}
                  {predictions.map(p => (
                    <tr key={p._id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: ".875rem" }}>{p.patientProfileId?.name || "—"}</div>
                        <div style={{ fontSize: ".75rem", color: "#64748b" }}>{p.patientProfileId?.demoId}</div>
                      </td>
                      <td style={{ fontSize: ".85rem" }}>{p.admissionId?.medicalCondition || "—"}</td>
                      <td style={{ fontWeight: 700, color: "#0d9488" }}>{p.predictedLosDays}d</td>
                      <td style={{ fontSize: ".82rem", color: "#64748b" }}>{p.intervalLower}–{p.intervalHigh}d</td>
                      <td style={{ fontSize: ".85rem" }}>{Math.round((p.prolongedStayProbability || 0) * 100)}%</td>
                      <td><span className={`badge ${RISK_BADGE[p.riskCategory] || "badge-gray"}`}>{p.riskCategory}</span></td>
                      <td style={{ fontSize: ".8rem", color: "#64748b" }}>{new Date(p.predictedAt).toLocaleString()}</td>
                      <td><button className="btn btn-outline btn-sm" onClick={() => navigate(`/predictions/${p._id}`)}>Details</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
