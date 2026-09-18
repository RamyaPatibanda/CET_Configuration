import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { FiClock, FiEdit2, FiEye, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runError, setRunError] = useState("");

  const deleteRun = async (runId, runName) => {
    if (!window.confirm(`Delete allocation "${runName}"? This will remove its saved history and decisions.`)) return;
    try {
      setRunError("");
      await allocationService.delete(runId);
      await loadRuns();
    } catch (error) {
      setRunError(error.message || "Unable to delete allocation run.");
    }
  };

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

  const parseGroups = (run) => {
    try {
      return JSON.parse(run.ruleGroupsJson || "[]");
    } catch {
      return [];
    }
  };

  const ruleSummary = (run) => {
    const groups = parseGroups(run);
    const rules = groups.flatMap((group) => group.rules || []);
    return rules.length
      ? rules.map((rule) => rule.ruleName).filter(Boolean).join(", ")
      : "No rules";
  };

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
            <p>Review saved runs and continue editing drafts before validation.</p>
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
          <div className="overview-table-wrapper">
            <table className="overview-table">
              <thead>
                <tr>
                  <th>Run Name</th>
                  <th>Allocation Step</th>
                  <th>CAP Round</th>
                  <th>Status</th>
                  <th>Rules</th>
                  <th>Candidates</th>
                  <th>Decisions</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const status = String(run.status || "Draft");
                  const normalizedStatus = status.toLowerCase();
                  const canEdit = ["draft", "ready", "failed", "cancelled"].includes(normalizedStatus);
                  return (
                    <tr key={run.allocationRunId}>
                      <td>
                        <strong className="overview-table-run-name">{run.allocationRunName}</strong>
                        <span className="overview-table-id">{run.allocationRunId}</span>
                      </td>
                      <td>{stepLabels[run.allocationStep] || run.allocationStep}</td>
                      <td>{run.capRound}</td>
                      <td>
                        <span className={"overview-run-status " + status.toLowerCase()}>{status}</span>
                      </td>
                      <td>
                        <span className="overview-table-rules" title={ruleSummary(run)}>
                          {ruleSummary(run)}
                        </span>
                      </td>
                      <td>{run.candidateCount ?? 0}</td>
                      <td>{run.decisionCount ?? 0}</td>
                      <td>{formatDate(run.createdAtUtc || run.startedAtUtc)}</td>
                      <td>
                        <div className="overview-action-icons">
                          <button
                            type="button"
                            className="overview-icon-button"
                            onClick={() => navigate("/allocation?runId=" + encodeURIComponent(run.allocationRunId))}
                            title={canEdit ? "Edit allocation" : "View allocation"}
                            aria-label={canEdit ? "Edit allocation" : "View allocation"}
                          >
                            {canEdit ? <FiEdit2 size={15} /> : <FiEye size={15} />}
                          </button>
                          <button
                            type="button"
                            className="overview-icon-button danger"
                            onClick={() => deleteRun(run.allocationRunId, run.allocationRunName)}
                            title="Delete allocation"
                            aria-label="Delete allocation"
                            disabled={normalizedStatus === "running"}
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
