import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiArchive, FiAward, FiCheck, FiCopy, FiEye, FiHeart, FiPlay, FiRefreshCw, FiSave, FiShield, FiUsers } from "react-icons/fi";
import Step0DecisionAreas, { STEP_0_STAGES } from "../components/Step0DecisionAreas";
import Step1DecisionAreas, { STEP_1_STAGES } from "../components/Step1DecisionAreas";
import Button from "../../../components/common/Button/Button";
import allocationService from "../services/allocationService";
import ruleConfigurationService from "../../ruleConfiguration/services/ruleConfigurationService";
import authService from "../../../services/authService";
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
  stepCode === "STEP_0"
    ? [
        { type: "CANDIDATE_QUALIFICATION", ruleIds: [] },
        { type: "STEP_0_SEAT_DISTRIBUTION", ruleIds: [] },
        { type: "STEP_0_ALLOCATION_TYPE_SEQUENCE", ruleIds: [] },
      ]
    : (getDecisionAreaConfig(stepCode)?.stages || []).map((area) => ({ type: area.code, ruleIds: [] }));

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
  const canWrite = authService.hasPermission("ALLOCATION_RUN", "write");
  const canEdit = editableStatuses.has(status) && !running && canWrite;

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
            if (existingRun.allocationStep === "STEP_0" && savedGroups && !Array.isArray(savedGroups)) {
              const historyKeyByGroup = {
                CANDIDATE_QUALIFICATION: "candidateEligibilityRules",
                STEP_0_SEAT_DISTRIBUTION: "seatDistributionRules",
                STEP_0_ALLOCATION_TYPE_SEQUENCE: "allocationTypeSequenceRules",
              };
              const key = historyKeyByGroup[group.type];
              const legacyRules = group.type === "STEP_0_ALLOCATION_TYPE_SEQUENCE"
                ? [
                    ...(savedGroups.allocationTypeRules || []),
                    ...(savedGroups.sequenceRules || [])
                  ]
                : savedGroups[key];
              return {
                ...group,
                ruleIds: (legacyRules || [])
                  .map((rule) => Number(rule.ruleId))
                  .filter((ruleId) => ruleItems.some((rule) => rule.ruleId === ruleId)),
              };
            }
            const savedGroupList = Array.isArray(savedGroups)
              ? savedGroups
              : Array.isArray(savedGroups?.groups)
                ? savedGroups.groups
                : [];
            const savedGroup = savedGroupList.find((item) =>
              String(item.type).toUpperCase() === String(group.type).toUpperCase()
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

          // Completed runs opened from Overview are view-only. The run summary is
          // persisted in the history payload so the same summary can be displayed
          // without executing the allocation again.
          let savedReport = null;
          if (existingRun.ruleGroupsJson) {
            try {
              const historyPayload = JSON.parse(existingRun.ruleGroupsJson);
              savedReport = historyPayload?.report || null;
            } catch {
              savedReport = null;
            }
          }
          setResult(savedReport ? { run: existingRun, report: savedReport, decisions: [], stages: savedReport.stages || [] } : null);
          setMessage(existingRun.status === "Draft"
            ? "Draft loaded in edit mode. Update the configuration and run when ready."
            : savedReport
              ? "Allocation run summary loaded. This is a view of the completed run."
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

  const moveSequenceRule = (ruleId, direction) => {
    if (!canEdit) return;
    setRuleGroups((current) => current.map((group) => {
      if (!["STEP_0_SEAT_DISTRIBUTION", "STEP_0_ALLOCATION_TYPE_SEQUENCE", "STEP_1_ALLOCATION_TYPE_SEQUENCE"].includes(group.type)) return group;
      const index = group.ruleIds.indexOf(ruleId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= group.ruleIds.length) return group;
      const ruleIds = [...group.ruleIds];
      [ruleIds[index], ruleIds[target]] = [ruleIds[target], ruleIds[index]];
      return { ...group, ruleIds };
    }));
    markEdited();
  };

  const buildRequest = () => {
    if (allocationStep === "STEP_0") {
      return {
        allocationRunId: runId,
        allocationRunName: runName.trim(),
        capRound: Number(capRound),
        allocationStep,
        candidateEligibilityRuleIds: ruleGroups.find((group) => group.type === "CANDIDATE_QUALIFICATION")?.ruleIds || [],
        seatDistributionRuleIds: ruleGroups.find((group) => group.type === "STEP_0_SEAT_DISTRIBUTION")?.ruleIds || [],
        allocationTypeSequenceRuleIds: ruleGroups.find((group) => group.type === "STEP_0_ALLOCATION_TYPE_SEQUENCE")?.ruleIds || [],
      };
    }
    return {
      allocationRunId: runId,
      allocationRunName: runName.trim(),
      capRound: Number(capRound),
      allocationStep,
      ruleGroups: ruleGroups.filter((group) => group.ruleIds.length > 0),
    };
  };

  const validateClient = () => {
    if (!runName.trim()) return "Allocation run name is required.";
    if (!selectedStep?.enabled) return "Please select an available allocation step.";
    if (allocationStep === "STEP_0") {
      const candidateCount = ruleGroups.find((group) => group.type === "CANDIDATE_QUALIFICATION")?.ruleIds.length || 0;
      const seatDistributionCount = ruleGroups.find((group) => group.type === "STEP_0_SEAT_DISTRIBUTION")?.ruleIds.length || 0;
      const allocationTypeSequenceCount = ruleGroups.find((group) => group.type === "STEP_0_ALLOCATION_TYPE_SEQUENCE")?.ruleIds.length || 0;
      if (!candidateCount) return "Select at least one candidate eligibility rule.";
      if (!seatDistributionCount) return "Select at least one seat distribution rule.";
      if (!allocationTypeSequenceCount) return "Select at least one allocation type & sequence rule.";
      return "";
    }
    const configuredAreas = getDecisionAreaConfig(allocationStep)?.stages || [];
    const selectedGroups = new Map(ruleGroups.map((group) => [group.type, group]));
    const missingAreas = configuredAreas.filter((area) => !(selectedGroups.get(area.code)?.ruleIds?.length > 0)).map((area) => area.name);
    if (missingAreas.length > 0) return "Validation failed. Please select at least one rule for: " + missingAreas.join(", ") + ".";
    if (!selectedRuleCount) return "Validation failed. Please assign at least one rule.";
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

  const report = result?.report || null;
  const candidateCount = report?.totalCandidatesProcessed ?? 0;
  const allocatedCount = report?.totalCandidatesAllocated ?? decisions.length;
  const notAllocatedCount = report?.totalCandidatesNotAllocated ?? Math.max(0, candidateCount - allocatedCount);

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
        <section className="allocation-section allocation-rule-selection">
          <div className="allocation-section-heading">
            <div><span>{allocationStep === "STEP_0" ? "Step 0 configuration" : "Decision areas for this allocation step"}</span><h2>{allocationStep === "STEP_0" ? "Step 0 Rules" : "Decision Areas"}</h2></div>
            <span className="allocation-count">{selectedRuleCount} selected</span>
          </div>

          {allocationStep === "STEP_0" && (
            <div className="allocation-rule-note">
              <FiCheck size={15} />
              <span>Candidate Eligibility builds the pool. Seat Distribution resolves PH/Def/Orp vacancy only when normal vacancy is zero. Allocation Type &amp; Sequence evaluates the selected rules in order: the first matching rule determines the seat column and its position becomes the SeqId.</span>
            </div>
          )}
          {allocationStep === "STEP_1" && (
            <div className="allocation-rule-note">
              <FiCheck size={15} />
              <span>Step 1 follows merit and preference order. Candidate Qualification controls the candidate pool, Preference Evaluation controls preference traversal, Seat Eligibility controls the seat row, Allocation Type &amp; Sequence selects the configured seat column and sequence, and Betterment controls replacement of an existing allocation.</span>
            </div>
          )}

          {!rules.length ? (
            <div className="allocation-empty">No active rules are configured. Create and activate rules in Rule Configuration first.</div>
          ) : (
            <DecisionAreas
              rules={rules}
              ruleGroups={ruleGroups}
              openRuleGroup={openRuleGroup}
              setOpenRuleGroup={setOpenRuleGroup}
              toggleRule={toggleRule}
              moveSequenceRule={moveSequenceRule}
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
                <Button onClick={cloneRun} disabled={!canWrite}><FiCopy size={16} /> Clone Run</Button>
                <Button onClick={archiveRun} disabled={running || !canWrite}><FiArchive size={16} /> Archive</Button>
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
          <div className="allocation-result-header">
            <div>
              <span className="allocation-result-eyebrow">RUN COMPLETED</span>
              <h2>Allocation Summary</h2>
              <p>Actual allocation outcomes from this run, grouped by candidate and reservation type.</p>
            </div>
            <div className="allocation-result-status">
              <FiCheck size={15} />
              {result.run?.status || "Completed"}
            </div>
          </div>

          <div className="allocation-report-kpis">
            <div className="allocation-report-kpi primary">
              <div className="allocation-report-kpi-icon"><FiUsers size={17} /></div>
              <div><span>Candidates Processed</span><strong>{candidateCount.toLocaleString()}</strong></div>
            </div>
            <div className="allocation-report-kpi success">
              <div className="allocation-report-kpi-icon"><FiCheck size={17} /></div>
              <div><span>Successfully Allocated</span><strong>{allocatedCount.toLocaleString()}</strong></div>
            </div>
            <div className="allocation-report-kpi warning">
              <div className="allocation-report-kpi-icon"><FiEye size={17} /></div>
              <div><span>Not Allocated</span><strong>{notAllocatedCount.toLocaleString()}</strong></div>
            </div>
          </div>

          <div className="allocation-report-section-title">
            <div>
              <span>Reservation outcome</span>
              <strong>Special Reservation Allocations</strong>
            </div>
            <span>{(report?.phAllocated || 0) + (report?.defenceAllocated || 0) + (report?.orphanAllocated || 0)} total</span>
          </div>

          <div className="allocation-reservation-grid">
            <div className="allocation-reservation-card ph">
              <div className="allocation-reservation-icon"><FiHeart size={18} /></div>
              <div><span>PH</span><strong>{(report?.phAllocated || 0).toLocaleString()}</strong><small>allocations</small></div>
            </div>
            <div className="allocation-reservation-card defence">
              <div className="allocation-reservation-icon"><FiShield size={18} /></div>
              <div><span>Defence</span><strong>{(report?.defenceAllocated || 0).toLocaleString()}</strong><small>allocations</small></div>
            </div>
            <div className="allocation-reservation-card orphan">
              <div className="allocation-reservation-icon"><FiAward size={18} /></div>
              <div><span>Orphan</span><strong>{(report?.orphanAllocated || 0).toLocaleString()}</strong><small>allocations</small></div>
            </div>
          </div>

          <div className="allocation-report-section-title">
            <div>
              <span>Seat outcome</span>
              <strong>Allocation Type</strong>
            </div>
            <span>{(report?.generalAllocated || 0) + (report?.femaleAllocated || 0)} total</span>
          </div>

          <div className="allocation-type-strip">
            <div>
              <span>General</span>
              <strong>{(report?.generalAllocated || 0).toLocaleString()}</strong>
            </div>
            <div className="allocation-type-divider" />
            <div>
              <span>Female</span>
              <strong>{(report?.femaleAllocated || 0).toLocaleString()}</strong>
            </div>
          </div>

          <div className="allocation-report-section-title">
            <div>
              <span>Execution breakdown</span>
              <strong>Stage Summary</strong>
            </div>
          </div>

          <div className="allocation-report-stage-list">
            {(report?.stages || result.stages || []).map((stage) => {
              const processed = stage.candidatesProcessed ?? stage.candidateCountBefore ?? 0;
              const allocated = stage.candidatesAllocated ?? stage.candidateCountAfter ?? stage.decisionsCreated ?? 0;
              const stageNotAllocated = stage.candidatesNotAllocated ?? Math.max(0, processed - allocated);
              return (
                <div className="allocation-report-stage" key={stage.stageCode}>
                  <div className="allocation-report-stage-main">
                    <span>{stageLabels[stage.stageCode] || stage.stageCode.replaceAll("_", " ")}</span>
                    <strong>{stage.status || "Completed"}</strong>
                  </div>
                  <div className="allocation-report-stage-stat"><small>Processed</small><b>{processed.toLocaleString()}</b></div>
                  <div className="allocation-report-stage-stat"><small>Allocated</small><b>{allocated.toLocaleString()}</b></div>
                  <div className="allocation-report-stage-stat"><small>Not allocated</small><b>{stageNotAllocated.toLocaleString()}</b></div>
                </div>
              );
            })}
          </div>

          {decisions.length > 0 ? (
            <details className="allocation-decision-details">
              <summary>View allocation decisions <span>{decisions.length.toLocaleString()}</span></summary>
              <div className="allocation-table-wrapper">
                <table className="allocation-table">
                  <thead><tr><th>Candidate</th><th>Reservation</th><th>Allocation Type</th><th>Preference</th><th>Category</th><th>Rule</th></tr></thead>
                  <tbody>
                    {decisions.map((decision) => (
                      <tr key={decision.decisionId}>
                        <td>{decision.candidateId}</td>
                        <td>{decision.vacancyType || decision.originalAllocatedType || "Regular"}</td>
                        <td>{decision.allocatedType || "—"}</td>
                        <td>{decision.preferenceNo || "—"}</td>
                        <td>{decision.categoryId}</td>
                        <td>{decision.ruleCode || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : (
            <div className="allocation-empty">No decisions were created in this run.</div>
          )}
        </section>
      )}
    </div>
  );
}

export default Allocation;