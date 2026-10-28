import { useState, useEffect } from "react";
import { BarChart2, Download, TrendingUp, Users, BedDouble, Star, FolderOpen } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { analyticsApi, adminApi } from "../services/api";
import api from "../services/api";

const SERVICE_COLORS = {
  emergency: "#ef4444", surgery: "#0d9488",
  general_medicine: "#1a2744", ICU: "#f97316",
};
const SERVICE_LABELS = {
  emergency: "Emergency", surgery: "Surgery",
  general_medicine: "General Medicine", ICU: "ICU",
};
const SERVICES = ["emergency", "surgery", "general_medicine", "ICU"];

function EmptyChart({ message, hint }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      minHeight:160, color:"#94a3b8", textAlign:"center", padding:"0 20px", gap:8 }}>
      <FolderOpen size={32} color="#cbd5e1" />
      <div style={{ fontSize:".85rem", fontWeight:600, color:"#64748b" }}>{message}</div>
      {hint && <div style={{ fontSize:".75rem", color:"#94a3b8" }}>{hint}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data,    setData]    = useState(null);
  const [weekly,  setWeekly]  = useState(null);
  const [selSvc,  setSelSvc]  = useState("emergency");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    // Fetch independently so one failure doesn't block the other
    const fetchOverview = analyticsApi.overview()
      .then(r => setData(r.data))
      .catch(err => {
        const msg = err.response?.data?.error || err.message || "Unknown error";
        setError(`Analytics overview failed: ${msg}. Is the backend running on port 5000?`);
      });

    const fetchWeekly = api.get("/analytics/weekly")
      .then(r => setWeekly(r.data))
      .catch(() => setWeekly({ available: false, data: [] })); // non-fatal

    Promise.all([fetchOverview, fetchWeekly]).finally(() => setLoading(false));
  }, []);

  const [downloading, setDownloading] = useState(false);

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const res = await api.get("/reports/admissions.csv", {
        responseType: "blob",
      });
      // Create a temporary anchor and trigger download
      const url  = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute("download", `admissions_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("CSV export failed: " + (err.response?.data?.error || err.message));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (error)   return <div className="page-body"><div className="alert alert-error">{error}</div></div>;

  const {
    monthlyTrend = [], losDistribution = [], wardOccupancy = [],
    weeklyServices = {}, totalPredictions = 0,
  } = data || {};

  const weeklyAvailable   = weeklyServices.available === true;
  const weeklyRaw         = weekly?.data || [];
  const svcWeekly         = weeklyRaw.filter(r => r.service === selSvc).sort((a,b) => a.week - b.week);
  const hasDbData         = totalPredictions > 0 || monthlyTrend.some(m => m.admissions > 0);

  const radarData = (weeklyServices.servicesSummary || []).map(s => ({
    service:       SERVICE_LABELS[s.service] || s.service,
    Satisfaction:  s.avg_satisfaction,
    "Staff Morale": s.avg_staff_morale,
  }));

  const CSV_HINT = "Place patients.csv, staff.csv, services_weekly.csv in staypredict/data/ and restart the backend.";

  return (
    <>
      <div className="page-header">
        <BarChart2 size={20} color="#0d9488" />
        <h2 style={{ fontSize:"1.1rem", fontWeight:700, color:"#1a2744" }}>Analytics</h2>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          {!weeklyAvailable && (
            <span style={{ fontSize:".75rem", color:"#f97316", background:"#fff7ed",
              padding:"4px 10px", borderRadius:20, border:"1px solid #fed7aa" }}>
              ⚠ CSV data not loaded
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={downloadCsv} disabled={downloading}>
            <Download size={14} /> {downloading ? "Downloading…" : "Export CSV"}
          </button>
        </div>
      </div>

      <div className="page-body">

        {/* Setup notice when no CSV data */}
        {!weeklyAvailable && (
          <div className="alert alert-warning" style={{ marginBottom:20 }}>
            <div>
              <strong>services_weekly.csv not found.</strong> To enable the weekly service charts, create
              a <code style={{ background:"#fff",padding:"1px 6px",borderRadius:4 }}>data/</code> folder
              in your <code style={{ background:"#fff",padding:"1px 6px",borderRadius:4 }}>staypredict/</code> root
              and place the CSV files there, then <strong>restart the backend</strong>.
              <br /><br />
              <code style={{ fontSize:".78rem", background:"#fff7ed", padding:"4px 8px", borderRadius:4, display:"block" }}>
                staypredict/data/services_weekly.csv<br />
                staypredict/data/patients.csv<br />
                staypredict/data/staff.csv
              </code>
            </div>
          </div>
        )}

        {/* ── Service summary cards ────────────────────────────────────── */}
        {weeklyAvailable && (weeklyServices.servicesSummary || []).length > 0 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
            {weeklyServices.servicesSummary.map(s => (
              <div key={s.service} className="card"
                style={{ borderTop:`3px solid ${SERVICE_COLORS[s.service]}` }}>
                <div className="card-body" style={{ padding:"14px 16px" }}>
                  <div style={{ fontSize:".72rem", fontWeight:700, color:SERVICE_COLORS[s.service],
                    textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>
                    {SERVICE_LABELS[s.service]}
                  </div>
                  {[
                    [BedDouble,  "Avg Beds",     s.avg_available_beds],
                    [Users,      "Avg Admitted", s.avg_admitted],
                    [TrendingUp, "Satisfaction", `${s.avg_satisfaction}%`],
                    [Star,       "Staff Morale", `${s.avg_staff_morale}%`],
                  ].map(([Icon, label, val]) => (
                    <div key={label} style={{ display:"flex", justifyContent:"space-between",
                      alignItems:"center", padding:"4px 0", borderBottom:"1px solid #f1f5f9", fontSize:".8rem" }}>
                      <span style={{ color:"#64748b", display:"flex", alignItems:"center", gap:5 }}>
                        <Icon size={12} />{label}
                      </span>
                      <span style={{ fontWeight:700 }}>{val}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:8, fontSize:".72rem", color:"#94a3b8" }}>
                    Annual admitted: <strong style={{ color:"#334155" }}>{s.total_admitted.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Row 1: Monthly trends ────────────────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Monthly Admissions (Database)</span></div>
            <div className="card-body">
              {!hasDbData
                ? <EmptyChart message="No admissions in database yet"
                    hint="Run the seed script: node scripts/seed_demo_data.js" />
                : <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthlyTrend}>
                      <XAxis dataKey="month" tick={{ fontSize:11 }} />
                      <YAxis tick={{ fontSize:11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="admissions" fill="#0d9488" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
              }
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Monthly Demand vs Capacity</span>
              {weeklyAvailable && <span style={{ fontSize:".72rem", color:"#64748b" }}>All services · services_weekly.csv</span>}
            </div>
            <div className="card-body">
              {!weeklyAvailable
                ? <EmptyChart message="services_weekly.csv not loaded" hint={CSV_HINT} />
                : <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={weeklyServices.monthlyAgg}>
                      <XAxis dataKey="month" tick={{ fontSize:10 }} />
                      <YAxis tick={{ fontSize:10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize:11 }} />
                      <Bar dataKey="patients_admitted" name="Admitted" fill="#0d9488" radius={[4,4,0,0]} />
                      <Bar dataKey="patients_refused"  name="Refused"  fill="#ef4444" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
              }
            </div>
          </div>
        </div>

        {/* ── Weekly drill-down (only when CSV loaded) ─────────────────── */}
        {weeklyAvailable && (
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header">
              <span className="card-title">Weekly Service Drill-down</span>
              <div style={{ display:"flex", gap:6 }}>
                {SERVICES.map(s => (
                  <button key={s} onClick={() => setSelSvc(s)}
                    className={`btn btn-sm ${selSvc === s ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize:".75rem", padding:"5px 10px",
                      ...(selSvc===s ? { background:SERVICE_COLORS[s], borderColor:SERVICE_COLORS[s] } : {}) }}>
                    {SERVICE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-body">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                <div>
                  <div style={{ fontSize:".8rem", fontWeight:600, color:"#64748b", marginBottom:8 }}>
                    Beds Available vs Admissions
                  </div>
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={svcWeekly}>
                      <XAxis dataKey="week" tick={{ fontSize:10 }} label={{ value:"Week", position:"insideBottom", offset:-2, fontSize:10 }} />
                      <YAxis tick={{ fontSize:10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize:10 }} />
                      <Line type="monotone" dataKey="available_beds"    name="Available Beds" stroke={SERVICE_COLORS[selSvc]} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="patients_admitted" name="Admitted"       stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="patients_refused"  name="Refused"        stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="4 2" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div style={{ fontSize:".8rem", fontWeight:600, color:"#64748b", marginBottom:8 }}>
                    Satisfaction &amp; Staff Morale
                  </div>
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={svcWeekly}>
                      <XAxis dataKey="week" tick={{ fontSize:10 }} label={{ value:"Week", position:"insideBottom", offset:-2, fontSize:10 }} />
                      <YAxis domain={[0,100]} tick={{ fontSize:10 }} unit="%" />
                      <Tooltip formatter={v => `${v}%`} />
                      <Legend wrapperStyle={{ fontSize:10 }} />
                      <Line type="monotone" dataKey="patient_satisfaction" name="Satisfaction" stroke="#0d9488" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="staff_morale"         name="Staff Morale" stroke="#1a2744" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Event markers */}
              {(() => {
                const evts = svcWeekly.filter(r => r.event && r.event !== "none");
                if (!evts.length) return null;
                const byEvent = {};
                evts.forEach(r => { byEvent[r.event] = byEvent[r.event] || []; byEvent[r.event].push(r.week); });
                return (
                  <div style={{ marginTop:12, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                    <span style={{ fontSize:".75rem", color:"#64748b", fontWeight:600 }}>Events:</span>
                    {Object.entries(byEvent).map(([ev, weeks]) => (
                      <span key={ev} className="badge badge-yellow" style={{ fontSize:".72rem" }}>
                        {ev} — weeks {weeks.join(", ")}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Row 2: LOS distribution + Radar ─────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Predicted LOS Distribution</span></div>
            <div className="card-body">
              {losDistribution.every(b => b.count === 0)
                ? <EmptyChart message="No predictions yet"
                    hint="Create an admission and run a prediction to populate this chart" />
                : <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={losDistribution}>
                      <XAxis dataKey="range" tick={{ fontSize:11 }} label={{ value:"Days", position:"insideBottom", offset:-2, fontSize:11 }} />
                      <YAxis tick={{ fontSize:11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1a2744" radius={[4,4,0,0]} name="Predictions" />
                    </BarChart>
                  </ResponsiveContainer>
              }
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Service Performance Radar</span></div>
            <div className="card-body">
              {!weeklyAvailable || radarData.length === 0
                ? <EmptyChart message="Needs services_weekly.csv" hint={CSV_HINT} />
                : <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="service" tick={{ fontSize:10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize:9 }} />
                      <Radar name="Satisfaction"  dataKey="Satisfaction"   stroke="#0d9488" fill="#0d9488" fillOpacity={0.35} />
                      <Radar name="Staff Morale"  dataKey="Staff Morale"   stroke="#1a2744" fill="#1a2744" fillOpacity={0.2}  />
                      <Legend wrapperStyle={{ fontSize:11 }} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
              }
            </div>
          </div>
        </div>

        {/* ── Ward occupancy ────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header"><span className="card-title">Ward Occupancy (Live)</span></div>
          <div className="card-body">
            {wardOccupancy.length === 0
              ? <EmptyChart message="No wards configured yet"
                  hint="Run the seed script or add wards via the Beds & Wards page" />
              : <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Ward</th><th>Type</th><th>Total</th><th>Occupied</th><th>Available</th><th>Cleaning</th><th>Occupancy</th></tr>
                    </thead>
                    <tbody>
                      {wardOccupancy.map(w => {
                        const rate = w.total > 0 ? Math.round((w.occupied / w.total) * 100) : 0;
                        return (
                          <tr key={w.name}>
                            <td style={{ fontWeight:600 }}>{w.name}</td>
                            <td><span className="badge badge-teal" style={{ fontSize:".72rem" }}>{w.type}</span></td>
                            <td>{w.total}</td>
                            <td style={{ color:"#ef4444", fontWeight:600 }}>{w.occupied}</td>
                            <td style={{ color:"#22c55e", fontWeight:600 }}>{w.available}</td>
                            <td style={{ color:"#f97316" }}>{w.cleaning}</td>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                <div style={{ flex:1, height:8, background:"#e2e8f0", borderRadius:4 }}>
                                  <div style={{ width:`${rate}%`, height:"100%", borderRadius:4, transition:"width .3s",
                                    background: rate>85?"#ef4444":rate>65?"#f97316":"#22c55e" }} />
                                </div>
                                <span style={{ fontSize:".8rem", fontWeight:600, width:36 }}>{rate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        </div>
      </div>
    </>
  );
}