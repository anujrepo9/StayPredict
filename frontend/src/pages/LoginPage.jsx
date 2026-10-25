import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Stethoscope } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [tab, setTab] = useState("login");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const user = tab === "login"
        ? await login(form.email, form.password)
        : await register(form);
      navigate(user.role === "patient" ? "/patient/portal" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Check your credentials.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1a2744 0%, #0d9488 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,.2)", width: "100%", maxWidth: 440, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "#1a2744", padding: "32px 40px 24px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
            <Stethoscope size={28} color="#14b8a6" />
            <span style={{ color: "#fff", fontSize: "1.6rem", fontWeight: 700 }}>Stay<span style={{ color: "#14b8a6" }}>Predict</span></span>
          </div>
          <p style={{ color: "rgba(255,255,255,.5)", fontSize: ".8rem" }}>Hospital Length of Stay Prediction System</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
          {["login","register"].map((t) => (
            <button key={t} onClick={() => { setTab(t); setError(""); }}
              style={{ flex: 1, padding: "14px", border: "none", background: "none", fontSize: ".875rem", fontWeight: 600,
                color: tab === t ? "#0d9488" : "#64748b",
                borderBottom: tab === t ? "2px solid #0d9488" : "2px solid transparent",
                cursor: "pointer", textTransform: "capitalize" }}>
              {t === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "28px 40px 36px" }}>
          {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

          {tab === "register" && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={form.name} onChange={set("name")} placeholder="Dr. Jane Smith" required minLength={2} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={set("email")} placeholder="you@hospital.com" required />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: "relative" }}>
              <input className="form-input" type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} placeholder={tab === "register" ? "Min 8 chars, 1 uppercase, 1 number" : "••••••••"} required style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {tab === "register" && (
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={set("role")}>
                <option value="staff">Clinical Staff</option>
                <option value="patient">Patient</option>
              </select>
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: ".95rem", marginTop: 8 }}>
            {loading ? "Please wait…" : tab === "login" ? "Sign In" : "Create Account"}
          </button>

          {tab === "login" && (
            <div style={{ marginTop: 20, padding: 14, background: "#f0fdfa", borderRadius: 8, fontSize: ".8rem", color: "#0d9488" }}>
              <strong>Demo credentials:</strong><br />
              Admin: admin@staypredict.demo / Admin@12345<br />
              (Run seed script to create demo data)
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
