import { useState, useEffect } from "react";
import { UserCircle, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { profileApi } from "../services/api";
import { useAuth } from "../context/AuthContext";

const PHASES = [
  {
    num: 1, title: "Admission & Assessment",
    color: "#0d9488", bgColor: "#f0fdfa",
    items: ["Medical history review", "Initial clinical assessment", "Diagnostic tests ordered", "Care plan discussion with clinical team", "Ward and bed assignment"],
  },
  {
    num: 2, title: "Treatment & Monitoring",
    color: "#1a2744", bgColor: "#eef2ff",
    items: ["Active treatment as prescribed by clinical team", "Regular vital sign monitoring", "Medication administration", "Clinical team rounds and assessment", "Response to treatment evaluation"],
  },
  {
    num: 3, title: "Recovery & Discharge Prep",
    color: "#f97316", bgColor: "#fff7ed",
    items: ["Progress assessment by clinical team", "Patient and family education", "Discharge planning discussion", "Post-discharge care coordination", "Barrier identification and resolution"],
  },
  {
    num: 4, title: "Discharge Coordination",
    color: "#22c55e", bgColor: "#f0fdf4",
    items: ["Discharge readiness confirmed by clinician", "Discharge documentation prepared", "Follow-up appointments arranged", "Home care or post-acute placement arranged", "Prescription and instructions provided"],
  },
];

const RISK_BADGE = { "Low Risk": "badge-green", "Standard Risk": "badge-orange", "Elevated Risk": "badge-red" };

export default function PatientPortal() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([profileApi.myProfile(), profileApi.myAdmissions()])
      .then(([pr, ar]) => { setProfile(pr.data.profile); setAdmissions(ar.data.admissions || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const activeAdm = admissions.find(a => a.status !== "discharged") || admissions[0];
  const pred = activeAdm?.latestPredictionId;

  return (
    <>
      <div className="page-header">
        <UserCircle size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>My Patient Portal</h2>
      </div>
      <div className="page-body" style={{ maxWidth: 780, margin: "0 auto" }}>
        {/* Welcome */}
        <div style={{ background: "linear-gradient(135deg, #1a2744, #0d9488)", borderRadius: 14, padding: "28px 32px", marginBottom: 24, color: "#fff" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 4 }}>Welcome, {user?.name || profile?.name}</div>
          <div style={{ opacity: .7, fontSize: ".875rem" }}>Patient ID: {profile?.demoId || "Not set"} · {profile?.age} years · {profile?.gender}</div>
        </div>

        {/* Current admission */}
        {!activeAdm ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
            <UserCircle size={48} color="#cbd5e1" style={{ marginBottom: 12 }} />
            <div>No active admissions on record. Contact your care team if you believe this is an error.</div>
          </div>
        ) : (
          <>
            {/* Admission summary */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><span className="card-title">Current Admission</span></div>
              <div className="card-body">
                <div className="form-grid">
                  {[
                    ["Admitted", new Date(activeAdm.admissionDate).toLocaleDateString()],
                    ["Condition", activeAdm.medicalCondition],
                    ["Admission Type", activeAdm.admissionType],
                    ["Ward", activeAdm.wardId?.name || "—"],
                    ["Bed", activeAdm.bedId?.bedNumber || "—"],
                    ["Status", activeAdm.status?.replace(/_/g, " ")],
                  ].map(([k, v]) => (
                    <div key={k}><div style={{ fontSize: ".75rem", color: "#64748b" }}>{k}</div><div style={{ fontWeight: 600, textTransform: "capitalize" }}>{v}</div></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Prediction summary */}
            {pred && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header"><span className="card-title">Stay Estimate</span></div>
                <div className="card-body">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div style={{ textAlign: "center", padding: 20, background: "#f0fdfa", borderRadius: 10 }}>
                      <div style={{ fontSize: "2.4rem", fontWeight: 700, color: "#0d9488" }}>{pred.predictedLosDays}d</div>
                      <div style={{ fontSize: ".82rem", color: "#64748b" }}>Estimated Stay Length</div>
                      <div style={{ fontSize: ".73rem", color: "#94a3b8", marginTop: 4 }}>Range: {pred.intervalLower}–{pred.intervalHigh} days</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, background: "#f8fafc", borderRadius: 10, gap: 8 }}>
                      <span className={`badge ${RISK_BADGE[pred.riskCategory]}`} style={{ fontSize: ".9rem", padding: "8px 16px" }}>{pred.riskCategory}</span>
                      <div style={{ fontSize: ".82rem", color: "#64748b" }}>Stay Risk Category</div>
                    </div>
                  </div>
                  <div className="disclaimer">
                    <AlertTriangle size={14} style={{ display: "inline", marginRight: 6 }} />
                    This is an AI-generated estimate for planning purposes only. Your actual length of stay is determined entirely by your clinical team based on your health and recovery progress.
                  </div>
                </div>
              </div>
            )}

            {/* Recovery Roadmap */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><span className="card-title">General Recovery Roadmap</span></div>
              <div className="card-body">
                <div className="alert alert-info" style={{ marginBottom: 20, fontSize: ".82rem" }}>
                  This is a general educational roadmap. Your actual care plan, timeline, and discharge date are determined solely by your clinical team based on your individual condition and recovery progress.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {PHASES.map((phase, i) => {
                    const statusIdx = activeAdm.status === "discharged" ? 4 : activeAdm.status === "pending_discharge" ? 3 : activeAdm.status === "under_treatment" ? 2 : 1;
                    const done = i + 1 < statusIdx;
                    const current = i + 1 === statusIdx;
                    return (
                      <div key={phase.num} style={{ display: "flex", gap: 14, opacity: done || current ? 1 : .6 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: done ? "#22c55e" : current ? phase.color : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {done ? <CheckCircle size={18} color="#fff" /> : current ? <Clock size={18} color="#fff" /> : <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: ".85rem" }}>{phase.num}</span>}
                          </div>
                          {i < PHASES.length - 1 && <div style={{ width: 2, flex: 1, marginTop: 6, background: done ? "#22c55e" : "#e2e8f0", minHeight: 20 }} />}
                        </div>
                        <div style={{ padding: "4px 0 14px" }}>
                          <div style={{ fontWeight: 700, fontSize: ".9rem", color: current ? phase.color : "#334155" }}>{current && "→ "}{phase.title}</div>
                          <ul style={{ marginTop: 6, paddingLeft: 18, fontSize: ".82rem", color: "#64748b", lineHeight: 1.8 }}>
                            {phase.items.map(item => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Discharge prep checklist */}
            {["pending_discharge","under_treatment"].includes(activeAdm.status) && (
              <div className="card">
                <div className="card-header"><span className="card-title">Discharge Preparation</span></div>
                <div className="card-body">
                  <div style={{ fontSize: ".82rem", color: "#64748b", marginBottom: 14 }}>General items to be aware of as you prepare for discharge (discuss all details with your care team):</div>
                  {["Understand your discharge instructions","Know your follow-up appointment schedule","Ensure transport home is arranged","Collect any prescribed medications","Have someone available to assist at home if needed","Know who to call if symptoms change after discharge"].map(item => (
                    <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: ".875rem" }}>
                      <CheckCircle size={15} color="#0d9488" style={{ flexShrink: 0, marginTop: 2 }} />{item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
