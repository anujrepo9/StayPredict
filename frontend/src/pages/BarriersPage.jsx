import { useState, useEffect, useCallback } from "react";
import { ShieldAlert, Plus, X } from "lucide-react";
import { barrierApi, admissionApi } from "../services/api";

const STATUS_BADGE = { open: "badge-red", in_progress: "badge-orange", resolved: "badge-green" };
const PRIORITY_BADGE = { low: "badge-gray", medium: "badge-yellow", high: "badge-red" };
const TYPES = ["pharmacy_authorization","medical_transport","post_acute_placement","insurance_approval","family_notification","equipment","other"];

export default function BarriersPage() {
  const [barriers, setBarriers] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [admissions, setAdmissions] = useState([]);
  const [form, setForm] = useState({ admissionId: "", patientProfileId: "", type: "pharmacy_authorization", priority: "medium", description: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    barrierApi.list({ status: statusFilter || undefined, limit: 50 })
      .then(r => { setBarriers(r.data.barriers); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    admissionApi.list({ limit: 50, status: "admitted,under_treatment,pending_discharge" })
      .then(r => setAdmissions(r.data.admissions || []))
      .catch(() => {});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleAdmissionChange = e => {
    const adm = admissions.find(a => a._id === e.target.value);
    setForm(f => ({ ...f, admissionId: e.target.value, patientProfileId: adm?.patientProfileId?._id || "" }));
  };

  const submit = async e => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      await barrierApi.create(form);
      setShowForm(false);
      setForm({ admissionId: "", patientProfileId: "", type: "pharmacy_authorization", priority: "medium", description: "", notes: "" });
      load();
    } catch (err) { setError(err.response?.data?.error || "Failed to create barrier"); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    try { await barrierApi.update(id, { status }); load(); }
    catch (err) { alert(err.response?.data?.error || "Update failed"); }
  };

  // Summary counts
  const counts = { open: barriers.filter(b => b.status === "open").length, in_progress: barriers.filter(b => b.status === "in_progress").length, resolved: barriers.filter(b => b.status === "resolved").length };

  return (
    <>
      <div className="page-header">
        <ShieldAlert size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>Discharge Barriers <span style={{ fontSize: ".85rem", color: "#64748b", fontWeight: 400 }}>({total})</span></h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <select className="form-select" style={{ width: 140, padding: "7px 10px", fontSize: ".8rem" }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}><Plus size={14} /> Add Barrier</button>
        </div>
      </div>

      <div className="page-body">
        {/* Summary cards */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          {[["Open", counts.open, "#ef4444", "#fef2f2"], ["In Progress", counts.in_progress, "#f97316", "#fff7ed"], ["Resolved", counts.resolved, "#22c55e", "#f0fdf4"]].map(([label, count, color, bg]) => (
            <div key={label} style={{ flex: 1, background: bg, border: `1px solid ${color}22`, borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 700, color }}>{count}</div>
              <div style={{ fontSize: ".8rem", color: "#64748b" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Add barrier form */}
        {showForm && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">New Discharge Barrier</span>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><X size={18} /></button>
            </div>
            <div className="card-body">
              {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
              <form onSubmit={submit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Admission *</label>
                    <select className="form-select" value={form.admissionId} onChange={handleAdmissionChange} required>
                      <option value="">— Select admission —</option>
                      {admissions.map(a => <option key={a._id} value={a._id}>{a.patientProfileId?.name} — {a.medicalCondition} ({a.admissionType})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Barrier Type *</label>
                    <select className="form-select" value={form.type} onChange={set("type")}>
                      {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-select" value={form.priority} onChange={set("priority")}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea className="form-textarea" rows={2} value={form.description} onChange={set("description")} required maxLength={500} placeholder="Describe the barrier…" />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows={2} value={form.notes} onChange={set("notes")} maxLength={1000} placeholder="Additional notes…" />
                </div>
                <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Create Barrier"}</button>
              </form>
            </div>
          </div>
        )}

        {/* Barriers table */}
        <div className="card">
          {loading ? <div className="loading-center"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Patient</th><th>Type</th><th>Priority</th><th>Description</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {barriers.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#64748b" }}>No barriers found.</td></tr>}
                  {barriers.map(b => (
                    <tr key={b._id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: ".875rem" }}>{b.patientProfileId?.name || "—"}</div>
                        <div style={{ fontSize: ".75rem", color: "#64748b" }}>{b.patientProfileId?.demoId}</div>
                      </td>
                      <td style={{ fontSize: ".83rem" }}>{b.type.replace(/_/g, " ")}</td>
                      <td><span className={`badge ${PRIORITY_BADGE[b.priority]}`}>{b.priority}</span></td>
                      <td style={{ fontSize: ".83rem", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.description}</td>
                      <td><span className={`badge ${STATUS_BADGE[b.status]}`}>{b.status.replace(/_/g, " ")}</span></td>
                      <td style={{ fontSize: ".78rem", color: "#64748b" }}>{new Date(b.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {b.status === "open" && <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(b._id, "in_progress")}>Start</button>}
                          {b.status === "in_progress" && <button className="btn btn-primary btn-sm" onClick={() => updateStatus(b._id, "resolved")}>Resolve</button>}
                        </div>
                      </td>
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
