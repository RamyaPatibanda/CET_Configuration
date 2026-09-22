import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiArchive, FiCheck, FiCopy, FiEye, FiPlay, FiRefreshCw, FiSave } from "react-icons/fi";
import Step0DecisionAreas, { STEP_0_STAGES } from "../components/Step0DecisionAreas";
import Step1DecisionAreas, { STEP_1_STAGES } from "../components/Step1DecisionAreas";
import Button from "../../../components/common/Button/Button";
import allocationService from "../services/allocationService";
import ruleConfigurationService from "../../ruleConfiguration/services/ruleConfigurationService";
import "../allocation.css";

const getItems = (response) => Array.isArray(response) ? response : response?.data || [];

const stageLabels = {
  CANDIDATE_QUALIFICATION: "Candidate Eligibility",
  SPECIAL_RESERVATION: "Special Reservation",
  SEAT_ALLOCATION: "Main Allocation",
  CONVERSION: "Seat Conversion",
  BETTERMENT: "Betterment",
  RECONCILIATION: "Reconciliation",
};

const DECISION_AREA_COMPONENTS = {
  STEP_0: { Component: Step0DecisionAreas, stages: STEP_0_STAGES },
  STEP_1: { Component: Step1DecisionAreas, stages: STEP_1_STAGES },
};

const getDecisionAreaConfig = (stepCode) => DECISION_AREA_COMPONENTS[stepCode] || null;

const createRuleGroups = (stepCode) =>
  (getDecisionAreaConfig(stepCode)?.stages || []).map((area) => ({ type: area.code, ruleIds: [] }));

const editableStatuses = new Set(["Draft", "Ready", "Failed", "Cancelled"]);
const lockedStatuses = new Set(["Running", "Completed", "Archived"]);

const normalizeStatus = (value, fallback = "Draft") => {
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    return ["Draft", "Ready", "Running", "Completed", "Failed", "Cancelled", "Archived"][value] || fallback;
  }
  return fallback;
};

