import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, BedDouble, ShieldAlert, BarChart2,
  ClipboardList, Calculator, Info, LogOut, Stethoscope, UserCircle, FileText
} from "lucide-react";

const navConfig = {
  admin: [
    { section: "Overview", items: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/analytics", icon: BarChart2, label: "Analytics" },
    ]},
    { section: "Patients", items: [
      { to: "/admissions", icon: ClipboardList, label: "Admissions" },
      { to: "/predictions", icon: Stethoscope, label: "Predictions" },
      { to: "/barriers", icon: ShieldAlert, label: "Discharge Barriers" },
    ]},
    { section: "Hospital", items: [
      { to: "/beds", icon: BedDouble, label: "Beds & Wards" },
      { to: "/roi", icon: Calculator, label: "ROI Calculator" },
    ]},
    { section: "System", items: [
      { to: "/model-info", icon: Info, label: "Model Info" },
      { to: "/admin/users", icon: Users, label: "User Management" },
      { to: "/admin/audit", icon: FileText, label: "Audit Log" },
    ]},
  ],
  staff: [
    { section: "Overview", items: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    ]},
    { section: "Patients", items: [
      { to: "/admissions/new", icon: ClipboardList, label: "New Admission" },
      { to: "/admissions", icon: ClipboardList, label: "Admissions" },
      { to: "/predictions", icon: Stethoscope, label: "Predictions" },
      { to: "/barriers", icon: ShieldAlert, label: "Discharge Barriers" },
    ]},
    { section: "Hospital", items: [
      { to: "/beds", icon: BedDouble, label: "Beds & Wards" },
      { to: "/analytics", icon: BarChart2, label: "Analytics" },
    ]},
    { section: "Info", items: [
      { to: "/model-info", icon: Info, label: "Model Info" },
    ]},
  ],
  patient: [
    { section: "My Care", items: [
      { to: "/patient/portal", icon: UserCircle, label: "My Portal" },
    ]},
  ],
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const sections = navConfig[user?.role] || navConfig.patient;

  const handleLogout = () => { logout(); navigate("/login"); };
  const initials = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <h1>Stay<span>Predict</span></h1>
          <div className="sidebar-subtitle">Hospital LOS Prediction</div>
        </div>
        <div className="sidebar-nav">
          {sections.map((sec) => (
            <div key={sec.section}>
              <div className="nav-section">{sec.section}</div>
              {sec.items.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
                  <Icon size={16} />{label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-chip-avatar">{initials}</div>
            <div>
              <div className="user-chip-name">{user?.name}</div>
              <div className="user-chip-role">{user?.role}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
