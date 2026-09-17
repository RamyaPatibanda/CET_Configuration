import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import FieldConfiguration from "../modules/fieldConfiguration/pages/FieldConfiguration";
import RuleConfiguration from "../modules/ruleConfiguration/pages/RuleConfiguration";

function Overview() {
  return (
    <div className="workspace-page">
      <div className="workspace-hero">
        <div>
          <div className="page-eyebrow">CET PLATFORM</div>
          <h1>Overview</h1>
          <p>Manage the configuration workspace from one place.</p>
        </div>
      </div>

      <div className="overview-grid">
        <div className="overview-card">
          <span>Field Configuration</span>
          <strong>Ready</strong>
          <p>Define reusable fields used by CET rules.</p>
        </div>

        <div className="overview-card">
          <span>Rule Configuration</span>
          <strong>Ready</strong>
          <p>Configure allocation and decision rules using the fields you define.</p>
        </div>

        <div className="overview-card">
          <span>System Status</span>
          <strong className="status-text">● Online</strong>
          <p>Configuration services are available.</p>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoutes({ authenticated }) {
  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function AppRoutes({ authenticated }) {
  return (
    <Routes>
      <Route element={<ProtectedRoutes authenticated={authenticated} />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/fields" element={<FieldConfiguration />} />
        <Route path="/rules" element={<RuleConfiguration />} />
      </Route>

      <Route
        path="*"
        element={<Navigate to={authenticated ? "/overview" : "/login"} replace />}
      />
    </Routes>
  );
}

export default AppRoutes;
