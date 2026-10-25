import { useState, useEffect, useCallback } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { adminApi } from "../services/api";

const CAT_BADGE = { auth: "badge-navy", admission: "badge-teal", prediction: "badge-green", bed: "badge-orange", barrier: "badge-yellow", user_mgmt: "badge-red", system: "badge-gray" };

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.auditLogs({ page, limit: 50, category: category || undefined })
      .then(r => { setLogs(r.data.logs); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, category]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="page-header">
        <FileText size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>Audit Log <span style={{ fontSize: ".85rem", color: "#64748b", fontWeight: 400 }}>({total} events)</span></h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <select className="form-select" style={{ width: 150, padding: "7px 10px", fontSize: ".8rem" }} value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {["auth","admission","prediction","bed","barrier","user_mgmt","system"].map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>
      <div className="page-body">
        <div className="card">
          {loading ? <div className="loading-center"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Timestamp</th><th>Category</th><th>Action</th><th>Performed By</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {logs.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "#64748b" }}>No audit events found.</td></tr>}
                  {logs.map(l => (
                    <tr key={l._id}>
                      <td style={{ fontSize: ".78rem", color: "#64748b", whiteSpace: "nowrap" }}>{new Date(l.createdAt).toLocaleString()}</td>
                      <td><span className={`badge ${CAT_BADGE[l.category] || "badge-gray"}`} style={{ fontSize: ".72rem" }}>{l.category}</span></td>
                      <td style={{ fontSize: ".85rem", fontWeight: 500 }}>{l.action}</td>
                      <td style={{ fontSize: ".82rem" }}>
                        <div>{l.performedBy?.name || "System"}</div>
                        <div style={{ color: "#94a3b8", fontSize: ".73rem" }}>{l.performedByEmail || l.performedBy?.email}</div>
                      </td>
                      <td>
                        <span className={`badge ${l.success ? "badge-green" : "badge-red"}`} style={{ fontSize: ".72rem" }}>
                          {l.success ? "✓ Success" : "✗ Failed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > 50 && (
            <div style={{ padding: "12px 20px" }}>
              <div className="pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p-1)}>‹ Prev</button>
                <span style={{ fontSize: ".8rem", color: "#64748b" }}>Page {page}</span>
                <button className="page-btn" disabled={logs.length < 50} onClick={() => setPage(p => p+1)}>Next ›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
