import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { BedDouble, Users, Clock, AlertTriangle, ShieldAlert, Activity, Plus } from "lucide-react";
import { dashboardApi } from "../services/api";

const RISK_COLORS = { "Low Risk": "#22c55e", "Standard Risk": "#f97316", "Elevated Risk": "#ef4444" };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    dashboardApi.summary()
      .then(r => setData(r.data))
      .catch(() => setError("Could not load dashboard. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (error) return <div className="page-body"><div className="alert alert-error">{error}</div></div>;

  const { summary, losBuckets, riskDistribution, admissionTrend } = data;
  const riskPie = Object.entries(riskDistribution).map(([name, value]) => ({ name, value }));

  return (
    <>
      <div className="page-header">
        <Activity size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>Dashboard</h2>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/admissions/new")}>
            <Plus size={14} /> New Admission
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Stat Cards */}
        <div className="stats-grid">
          <StatCard icon={<Users size={20} />} color="#0d9488" bgColor="#f0fdfa" value={summary.totalAdmissions} label="Total Admissions" sub={`${summary.activeAdmissions} currently active`} />
          <StatCard icon={<BedDouble size={20} />} color="#1a2744" bgColor="#eef2ff" value={summary.availableBeds} label="Available Beds" sub={`of ${summary.totalBeds} total (${summary.cleaningBeds} cleaning)`} />
          <StatCard icon={<Clock size={20} />} color="#f97316" bgColor="#fff7ed" value={summary.avgPredictedLos ? `${summary.avgPredictedLos}d` : "—"} label="Avg Predicted LOS" sub="Based on recent predictions" />
          <StatCard icon={<AlertTriangle size={20} />} color="#ef4444" bgColor="#fef2f2" value={summary.prolongedFlagCount} label="Prolonged Stay Flags" sub="Elevated risk (>65%)" />
          <StatCard icon={<ShieldAlert size={20} />} color="#eab308" bgColor="#fefce8" value={summary.openBarriers} label="Open Barriers" sub="Discharge barriers to resolve" />
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Admission Trend */}
          <div className="card">
            <div className="card-header"><span className="card-title">7-Day Admission Trend</span></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={admissionTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="admissions" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Risk Distribution Pie */}
          <div className="card">
            <div className="card-header"><span className="card-title">Risk Distribution</span></div>
            <div className="card-body">
              {riskPie.every(r => r.value === 0)
                ? <div style={{ textAlign: "center", color: "#64748b", paddingTop: 60, fontSize: ".85rem" }}>No predictions yet</div>
                : <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={riskPie} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                        {riskPie.map((entry) => <Cell key={entry.name} fill={RISK_COLORS[entry.name]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
                    {riskPie.map(r => (
                      <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".73rem" }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: RISK_COLORS[r.name] }} />
                        <span>{r.name} ({r.value})</span>
                      </div>
                    ))}
                  </div>
                </>
              }
            </div>
          </div>
        </div>

        {/* LOS Distribution */}
        <div className="card">
          <div className="card-header"><span className="card-title">Predicted LOS Distribution</span></div>
          <div className="card-body">
            {losBuckets.every(b => b.count === 0)
              ? <div style={{ textAlign: "center", color: "#64748b", padding: "40px 0", fontSize: ".85rem" }}>No predictions yet — create an admission and run a prediction to populate this chart.</div>
              : <ResponsiveContainer width="100%" height={180}>
                <BarChart data={losBuckets}>
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            }
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ icon, color, bgColor, value, label, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: bgColor, color }}>{icon}</div>
      <div className="stat-card-value">{value ?? "—"}</div>
      <div className="stat-card-label">{label}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}
