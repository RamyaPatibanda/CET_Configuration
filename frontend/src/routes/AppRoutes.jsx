import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import FieldConfiguration from "../modules/fieldConfiguration/pages/FieldConfiguration";
import RuleConfiguration from "../modules/ruleConfiguration/pages/RuleConfiguration";
import Allocation from "../modules/allocation/pages/Allocation";

function Overview() {
  return (
    <div className="workspace-page">
      <div className="workspace-hero"><div><div className="page-eyebrow">CET PLATFORM</div><h1>Overview</h1><p>Manage configuration and execute the allocation pipeline from one workspace.</p></div></div>
      <div className="overview-grid">
        <div className="overview-card"><span>Field Configuration</span><strong>Ready</strong><p>Define reusable fields used by CET rules.</p></div>
        <div className="overview-card"><span>Rule Configuration</span><strong>Ready</strong><p>Configure allocation and decision rules using the fields you define.</p></div>
        <div className="overview-card"><span>Allocation Engine</span><strong>Pipeline Ready</strong><p>Run the current qualification, special reservation and merit allocation stages.</p></div>
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
      <Route element={<ProtectedRoutes authenticated={authenticated} />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/fields" element={<FieldConfiguration />} />
        <Route path="/rules" element={<RuleConfiguration />} />
        <Route path="/allocation" element={<Allocation />} />
      </Route>
      <Route path="*" element={<Navigate to={authenticated ? "/overview" : "/login"} replace />} />
    </Routes>
  );
}

export default AppRoutes;
