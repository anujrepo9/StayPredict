import { useState, useEffect } from "react";
import { BarChart2, Download } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { analyticsApi, adminApi } from "../services/api";

const WARD_COLORS = ["#0d9488","#1a2744","#f97316","#22c55e","#8b5cf6","#ec4899"];

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.overview()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const downloadCsv = () => { window.open(adminApi.downloadCsv() + `?token=${localStorage.getItem("sp_token")}`, "_blank"); };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const { monthlyTrend = [], losDistribution = [], wardOccupancy = [] } = data || {};

  return (
    <>
      <div className="page-header">
        <BarChart2 size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>Analytics</h2>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn btn-secondary btn-sm" onClick={downloadCsv}><Download size={14} /> Export CSV</button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Monthly trend */}
          <div className="card">
            <div className="card-header"><span className="card-title">Monthly Admissions (6 Months)</span></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyTrend}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="admissions" fill="#0d9488" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* LOS distribution */}
          <div className="card">
            <div className="card-header"><span className="card-title">Predicted LOS Distribution</span></div>
            <div className="card-body">
              {losDistribution.every(b => b.count === 0)
                ? <div style={{ textAlign: "center", color: "#94a3b8", paddingTop: 80, fontSize: ".85rem" }}>No predictions yet</div>
                : <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={losDistribution}>
                      <XAxis dataKey="range" tick={{ fontSize: 11 }} label={{ value: "Days", position: "insideBottom", offset: -2, fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1a2744" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
              }
            </div>
          </div>
        </div>

        {/* Ward occupancy */}
        <div className="card">
          <div className="card-header"><span className="card-title">Ward Occupancy</span></div>
          <div className="card-body">
            {wardOccupancy.length === 0
              ? <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0", fontSize: ".85rem" }}>No wards configured yet.</div>
              : <>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Ward</th><th>Type</th><th>Total</th><th>Occupied</th><th>Available</th><th>Occupancy Rate</th></tr></thead>
                      <tbody>
                        {wardOccupancy.map(w => {
                          const rate = w.total > 0 ? Math.round((w.occupied / w.total) * 100) : 0;
                          return (
                            <tr key={w.name}>
                              <td style={{ fontWeight: 600 }}>{w.name}</td>
                              <td><span className="badge badge-teal" style={{ fontSize: ".72rem" }}>{w.type}</span></td>
                              <td>{w.total}</td>
                              <td style={{ color: "#ef4444", fontWeight: 600 }}>{w.occupied}</td>
                              <td style={{ color: "#22c55e", fontWeight: 600 }}>{w.available}</td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ flex: 1, height: 8, background: "#e2e8f0", borderRadius: 4 }}>
                                    <div style={{ width: `${rate}%`, height: "100%", background: rate > 85 ? "#ef4444" : rate > 65 ? "#f97316" : "#22c55e", borderRadius: 4, transition: "width .3s" }} />
                                  </div>
                                  <span style={{ fontSize: ".8rem", fontWeight: 600, width: 36 }}>{rate}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
            }
          </div>
        </div>
      </div>
    </>
  );
}
