import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppLayout from "./layouts/AppLayout";
import "./styles/global.css";

import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import NewAdmission from "./pages/NewAdmission";
import AdmissionsPage from "./pages/AdmissionsPage";
import AdmissionDetail from "./pages/AdmissionDetail";
import PredictionsPage from "./pages/PredictionsPage";
import PredictionDetail from "./pages/PredictionDetail";
import BarriersPage from "./pages/BarriersPage";
import BedsPage from "./pages/BedsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import RoiPage from "./pages/RoiPage";
import ModelInfoPage from "./pages/ModelInfoPage";
import UserManagementPage from "./pages/UserManagementPage";
import AuditLogPage from "./pages/AuditLogPage";
import PatientPortal from "./pages/PatientPortal";

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function RedirectByRole() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "patient") return <Navigate to="/patient/portal" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RedirectByRole />} />
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/dashboard" element={<RequireAuth roles={["admin","staff"]}><Dashboard /></RequireAuth>} />
            <Route path="/admissions" element={<RequireAuth roles={["admin","staff"]}><AdmissionsPage /></RequireAuth>} />
            <Route path="/admissions/new" element={<RequireAuth roles={["admin","staff"]}><NewAdmission /></RequireAuth>} />
            <Route path="/admissions/:id" element={<RequireAuth roles={["admin","staff"]}><AdmissionDetail /></RequireAuth>} />
            <Route path="/predictions" element={<RequireAuth roles={["admin","staff"]}><PredictionsPage /></RequireAuth>} />
            <Route path="/predictions/:id" element={<PredictionDetail />} />
            <Route path="/barriers" element={<RequireAuth roles={["admin","staff"]}><BarriersPage /></RequireAuth>} />
            <Route path="/beds" element={<RequireAuth roles={["admin","staff"]}><BedsPage /></RequireAuth>} />
            <Route path="/analytics" element={<RequireAuth roles={["admin","staff"]}><AnalyticsPage /></RequireAuth>} />
            <Route path="/roi" element={<RequireAuth roles={["admin","staff"]}><RoiPage /></RequireAuth>} />
            <Route path="/model-info" element={<ModelInfoPage />} />
            <Route path="/admin/users" element={<RequireAuth roles={["admin"]}><UserManagementPage /></RequireAuth>} />
            <Route path="/admin/audit" element={<RequireAuth roles={["admin"]}><AuditLogPage /></RequireAuth>} />
            <Route path="/patient/portal" element={<RequireAuth roles={["patient"]}><PatientPortal /></RequireAuth>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
