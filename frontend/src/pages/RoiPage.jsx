import { useState } from "react";
import { Calculator } from "lucide-react";

export default function RoiPage() {
  const [inputs, setInputs] = useState({ annualAdmissions: 5000, avgLos: 6.5, losReductionDays: 0.5, costPerBedDay: 1200, occupancyRate: 80 });
  const set = k => e => setInputs(i => ({ ...i, [k]: parseFloat(e.target.value) || 0 }));

  const bedDaysSaved = inputs.annualAdmissions * inputs.losReductionDays;
  const financialImpact = bedDaysSaved * inputs.costPerBedDay;
  const additionalCapacityPct = inputs.avgLos > 0 ? ((inputs.losReductionDays / inputs.avgLos) * 100).toFixed(1) : 0;
  const extraPatientsPerYear = inputs.avgLos > 0 ? Math.floor(bedDaysSaved / inputs.avgLos) : 0;

  const Field = ({ label, k, min, max, step, unit }) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input className="form-input" type="number" min={min} max={max} step={step || 1} value={inputs[k]} onChange={set(k)} style={{ flex: 1 }} />
        {unit && <span style={{ fontSize: ".82rem", color: "#64748b", whiteSpace: "nowrap" }}>{unit}</span>}
      </div>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <Calculator size={20} color="#0d9488" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a2744" }}>Capacity & ROI Calculator</h2>
      </div>
      <div className="page-body" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          ⚠️ <strong>Scenario Estimates Only.</strong> These calculations are hypothetical projections based on user-supplied assumptions and do not represent actual savings or guaranteed outcomes. Real-world results depend on clinical workflows, patient mix, and many other factors.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Inputs */}
          <div className="card">
            <div className="card-header"><span className="card-title">Assumptions</span></div>
            <div className="card-body">
              <Field label="Annual Admissions" k="annualAdmissions" min={0} />
              <Field label="Current Average LOS" k="avgLos" min={1} max={60} step={0.1} unit="days" />
              <Field label="Assumed LOS Reduction" k="losReductionDays" min={0} max={10} step={0.1} unit="days" />
              <Field label="Cost per Bed-Day" k="costPerBedDay" min={0} step={50} unit="USD" />
              <Field label="Current Occupancy Rate" k="occupancyRate" min={1} max={100} unit="%" />

              <div style={{ marginTop: 16, padding: 12, background: "#f8fafc", borderRadius: 8, fontSize: ".78rem", color: "#64748b" }}>
                <strong>Formula:</strong><br />
                Bed-days saved = Admissions × LOS Reduction<br />
                Financial Impact = Bed-days saved × Cost per Bed-day<br />
                Additional capacity = (LOS Reduction / Avg LOS) × 100%
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="card">
            <div className="card-header"><span className="card-title">Estimated Impact</span></div>
            <div className="card-body">
              {[
                ["Bed-Days Saved / Year", bedDaysSaved.toLocaleString(), "#0d9488", "days"],
                ["Estimated Financial Impact", `$${financialImpact.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, "#1a2744", "per year"],
                ["Additional Throughput Capacity", `+${additionalCapacityPct}%`, "#22c55e", "increase"],
                ["Extra Patients / Year", extraPatientsPerYear.toLocaleString(), "#f97316", "patients"],
              ].map(([label, value, color, sub]) => (
                <div key={label} style={{ padding: "16px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: ".8rem", color: "#64748b" }}>{label}</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 700, color, marginTop: 2 }}>{value}</div>
                  <div style={{ fontSize: ".75rem", color: "#94a3b8" }}>{sub}</div>
                </div>
              ))}

              <div style={{ marginTop: 20, padding: 12, background: "#f0fdfa", borderRadius: 8, fontSize: ".78rem", color: "#0d9488" }}>
                Based on {inputs.avgLos}d avg LOS with {inputs.losReductionDays}d reduction ({additionalCapacityPct}% improvement), applied to {inputs.annualAdmissions.toLocaleString()} annual admissions.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