function Allocation() {
  const [steps, setSteps] = useState([]);
  const [rules, setRules] = useState([]);
  const [allocationStep, setAllocationStep] = useState("STEP_0");
  const [runId, setRunId] = useState(null);
  const [runName, setRunName] = useState("");
  const [openRuleGroup, setOpenRuleGroup] = useState(null);
  const [ruleGroups, setRuleGroups] = useState([]);
  const [capRound, setCapRound] = useState(1);
  const [status, setStatus] = useState("Draft");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchParams] = useSearchParams();
  const editRunId = searchParams.get("runId");

  const selectedStep = useMemo(
    () => steps.find((step) => step.code === allocationStep) || null,
    [steps, allocationStep]
  );

  const selectedRuleCount = useMemo(
    () => ruleGroups.reduce((count, group) => count + group.ruleIds.length, 0),
    [ruleGroups]
  );

  const isLocked = lockedStatuses.has(status);
  const canEdit = editableStatuses.has(status) && !running;

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const [stepResponse, ruleResponse, historyResponse] = await Promise.all([
          allocationService.getSteps(),
          ruleConfigurationService.getRules(true),
          editRunId ? allocationService.getHistory() : Promise.resolve([]),
        ]);

        const stepItems = getItems(stepResponse);
        const ruleItems = getItems(ruleResponse)
          .filter((rule) => rule.isActive)
          .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

        const historyItems = getItems(historyResponse);
        const existingRun = editRunId
          ? historyItems.find((run) => String(run.allocationRunId).toLowerCase() === String(editRunId).toLowerCase())
          : null;

        setSteps(stepItems);
        setRules(ruleItems);

        if (existingRun) {
          let savedGroups = [];
          try {
            savedGroups = JSON.parse(existingRun.ruleGroupsJson || "[]");
          } catch {
            savedGroups = [];
          }

          const savedStep = stepItems.find((step) => step.code === existingRun.allocationStep);
          const groups = createRuleGroups(existingRun.allocationStep).map((group) => {
            const savedGroup = savedGroups.find(
              (item) => String(item.type).toUpperCase() === String(group.type).toUpperCase()
            );
            return {
              ...group,
              ruleIds: (savedGroup?.rules || [])
                .map((rule) => Number(rule.ruleId))
                .filter((ruleId) => ruleItems.some((rule) => rule.ruleId === ruleId)),
            };
          });

          setRunId(existingRun.allocationRunId);
          setRunName(existingRun.allocationRunName || "");
          setCapRound(existingRun.capRound || 1);
          setAllocationStep(savedStep?.code || existingRun.allocationStep);
          setRuleGroups(groups);
          setStatus(normalizeStatus(existingRun.status, "Draft"));
          setResult(null);
          setMessage(existingRun.status === "Draft"
            ? "Draft loaded in edit mode. Update the configuration and run when ready."
            : "Allocation run loaded with status " + existingRun.status + ".");
          return;
        }

        const firstAvailableStep = stepItems.find((step) => step.enabled) || stepItems[0];
        if (firstAvailableStep) {
          setAllocationStep(firstAvailableStep.code);
          setRuleGroups(createRuleGroups(firstAvailableStep.code));
        }
      } catch (e) {
        setError(e.message || "Unable to load allocation configuration.");
      }
    };

    load();
  }, [editRunId]);

  const markEdited = () => {
    if (status === "Ready") setStatus("Draft");
    setResult(null);
    setMessage("");
  };

  const changeStep = (step) => {
    if (!step.enabled || !canEdit) return;
    setAllocationStep(step.code);
    setRuleGroups(createRuleGroups(step.code));
    markEdited();
  };

  const toggleRule = (groupType, ruleId) => {
    if (!canEdit) return;
    setRuleGroups((current) => current.map((group) => {
      if (group.type !== groupType) return group;
      const selected = group.ruleIds.includes(ruleId);
      return {
        ...group,
        ruleIds: selected
          ? group.ruleIds.filter((id) => id !== ruleId)
          : [...group.ruleIds, ruleId],
      };
    }));
    markEdited();
  };

  const buildRequest = () => ({
    allocationRunId: runId,
    allocationRunName: runName.trim(),
    capRound: Number(capRound),
    allocationStep,
    ruleGroups: ruleGroups.filter((group) => group.ruleIds.length > 0),
  });

  const validateClient = () => {
    if (!runName.trim()) return "Allocation run name is required.";
    if (!selectedStep?.enabled) return "Please select an available allocation step.";

    const configuredAreas = getDecisionAreaConfig(allocationStep)?.stages || [];
    const selectedGroups = new Map(ruleGroups.map((group) => [group.type, group]));

    const missingAreas = configuredAreas
      .filter((area) => !(selectedGroups.get(area.code)?.ruleIds?.length > 0))
      .map((area) => area.name);

    if (missingAreas.length > 0) {
      return `Validation failed. Please select at least one rule for: ${missingAreas.join(", ")}.`;
    }

    if (!selectedRuleCount) {
      return "Validation failed. Please assign at least one rule to a decision area.";
    }
    if (allocationStep === "STEP_0") {
      const seatRuleIds = selectedGroups.get("SEAT_ALLOCATION")?.ruleIds || [];
      if (seatRuleIds.length && (allocationDecisions.length !== seatRuleIds.length || allocationDecisions.some((item) => !item.allocatedType))) {
        return "Validation failed. Configure an allocation result for every Seat Allocation rule.";
      }
    }

    return "";
  };

  const saveDraft = async () => {
    if (!runName.trim()) {
      return setError("Enter an allocation run name.");
    }
    if (!selectedStep?.enabled) {
      return setError("Select an available allocation step.");
    }

    try {
      setRunning(true);
      setError("");
      setMessage("");
      const response = await allocationService.saveDraft(buildRequest());
      const data = response?.data || response;
      setRunId(data.run?.allocationRunId);
      setStatus(normalizeStatus(data.run?.status, "Draft"));
      setMessage("Draft saved. You can continue editing this allocation run.");
    } catch (e) {
      setError(e.message || "Unable to save allocation draft.");
    } finally {
      setRunning(false);
    }
  };

  const runAllocation = async () => {
    const validationError = validateClient();
    if (validationError) return setError(validationError);

    try {
      setRunning(true);
      setError("");
      setMessage("");
      setStatus("Running");

      const response = await allocationService.run(buildRequest());
      const data = response?.data || response;
      setResult(data);
      setRunId(data.run?.allocationRunId);
      setStatus(normalizeStatus(data.run?.status, "Completed"));
      setMessage("Allocation completed and the allocation decisions were saved.");
    } catch (e) {
      setStatus("Failed");
      setError(e.message || "Unable to run allocation.");
    } finally {
      setRunning(false);
    }
  };

  const cloneRun = () => {
    setRunId(null);
    setStatus("Draft");
    setResult(null);
    setMessage("A new draft was created from this run. Update the name before saving.");
    setRunName((current) => current ? `${current} - Copy` : "");
  };

  const archiveRun = async () => {
    if (!runId || status === "Running") return;
    try {
      setRunning(true);
      await allocationService.archive(runId);
      setStatus("Archived");
      setMessage("Allocation run archived.");
    } catch (e) {
      setError(e.message || "Unable to archive allocation run.");
    } finally {
      setRunning(false);
    }
  };

  const decisions = useMemo(() => result?.decisions || [], [result]);
  const DecisionAreas = getDecisionAreaConfig(allocationStep)?.Component;

  const candidateCount = result?.stages?.reduce(
    (count, stage) => count + (stage.candidateCountAfter || 0),
    0
  ) || 0;

  return (
    <div className="allocation-page">
      <div className="allocation-hero">
        <div>
          <span className="page-eyebrow">CET Allocation</span>
          <h1>Allocation Run</h1>
          <p>Configure and execute a controlled allocation run.</p>
        </div>
        <div className="allocation-hero-badge">
          <span>Run status</span>
          <strong className={`allocation-status-text status-${status.toLowerCase()}`}>{status}</strong>
        </div>
      </div>

      <section className="allocation-section allocation-setup">
        <div className="allocation-section-heading">
          <div><span>Run setup</span><h2>Allocation Run</h2></div>
          {runId && <span className="allocation-run-id">Run ID {runId}</span>}
        </div>

        <div className="allocation-form-grid">
          <label className="allocation-form-field allocation-form-field-wide">
            Run Name
            <input disabled={!canEdit} type="text" value={runName} maxLength={120}
              placeholder="Enter a name for this allocation run"
              onChange={(e) => { setRunName(e.target.value); markEdited(); }} />
          </label>
          <label className="allocation-form-field">
            CAP Round
            <select disabled={!canEdit} value={capRound}
              onChange={(e) => { setCapRound(e.target.value); markEdited(); }}>
              <option value="1">Round 1</option><option value="2">Round 2</option><option value="3">Round 3</option>
            </select>
          </label>
          <label className="allocation-form-field">
            Allocation Step
            <select disabled={!canEdit} value={allocationStep} onChange={(e) => {
              const step = steps.find((item) => item.code === e.target.value);
              if (step) changeStep(step);
            }}>
              {steps.map((step) => (
                <option key={step.code} value={step.code} disabled={!step.enabled}>
                  {step.name}{!step.enabled ? " — Coming Soon" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {selectedStep && (
        <section className="allocation-section">
          <div className="allocation-section-heading">
            <div><span>Decision areas for this allocation step</span><h2>Decision Areas</h2></div>
            <span className="allocation-count">{selectedRuleCount} assigned</span>
          </div>

          <div className="allocation-rule-note">
            <FiCheck size={15} />
            <span>Rules are reusable. Assign them to the decision area where they are evaluated for this allocation step.</span>
          </div>

          {!rules.length ? (
            <div className="allocation-empty">No active rules are configured. Create and activate rules in Rule Configuration first.</div>
          ) : (
            <DecisionAreas
              rules={rules}
              ruleGroups={ruleGroups}
              openRuleGroup={openRuleGroup}
              setOpenRuleGroup={setOpenRuleGroup}
              toggleRule={toggleRule}
              disabled={!canEdit}
            />
          )}
        </section>
      )}

      <section className="allocation-section allocation-execution">
        <div className="allocation-section-heading">
          <div><span>Execution</span><h2>Run Lifecycle</h2></div>
          <span className={`allocation-status allocation-status-${status.toLowerCase()}`}>{status}</span>
        </div>

        <div className="allocation-lifecycle">
          {["Draft", "Ready", "Running", "Completed"].map((item) => (
            <div key={item} className={`allocation-lifecycle-step ${item === status ? "active" : ""} ${["Completed"].includes(status) && item !== status ? "passed" : ""}`}>
              <span>{item === "Draft" ? "1" : item === "Ready" ? "2" : item === "Running" ? "3" : "4"}</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>

        <div className="allocation-execution-summary">
          <div><span>Run Name</span><strong>{runName || "—"}</strong></div>
          <div><span>CAP Round</span><strong>{capRound}</strong></div>
          <div><span>Rules Assigned</span><strong>{selectedRuleCount}</strong></div>
        </div>

        <div className="allocation-run-action">
          <div className="allocation-run-actions-buttons">
            <Button onClick={saveDraft} disabled={running || !canEdit}>
              <FiSave size={16} /> Save Draft
            </Button>
            <Button onClick={runAllocation} disabled={running || !canEdit}>
              {running ? <FiRefreshCw className="allocation-spin" size={16} /> : <FiPlay size={16} />}
              {running ? "Running Allocation..." : "Run Allocation"}
            </Button>
            {status === "Completed" && (
              <>
                <Button onClick={cloneRun}><FiCopy size={16} /> Clone Run</Button>
                <Button onClick={archiveRun} disabled={running}><FiArchive size={16} /> Archive</Button>
              </>
            )}
          </div>
          {error && (
            <div className="allocation-action-error" role="alert">
              <span className="allocation-action-error-icon">!</span>
              <div>
                <strong>Please complete the following:</strong>
                <ul>
                  {error.split(". ").filter(Boolean).map((item, index) => (
                    <li key={index}>{item.replace(/\.$/, "")}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {message && (
            <div className="allocation-action-message">
              <FiCheck size={15} />
              <span>{message}</span>
            </div>
          )}
        </div>

        {isLocked && status !== "Completed" && status !== "Archived" && (
          <div className="allocation-lock-note">This run is locked while its execution state is {status}.</div>
        )}
      </section>

      {result && (
        <section className="allocation-section allocation-result-section">
          <div className="allocation-section-heading">
            <div><span>Saved result</span><h2>Allocation Result</h2></div>
            <span className="allocation-status">{result.run?.status || "Completed"}</span>
          </div>

          <div className="allocation-summary-grid">
            <div><span>Candidates Processed</span><strong>{candidateCount}</strong></div>
            <div><span>Decisions Made</span><strong>{decisions.length}</strong></div>
            <div><span>Not Allocated</span><strong>{Math.max(0, candidateCount - decisions.length)}</strong></div>
          </div>

          <div className="allocation-stage-results">
            {(result.stages || []).map((stage) => (
              <div className="allocation-stage-result" key={stage.stageCode}>
                <div>
                  <strong>{stageLabels[stage.stageCode] || stage.stageCode.replaceAll("_", " ")}</strong>
                  <span>{stage.status}</span>
                </div>
                <strong>{stage.decisionsCreated || 0} decisions</strong>
              </div>
            ))}
          </div>

          {decisions.length > 0 ? (
            <div className="allocation-table-wrapper">
              <table className="allocation-table">
                <thead><tr><th>Candidate</th><th>Decision Area</th><th>College</th><th>Preference</th><th>Category</th><th>Rule</th></tr></thead>
                <tbody>
                  {decisions.map((decision) => (
                    <tr key={decision.decisionId}>
                      <td>{decision.candidateId}</td>
                      <td>{decision.decisionArea?.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) || "—"}</td>
                      <td>{decision.collegeId || "—"}</td>
                      <td>{decision.preferenceNo || "—"}</td>
                      <td>{decision.categoryId}</td>
                      <td>{decision.ruleCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="allocation-empty">No decisions were created in this run.</div>
          )}
        </section>
      )}
    </div>
  );
}

export default Allocation;
