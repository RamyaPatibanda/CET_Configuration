import { useEffect, useMemo, useState } from "react";
import { FiPlay, FiRefreshCw } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import allocationService from "../services/allocationService";
import "../allocation.css";

const SAMPLE_DATA = {
  candidates: [
    {
      candidateId: 1001,
      categoryId: 2,
      previousCategoryId: -1,
      gender: "F",
      isOms: "N",
      isNri: "N",
      isPh: "Y",
      isExServicemen: "N",
      isOrphan: "N",
      isEligibleForOpen: "Y",
      meritNo: 1,
      exServicemenMeritNo: 0,
      preferences: [
        { preferenceNo: 1, collegeId: 101, choiceCode: 101 },
        { preferenceNo: 2, collegeId: 102, choiceCode: 102 },
      ],
    },
    {
      candidateId: 1002,
      categoryId: 1,
      previousCategoryId: -1,
      gender: "M",
      isOms: "N",
      isNri: "N",
      isPh: "N",
      isExServicemen: "N",
      isOrphan: "N",
      isEligibleForOpen: "Y",
      meritNo: 2,
      exServicemenMeritNo: 0,
      preferences: [
        { preferenceNo: 1, collegeId: 101, choiceCode: 101 },
        { preferenceNo: 2, collegeId: 102, choiceCode: 102 },
      ],
    },
  ],
  seats: [
    { collegeId: 101, categoryId: 1, quotaId: 1, general: 1, female: 0, ph: 1, defence: 0, orphan: 0 },
    { collegeId: 102, categoryId: 1, quotaId: 1, general: 2, female: 1, ph: 0, defence: 0, orphan: 0 },
  ],
};

function getItems(response) {
  return Array.isArray(response) ? response : response?.data || [];
}

function Allocation() {
  const [stages, setStages] = useState([]);
  const [capRound, setCapRound] = useState(1);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const loadStages = async () => {
    try {
      const response = await allocationService.getStages();
      setStages(getItems(response));
    } catch (loadError) {
      setError(loadError.message || "Unable to load allocation stages.");
    }
  };

  useEffect(() => {
    loadStages();
  }, []);

  const runSimulation = async () => {
    try {
      setRunning(true);
      setError("");
      const response = await allocationService.simulate({
        capRound: Number(capRound),
        ruleSetVersionId: "draft-runtime",
        ...SAMPLE_DATA,
      });
      setResult(response?.data || response);
    } catch (runError) {
      setError(runError.message || "Unable to run allocation simulation.");
    } finally {
      setRunning(false);
    }
  };

  const decisions = useMemo(() => result?.decisions || [], [result]);

  return (
    <div className="allocation-page">
      <div className="allocation-hero">
        <div>
          <span className="page-eyebrow">Allocation engine</span>
          <h1>Allocation Run</h1>
          <p>Execute the allocation pipeline independently from the rule administration screens.</p>
        </div>
        <div className="allocation-run-controls">
          <label htmlFor="cap-round">CAP Round</label>
          <input id="cap-round" type="number" min="1" value={capRound} onChange={(event) => setCapRound(event.target.value)} />
          <Button onClick={runSimulation} disabled={running}>
            {running ? <FiRefreshCw className="allocation-spin" size={16} /> : <FiPlay size={16} />}
            {running ? "Running..." : "Run Simulation"}
          </Button>
        </div>
      </div>

      <div className="allocation-notice">
        <strong>Simulation mode</strong>
        <span>The current endpoint runs the engine against a controlled sample input. Database-backed candidate/seat loading and transactional persistence are intentionally kept separate from this first engine slice.</span>
      </div>

      {error && <div className="allocation-error">{error}</div>}

      <section className="allocation-section">
        <div className="allocation-section-heading">
          <div>
            <span>Pipeline</span>
            <h2>Allocation stages</h2>
          </div>
          <span className="allocation-count">{stages.filter((stage) => stage.enabled).length} active</span>
        </div>

        <div className="allocation-stage-grid">
          {stages.map((stage) => (
            <div className={`allocation-stage-card ${stage.enabled ? "enabled" : "disabled"}`} key={stage.stageCode}>
              <div className="stage-sequence">{stage.sequence}</div>
              <div>
                <strong>{stage.stageCode.replaceAll("_", " ")}</strong>
                <span>{stage.enabled ? "Enabled" : "Planned"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {result && (
        <section className="allocation-section allocation-result-section">
          <div className="allocation-section-heading">
            <div>
              <span>Run result</span>
              <h2>Allocation decisions</h2>
            </div>
            <span className="allocation-status">{result.run?.status}</span>
          </div>

          <div className="allocation-summary-grid">
            <div><span>Run ID</span><strong>{result.run?.allocationRunId}</strong></div>
            <div><span>CAP Round</span><strong>{result.run?.capRound}</strong></div>
            <div><span>Decisions</span><strong>{decisions.length}</strong></div>
          </div>

          <div className="allocation-stage-results">
            {(result.stages || []).map((stage) => (
              <div className="allocation-stage-result" key={stage.stageCode}>
                <div><strong>{stage.stageCode.replaceAll("_", " ")}</strong><span>{stage.status}</span></div>
                <strong>{stage.decisionsCreated} decisions</strong>
              </div>
            ))}
          </div>

          {decisions.length > 0 ? (
            <div className="allocation-table-wrapper">
              <table className="allocation-table">
                <thead><tr><th>Candidate</th><th>College</th><th>Preference</th><th>Category</th><th>Seat</th><th>Step</th></tr></thead>
                <tbody>
                  {decisions.map((decision) => (
                    <tr key={decision.decisionId}>
                      <td>{decision.candidateId}</td>
                      <td>{decision.collegeId}</td>
                      <td>{decision.preferenceNo}</td>
                      <td>{decision.categoryId}</td>
                      <td>{decision.originalAllocatedType}</td>
                      <td>{decision.stepId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="allocation-empty">No allocation was produced for this run.</div>}
        </section>
      )}
    </div>
  );
}

export default Allocation;
