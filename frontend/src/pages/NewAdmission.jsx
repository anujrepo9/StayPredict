import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Stethoscope, Search, UserPlus, Activity, AlertCircle } from "lucide-react";
import { profileApi, admissionApi, wardApi, bedApi } from "../services/api";

const CONDITIONS = ["Diabetes","Hypertension","Heart Disease","Asthma","Cancer","Arthritis","Obesity","Pneumonia","COPD","Fracture","Other"];
const INSURANCES = ["Medicare","Medicaid","Private","Aetna","Blue Cross","Cigna","UnitedHealth","None","Other"];
const BLOOD_GROUPS = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];

export default function NewAdmission() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=patient, 2=admission, 3=result
  const [profiles, setProfiles] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [wards, setWards] = useState([]);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [savedAdmission, setSavedAdmission] = useState(null);

  const [newPatient, setNewPatient] = useState({ name: "", age: "", gender: "Male", bloodGroup: "O+", demoId: "" });
  const [admForm, setAdmForm] = useState({ admissionType: "Elective", medicalCondition: "Diabetes", insurance: "Medicare", wardId: "", bedId: "", notes: "" });

  useEffect(() => { wardApi.list().then(r => setWards(r.data.wards || [])).catch(() => {}); }, []);
  useEffect(() => {
    if (!admForm.wardId) { setBeds([]); return; }
    bedApi.list({ wardId: admForm.wardId, status: "available" }).then(r => setBeds(r.data.beds || [])).catch(() => {});
  }, [admForm.wardId]);
  useEffect(() => {
    if (!search.trim()) { setProfiles([]); return; }
    const t = setTimeout(() => profileApi.list(search).then(r => setProfiles(r.data.profiles || [])).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [search]);

  const setNP = k => e => setNewPatient(p => ({ ...p, [k]: e.target.value }));
  const setAF = k => e => setAdmForm(f => ({ ...f, [k]: e.target.value }));

  const createPatient = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const r = await profileApi.create({ ...newPatient, age: Number(newPatient.age) });
      setSelectedProfile(r.data.profile);
      setShowNewPatient(false); setStep(2);
    } catch (err) { setError(err.response?.data?.error || "Failed to create patient profile"); }
    finally { setLoading(false); }
  };

  const submitAdmission = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const payload = { patientProfileId: selectedProfile._id, ...admForm };
      if (!payload.bedId) delete payload.bedId;
      if (!payload.wardId) delete payload.wardId;
      const r = await admissionApi.create(payload);
      setSavedAdmission(r.data.admission);
      setStep(3);
    } catch (err) { setError(err.response?.data?.error || "Failed to create admission"); }
    finally { setLoading(false); }
  };

  const runPrediction = async () => {
    setPredicting(true); setError("");
    try {
      const r = await admissionApi.predict(savedAdmission._id);
      setPrediction(r.data.prediction);
    } catch (err) { setError(err.response?.data?.error || "Prediction failed. Is the ML service running?"); }
    finally { setPredicting(false); }
  };

  const riskColor = { "Low Risk": "#22c55e", "Standard Risk": "#f97316", "Elevated Risk": "#ef4444" };
  const riskBadge = { "Low Risk": "badge-green", "Standard Risk": "badge-orange", "Elevated Risk": "badge-red" };

  return (
    <>
      <div className="page-header">
        <Stethoscope size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>New Admission</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".8rem", color: step >= s ? "#0d9488" : "#cbd5e1", fontWeight: step === s ? 700 : 400 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: step >= s ? "#0d9488" : "#e2e8f0", color: step >= s ? "#fff" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".75rem", fontWeight: 700 }}>{s}</div>
              {s < 3 && <div style={{ width: 30, height: 1, background: step > s ? "#0d9488" : "#e2e8f0" }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 680, margin: "0 auto" }}>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><AlertCircle size={16} />{error}</div>}

        {/* STEP 1: Select or create patient */}
        {step === 1 && (
          <div className="card">
            <div className="card-header"><span className="card-title">Step 1 — Select Patient</span></div>
            <div className="card-body">
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Search by name or demo ID…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => setShowNewPatient(v => !v)}>
                  <UserPlus size={14} /> New Patient
                </button>
              </div>

              {profiles.length > 0 && (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
                  {profiles.map(p => (
                    <div key={p._id} onClick={() => { setSelectedProfile(p); setStep(2); }}
                      style={{ padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f0fdfa"}
                      onMouseLeave={e => e.currentTarget.style.background = ""}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: ".875rem" }}>{p.name}</div>
                        <div style={{ fontSize: ".78rem", color: "#64748b" }}>ID: {p.demoId} · Age {p.age} · {p.gender} · {p.bloodGroup}</div>
                      </div>
                      <span className="badge badge-teal">Select →</span>
                    </div>
                  ))}
                </div>
              )}
              {search && profiles.length === 0 && <div style={{ color: "#64748b", fontSize: ".85rem", textAlign: "center", padding: 20 }}>No patients found — try creating a new profile.</div>}

              {showNewPatient && (
                <form onSubmit={createPatient} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 20, marginTop: 8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 16, fontSize: ".9rem" }}>Create New Patient Profile</div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Demo ID *</label>
                      <input className="form-input" placeholder="e.g. PT-2024-001" value={newPatient.demoId} onChange={setNP("demoId")} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Full Name *</label>
                      <input className="form-input" placeholder="Demo Patient Name" value={newPatient.name} onChange={setNP("name")} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Age *</label>
                      <input className="form-input" type="number" min="0" max="120" value={newPatient.age} onChange={setNP("age")} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Gender *</label>
                      <select className="form-select" value={newPatient.gender} onChange={setNP("gender")}>
                        <option>Male</option><option>Female</option><option>Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Blood Group *</label>
                      <select className="form-select" value={newPatient.bloodGroup} onChange={setNP("bloodGroup")}>
                        {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Saving…" : "Create & Continue"}</button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Admission details */}
        {step === 2 && selectedProfile && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Step 2 — Admission Details</span>
              <div style={{ fontSize: ".8rem", color: "#64748b" }}>
                Patient: <strong>{selectedProfile.name}</strong> · Age {selectedProfile.age} · {selectedProfile.gender}
              </div>
            </div>
            <div className="card-body">
              <form onSubmit={submitAdmission}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Admission Type *</label>
                    <select className="form-select" value={admForm.admissionType} onChange={setAF("admissionType")}>
                      <option>Elective</option><option>Emergency</option><option>Urgent</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Primary Diagnosis *</label>
                    <select className="form-select" value={admForm.medicalCondition} onChange={setAF("medicalCondition")}>
                      {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Insurance / Payer *</label>
                    <select className="form-select" value={admForm.insurance} onChange={setAF("insurance")}>
                      {INSURANCES.map(i => <option key={i}>{i}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ward (optional)</label>
                    <select className="form-select" value={admForm.wardId} onChange={setAF("wardId")}>
                      <option value="">— Select ward —</option>
                      {wards.map(w => <option key={w._id} value={w._id}>{w.name} ({w.type})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bed (optional)</label>
                    <select className="form-select" value={admForm.bedId} onChange={setAF("bedId")} disabled={!admForm.wardId}>
                      <option value="">— Select available bed —</option>
                      {beds.map(b => <option key={b._id} value={b._id}>{b.bedNumber}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows={3} value={admForm.notes} onChange={setAF("notes")} placeholder="Additional clinical notes…" />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : "Create Admission & Predict LOS"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* STEP 3: Prediction results */}
        {step === 3 && savedAdmission && (
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><span className="card-title">✓ Admission Created</span></div>
              <div className="card-body">
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  {[["Patient", selectedProfile?.name], ["Condition", savedAdmission.medicalCondition], ["Type", savedAdmission.admissionType], ["Insurance", savedAdmission.insurance]].map(([k, v]) => (
                    <div key={k}><div style={{ fontSize: ".75rem", color: "#64748b", marginBottom: 2 }}>{k}</div><div style={{ fontWeight: 600, fontSize: ".875rem" }}>{v}</div></div>
                  ))}
                </div>
              </div>
            </div>

            {!prediction && (
              <div className="card">
                <div className="card-body" style={{ textAlign: "center", padding: "32px" }}>
                  <Activity size={32} color="#0d9488" style={{ marginBottom: 12 }} />
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Ready to Predict Length of Stay</div>
                  <div style={{ color: "#64748b", fontSize: ".85rem", marginBottom: 20 }}>
                    The AI model will analyse admission features to estimate the expected stay duration.
                  </div>
                  <button className="btn btn-primary" onClick={runPrediction} disabled={predicting}>
                    {predicting ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Predicting…</> : "🔮 Run LOS Prediction"}
                  </button>
                </div>
              </div>
            )}

            {prediction && (
              <div className="card">
                <div className="card-header"><span className="card-title">AI Prediction Results</span></div>
                <div className="card-body">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
                    <div style={{ textAlign: "center", padding: "20px", background: "#f0fdfa", borderRadius: 10 }}>
                      <div style={{ fontSize: "2.4rem", fontWeight: 700, color: "#0d9488" }}>{prediction.predictedLosDays}d</div>
                      <div style={{ fontSize: ".8rem", color: "#64748b" }}>Predicted LOS</div>
                      <div style={{ fontSize: ".73rem", color: "#94a3b8", marginTop: 4 }}>80% interval: {prediction.intervalLower}–{prediction.intervalHigh} days</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "20px", background: "#f8fafc", borderRadius: 10 }}>
                      <div style={{ fontSize: "2.4rem", fontWeight: 700, color: "#1a2744" }}>{Math.round(prediction.prolongedStayProbability * 100)}%</div>
                      <div style={{ fontSize: ".8rem", color: "#64748b" }}>Prolonged Stay Score</div>
                      <div style={{ fontSize: ".73rem", color: "#94a3b8", marginTop: 4 }}>Experimental — not calibrated</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "20px", background: "#f8fafc", borderRadius: 10 }}>
                      <span className={`badge ${riskBadge[prediction.riskCategory]}`} style={{ fontSize: ".9rem", padding: "8px 16px" }}>{prediction.riskCategory}</span>
                      <div style={{ fontSize: ".8rem", color: "#64748b", marginTop: 8 }}>Risk Category</div>
                    </div>
                  </div>
                  <div className="disclaimer">
                    ⚠️ {prediction.disclaimer}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                    <button className="btn btn-secondary" onClick={() => navigate("/admissions")}>View All Admissions</button>
                    <button className="btn btn-outline" onClick={() => navigate(`/predictions/${prediction._id}`)}>Full Prediction Details</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

const riskBadge = { "Low Risk": "badge-green", "Standard Risk": "badge-orange", "Elevated Risk": "badge-red" };
