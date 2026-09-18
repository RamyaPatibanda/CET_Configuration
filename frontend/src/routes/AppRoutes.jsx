import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { FiClock, FiRefreshCw } from "react-icons/fi";
import FieldConfiguration from "../modules/fieldConfiguration/pages/FieldConfiguration";
import RuleConfiguration from "../modules/ruleConfiguration/pages/RuleConfiguration";
import Allocation from "../modules/allocation/pages/Allocation";
import allocationService from "../modules/allocation/services/allocationService";

const stepLabels = {
  STEP_0: "Step 0 — Special Reservation",
  STEP_1: "Step 1 — Main Allocation",
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString();
};

function Overview() {
  const [runs, setRuns] = useState([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runError, setRunError] = useState("");

  const loadRuns = async () => {
    try {
      setLoadingRuns(true);
      setRunError("");
      const response = await allocationService.getHistory();
      setRuns(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      setRunError(error.message || "Unable to load allocation run history.");
    } finally {
      setLoadingRuns(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  return (
    <div className="workspace-page">
      <div className="workspace-hero">
        <div>
          <div className="page-eyebrow">CET PLATFORM</div>
          <h1>Overview</h1>
          <p>Manage configuration and execute the allocation pipeline from one workspace.</p>
        </div>
      </div>


      <section className="overview-runs">
        <div className="overview-runs-heading">
          <div>
            <span>Allocation history</span>
            <h2>Previous Allocation Runs</h2>
            <p>Review what was selected for each run and its latest execution status.</p>
          </div>
          <button type="button" className="overview-refresh" onClick={loadRuns} disabled={loadingRuns} title="Refresh allocation history">
            <FiRefreshCw size={15} className={loadingRuns ? "overview-spin" : ""} />
            Refresh
          </button>
        </div>

        {runError && <div className="overview-run-error">{runError}</div>}

        {loadingRuns ? (
          <div className="overview-runs-empty"><FiClock size={20} /><span>Loading allocation history…</span></div>
        ) : runs.length === 0 ? (
          <div className="overview-runs-empty"><FiClock size={20} /><span>No allocation runs have been saved yet.</span></div>
        ) : (
          <div className="overview-run-list">
            {runs.map((run) => {
              let groups = [];
              try { groups = JSON.parse(run.ruleGroupsJson || "[]"); } catch { groups = []; }

              return (
                <article className="overview-run" key={run.allocationRunId}>
                  <div className="overview-run-main">
                    <div className="overview-run-title">
                      <div>
                        <h3>{run.allocationRunName}</h3>
                        <span>{formatDate(run.createdAtUtc || run.startedAtUtc)}</span>
                      </div>
                      <span className={"overview-run-status " + (run.status || "").toLowerCase()}>{run.status}</span>
                    </div>

                    <div className="overview-run-meta">
                      <div><span>Allocation Step</span><strong>{stepLabels[run.allocationStep] || run.allocationStep}</strong></div>
                      <div><span>CAP Round</span><strong>{run.capRound}</strong></div>
                      <div><span>Candidates</span><strong>{run.candidateCount}</strong></div>
                      <div><span>Decisions</span><strong>{run.decisionCount}</strong></div>
                    </div>

                    <div className="overview-run-rules">
                      <span className="overview-run-rules-label">Selected decision areas & rules</span>
                      <div className="overview-run-rule-list">
                        {groups.length ? groups.map((group) => (
                          <div className="overview-run-rule-group" key={group.type}>
                            <strong>{String(group.type).replaceAll("_", " ")}</strong>
                            <span>{(group.rules || []).map((rule) => rule.ruleName).join(", ") || "No rules"}</span>
                          </div>
                        )) : <span>No rule selection details recorded.</span>}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
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
