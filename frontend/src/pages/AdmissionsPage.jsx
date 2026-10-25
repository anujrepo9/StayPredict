import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus, Search, RefreshCw } from "lucide-react";
import { admissionApi } from "../services/api";

const STATUS_BADGE = { admitted: "badge-navy", under_treatment: "badge-teal", pending_discharge: "badge-yellow", discharged: "badge-gray" };
const RISK_BADGE = { "Low Risk": "badge-green", "Standard Risk": "badge-orange", "Elevated Risk": "badge-red" };

export default function AdmissionsPage() {
  const navigate = useNavigate();
  const [admissions, setAdmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    admissionApi.list({ page, limit: 15, status: status || undefined })
      .then(r => { setAdmissions(r.data.admissions); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const fmt = (d) => d ? new Date(d).toLocaleDateString() : "—";

  return (
    <>
      <div className="page-header">
        <ClipboardList size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>Admissions <span style={{ fontSize: ".85rem", color: "#64748b", fontWeight: 400 }}>({total})</span></h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <select className="form-select" style={{ width: 160, padding: "7px 10px", fontSize: ".8rem" }} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="admitted">Admitted</option>
            <option value="under_treatment">Under Treatment</option>
            <option value="pending_discharge">Pending Discharge</option>
            <option value="discharged">Discharged</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /></button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/admissions/new")}><Plus size={14} /> New</button>
        </div>
      </div>

      <div className="page-body">
        <div className="card">
          {loading ? <div className="loading-center"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Patient</th><th>Admitted</th><th>Condition</th><th>Type</th>
                    <th>Status</th><th>Predicted LOS</th><th>Risk</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admissions.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#64748b" }}>No admissions found. <a href="/admissions/new" style={{ color: "#0d9488" }}>Create one →</a></td></tr>
                  )}
                  {admissions.map(a => (
                    <tr key={a._id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: ".875rem" }}>{a.patientProfileId?.name || "Unknown"}</div>
                        <div style={{ fontSize: ".75rem", color: "#64748b" }}>ID: {a.patientProfileId?.demoId}</div>
                      </td>
                      <td style={{ fontSize: ".85rem" }}>{fmt(a.admissionDate)}</td>
                      <td style={{ fontSize: ".85rem" }}>{a.medicalCondition}</td>
                      <td><span className="badge badge-gray" style={{ fontSize: ".73rem" }}>{a.admissionType}</span></td>
                      <td><span className={`badge ${STATUS_BADGE[a.status] || "badge-gray"}`}>{a.status?.replace(/_/g," ")}</span></td>
                      <td style={{ fontWeight: 600 }}>{a.latestPredictionId?.predictedLosDays ? `${a.latestPredictionId.predictedLosDays}d` : <span style={{ color: "#94a3b8", fontSize: ".8rem" }}>Not predicted</span>}</td>
                      <td>{a.latestPredictionId?.riskCategory
                        ? <span className={`badge ${RISK_BADGE[a.latestPredictionId.riskCategory]}`}>{a.latestPredictionId.riskCategory}</span>
                        : "—"}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/admissions/${a._id}`)}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div style={{ padding: "12px 20px" }}>
              <div className="pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
                {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`page-btn${p === page ? " active" : ""}`} onClick={() => setPage(p)}>{p}</button>
                ))}
                <button className="page-btn" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next ›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
