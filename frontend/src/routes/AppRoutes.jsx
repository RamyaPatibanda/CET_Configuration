import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import FieldConfiguration from "../modules/fieldConfiguration/pages/FieldConfiguration";

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
        <div className="overview-card"><span>Field Configuration</span><strong>Ready</strong><p>Define reusable fields used by CET rules.</p></div>
        <div className="overview-card"><span>Rule Configuration</span><strong>Coming next</strong><p>Configure allocation and decision rules using the fields you define.</p></div>
        <div className="overview-card"><span>System Status</span><strong className="status-text">● Online</strong><p>Configuration services are available.</p></div>
      </div>
    </div>
  );
}

function RuleConfiguration() {
  return (
    <div className="workspace-page">
      <div className="workspace-hero">
        <div>
          <div className="page-eyebrow">WORKSPACE</div>
          <h1>Rule Configuration</h1>
          <p>Configure CET rules using the fields created in Field Configuration.</p>
        </div>
      </div>
      <div className="rule-empty-state">
        <div className="rule-icon">R</div>
        <h2>Rule configuration workspace</h2>
        <p>The rule builder is the next module in the workspace. Its UI will consume the fields already defined in Field Configuration.</p>
        <div className="rule-flow"><span>1. Create fields</span><span>→</span><span>2. Build rules</span><span>→</span><span>3. Configure allocation</span></div>
      </div>
    </div>
  );
}

function ProtectedRoutes({ authenticated }) {
  if (!authenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function AppRoutes({ authenticated }) {
  return (
    <Routes>
      <Route path="/login" element={authenticated ? <Navigate to="/overview" replace /> : <Outlet />} />
      <Route element={<ProtectedRoutes authenticated={authenticated} />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/fields" element={<FieldConfiguration />} />
        <Route path="/rules" element={<RuleConfiguration />} />
      </Route>
      <Route path="*" element={<Navigate to={authenticated ? "/overview" : "/login"} replace />} />
    </Routes>
  );
}

export default AppRoutes;
