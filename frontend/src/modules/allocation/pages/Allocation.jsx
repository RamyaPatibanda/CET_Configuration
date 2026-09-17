import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiPlay, FiRefreshCw } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import allocationService from "../services/allocationService";
import "../allocation.css";

const SAMPLE_DATA = {
  candidates: [
    { candidateId: 1001, categoryId: 2, previousCategoryId: -1, gender: "F", isOms: "N", isNri: "N", isPh: "Y", isExServicemen: "N", isOrphan: "N", isEligibleForOpen: "Y", meritNo: 1, exServicemenMeritNo: 0, preferences: [{ preferenceNo: 1, collegeId: 101, choiceCode: 101 }, { preferenceNo: 2, collegeId: 102, choiceCode: 102 }] },
    { candidateId: 1002, categoryId: 1, previousCategoryId: -1, gender: "M", isOms: "N", isNri: "N", isPh: "N", isExServicemen: "N", isOrphan: "N", isEligibleForOpen: "Y", meritNo: 2, exServicemenMeritNo: 0, preferences: [{ preferenceNo: 1, collegeId: 101, choiceCode: 101 }, { preferenceNo: 2, collegeId: 102, choiceCode: 102 }] },
  ],
  seats: [
    { collegeId: 101, categoryId: 1, quotaId: 1, general: 1, female: 0, ph: 1, defence: 0, orphan: 0 },
    { collegeId: 102, categoryId: 1, quotaId: 1, general: 2, female: 1, ph: 0, defence: 0, orphan: 0 },
  ],
};

const getItems = (response) => (Array.isArray(response) ? response : response?.data || []);

function Allocation() {
  const [stages, setStages] = useState([]);
  const [capRound, setCapRound] = useState(1);
  const [ruleSet, setRuleSet] = useState("CET 2026 - Round 1");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    allocationService.getStages().then((response) => setStages(getItems(response))).catch((e) => setError(e.message || "Unable to load allocation steps."));
  }, []);

  const runAllocation = async () => {
    try {
      setRunning(true);
      setError("");
      const response = await allocationService.simulate({ capRound: Number(capRound), ruleSetVersionId: "draft-runtime", ...SAMPLE_DATA });
      setResult(response?.data || response);
    } catch (e) {
      setError(e.message || "Unable to run allocation.");
    } finally {
      setRunning(false);
    }
  };

  const decisions = useMemo(() => result?.decisions || [], [result]);
  const activeStages = stages.filter((stage) => stage.enabled);

  return (
    <div className="allocation-page">
      <div className="allocation-hero">
        <div>
          <span className="page-eyebrow">CET Allocation</span>
          <h1>Allocation Run</h1>
          <p>Run the configured CET allocation rules for a CAP round.</p>
        </div>
      </div>

      {error && <div className="allocation-error">{error}</div>}

      <section className="allocation-section allocation-setup">
        <div className="allocation-section-heading"><div><span>Setup</span><h2>Allocation Setup</h2></div></div>
        <div className="allocation-form-grid">
          <label>CAP Round<select value={capRound} onChange={(e) => setCapRound(e.target.value)}><option value="1">Round 1</option><option value="2">Round 2</option><option value="3">Round 3</option></select></label>
          <label>Rule Set<select value={ruleSet} onChange={(e) => setRuleSet(e.target.value)}><option>CET 2026 - Round 1</option><option>CET 2026 - Round 2</option></select></label>
        </div>
      </section>

      <section className="allocation-section">
        <div className="allocation-section-heading"><div><span>Configured process</span><h2>Allocation Steps</h2></div><span className="allocation-count">{activeStages.length} selected</span></div>
        <div className="allocation-step-list">
          {activeStages.map((stage) => (
            <div className="allocation-step" key={stage.stageCode}><span className="allocation-step-check"><FiCheck size={15} /></span><div><strong>{stage.stageCode.replaceAll("_", " ")}</strong><span>Included in this allocation run</span></div></div>
          ))}
        </div>
        <div className="allocation-run-action"><Button onClick={runAllocation} disabled={running}><span>{running ? <FiRefreshCw className="allocation-spin" size={16} /> : <FiPlay size={16} />}</span>{running ? "Running Allocation..." : "Run Allocation"}</Button></div>
      </section>

      {result && (
        <section className="allocation-section allocation-result-section">
          <div className="allocation-section-heading"><div><span>Completed run</span><h2>Allocation Result</h2></div><span className="allocation-status">{result.run?.status || "Completed"}</span></div>
          <div className="allocation-summary-grid">
            <div><span>Candidates Processed</span><strong>{SAMPLE_DATA.candidates.length}</strong></div>
            <div><span>Allocations Made</span><strong>{decisions.length}</strong></div>
            <div><span>Not Allocated</span><strong>{Math.max(0, SAMPLE_DATA.candidates.length - decisions.length)}</strong></div>
          </div>
          <div className="allocation-stage-results">
            {(result.stages || []).map((stage) => <div className="allocation-stage-result" key={stage.stageCode}><div><strong>{stage.stageCode.replaceAll("_", " ")}</strong><span>{stage.status}</span></div><strong>{stage.decisionsCreated || 0} allocations</strong></div>)}
          </div>
          {decisions.length > 0 ? <div className="allocation-table-wrapper"><table className="allocation-table"><thead><tr><th>Candidate</th><th>College</th><th>Preference</th><th>Category</th><th>Allocation Type</th></tr></thead><tbody>{decisions.map((decision) => <tr key={decision.decisionId}><td>{decision.candidateId}</td><td>{decision.collegeId}</td><td>{decision.preferenceNo}</td><td>{decision.categoryId}</td><td>{decision.originalAllocatedType}</td></tr>)}</tbody></table></div> : <div className="allocation-empty">No candidates were allocated in this run.</div>}
        </section>
      )}
    </div>
  );
}

export default Allocation;
