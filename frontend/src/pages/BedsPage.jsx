import { useState, useEffect, useCallback } from "react";
import { BedDouble, Plus, X, RefreshCw } from "lucide-react";
import { wardApi, bedApi } from "../services/api";

const STATUS_COLOR = { available: "#22c55e", occupied: "#ef4444", cleaning: "#f97316", out_of_service: "#94a3b8" };
const STATUS_BG = { available: "#f0fdf4", occupied: "#fef2f2", cleaning: "#fff7ed", out_of_service: "#f8fafc" };
const VALID_TRANSITIONS = { available: ["occupied","out_of_service"], occupied: ["cleaning"], cleaning: ["available","out_of_service"], out_of_service: ["available"] };

export default function BedsPage() {
  const [wards, setWards] = useState([]);
  const [beds, setBeds] = useState([]);
  const [selectedWard, setSelectedWard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWardForm, setShowWardForm] = useState(false);
  const [showBedForm, setShowBedForm] = useState(false);
  const [wardForm, setWardForm] = useState({ name: "", type: "General", totalBeds: 10, floor: 1 });
  const [bedForm, setBedForm] = useState({ bedNumber: "", wardId: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadWards = useCallback(() => {
    setLoading(true);
    wardApi.list()
      .then(r => { setWards(r.data.wards || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadBeds = useCallback((wardId) => {
    if (!wardId) return;
    bedApi.list({ wardId })
      .then(r => setBeds(r.data.beds || []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadWards(); }, [loadWards]);
  useEffect(() => { if (selectedWard) loadBeds(selectedWard._id); }, [selectedWard, loadBeds]);

  const createWard = async e => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      await wardApi.create({ ...wardForm, totalBeds: Number(wardForm.totalBeds), floor: Number(wardForm.floor) });
      setShowWardForm(false); loadWards();
    } catch (err) { setError(err.response?.data?.error || "Failed to create ward"); }
    finally { setSaving(false); }
  };

  const createBed = async e => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      await bedApi.create({ ...bedForm, wardId: selectedWard._id });
      setShowBedForm(false); loadBeds(selectedWard._id);
    } catch (err) { setError(err.response?.data?.error || "Failed to create bed"); }
    finally { setSaving(false); }
  };

  const changeStatus = async (bedId, status) => {
    try {
      await bedApi.updateStatus(bedId, { status });
      loadBeds(selectedWard._id);
      loadWards();
    } catch (err) { alert(err.response?.data?.error || "Status change failed"); }
  };

  const setWF = k => e => setWardForm(f => ({ ...f, [k]: e.target.value }));
  const setBF = k => e => setBedForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <div className="page-header">
        <BedDouble size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>Beds & Wards</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadWards}><RefreshCw size={14} /></button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowWardForm(v => !v)}><Plus size={14} /> Add Ward</button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {/* Add Ward form */}
        {showWardForm && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">New Ward</span>
              <button onClick={() => setShowWardForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><X size={18} /></button>
            </div>
            <div className="card-body">
              <form onSubmit={createWard}>
                <div className="form-grid">
                  <div className="form-group"><label className="form-label">Ward Name *</label><input className="form-input" value={wardForm.name} onChange={setWF("name")} required /></div>
                  <div className="form-group"><label className="form-label">Type *</label>
                    <select className="form-select" value={wardForm.type} onChange={setWF("type")}>
                      {["General","ICU","Emergency","Surgical","Pediatric","Maternity","Oncology"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Total Beds</label><input className="form-input" type="number" min="1" value={wardForm.totalBeds} onChange={setWF("totalBeds")} /></div>
                  <div className="form-group"><label className="form-label">Floor</label><input className="form-input" type="number" min="1" value={wardForm.floor} onChange={setWF("floor")} /></div>
                </div>
                <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Creating…" : "Create Ward"}</button>
              </form>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
          {/* Ward list */}
          <div>
            <div style={{ fontWeight: 600, fontSize: ".85rem", color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>Wards</div>
            {loading && <div className="loading-center" style={{ minHeight: 120 }}><div className="spinner" /></div>}
            {wards.map(w => (
              <div key={w._id} onClick={() => setSelectedWard(w)}
                style={{ padding: "14px 16px", borderRadius: 10, marginBottom: 8, cursor: "pointer", border: `2px solid ${selectedWard?._id === w._id ? "#0d9488" : "#e2e8f0"}`, background: selectedWard?._id === w._id ? "#f0fdfa" : "#fff" }}>
                <div style={{ fontWeight: 700, fontSize: ".9rem" }}>{w.name}</div>
                <div style={{ fontSize: ".75rem", color: "#64748b" }}>{w.type} · Floor {w.floor}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {[["available","#22c55e"], ["occupied","#ef4444"], ["cleaning","#f97316"]].map(([s, color]) => (
                    <div key={s} style={{ fontSize: ".7rem", display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                      <span style={{ color: "#64748b" }}>{w.bedStats?.[s] || 0} {s}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {wards.length === 0 && !loading && <div style={{ color: "#94a3b8", fontSize: ".85rem", textAlign: "center", padding: 20 }}>No wards. Create one above.</div>}
          </div>

          {/* Bed map */}
          <div>
            {!selectedWard ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: "#94a3b8", fontSize: ".9rem" }}>Select a ward to view beds</div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>{selectedWard.name} — Bed Map</div>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowBedForm(v => !v)}><Plus size={14} /> Add Bed</button>
                </div>

                {showBedForm && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-body">
                      <form onSubmit={createBed} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                        <div className="form-group" style={{ margin: 0, flex: 1 }}>
                          <label className="form-label">Bed Number *</label>
                          <input className="form-input" placeholder="e.g. B-101" value={bedForm.bedNumber} onChange={setBF("bedNumber")} required />
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "…" : "Add"}</button>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowBedForm(false)}>Cancel</button>
                      </form>
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
                  {Object.entries(STATUS_COLOR).map(([s, c]) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".78rem" }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
                      <span style={{ color: "#64748b", textTransform: "capitalize" }}>{s.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>

                {/* Bed grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                  {beds.map(bed => (
                    <div key={bed._id} style={{ padding: "12px 10px", borderRadius: 8, background: STATUS_BG[bed.status], border: `2px solid ${STATUS_COLOR[bed.status]}44`, textAlign: "center" }}>
                      <div style={{ fontSize: ".85rem", fontWeight: 700, color: STATUS_COLOR[bed.status] }}>🛏 {bed.bedNumber}</div>
                      <div style={{ fontSize: ".7rem", color: "#64748b", marginTop: 3, textTransform: "capitalize" }}>{bed.status.replace(/_/g, " ")}</div>
                      {VALID_TRANSITIONS[bed.status]?.length > 0 && (
                        <select onChange={e => { if (e.target.value) changeStatus(bed._id, e.target.value); e.target.value = ""; }}
                          style={{ marginTop: 8, width: "100%", fontSize: ".7rem", padding: "3px 4px", border: "1px solid #e2e8f0", borderRadius: 4, cursor: "pointer" }}>
                          <option value="">Change →</option>
                          {VALID_TRANSITIONS[bed.status].map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                  {beds.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#94a3b8", padding: 40, fontSize: ".875rem" }}>No beds in this ward. Add beds above.</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
