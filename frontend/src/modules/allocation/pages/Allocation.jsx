import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiLock, FiPlay, FiRefreshCw } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import allocationService from "../services/allocationService";
import ruleConfigurationService from "../../ruleConfiguration/services/ruleConfigurationService";
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
    {
      collegeId: 101,
      categoryId: 1,
      quotaId: 1,
      general: 1,
      female: 0,
      ph: 1,
      defence: 0,
      orphan: 0,
    },
    {
      collegeId: 102,
      categoryId: 1,
      quotaId: 1,
      general: 2,
      female: 1,
      ph: 0,
      defence: 0,
      orphan: 0,
    },
  ],
};

const getItems = (response) =>
  Array.isArray(response) ? response : response?.data || [];

const stageLabels = {
  CANDIDATE_QUALIFICATION: "Candidate Qualification",
  SPECIAL_RESERVATION: "Special Reservation",
  SEAT_ALLOCATION: "Main Allocation",
  CONVERSION: "Seat Conversion",
  BETTERMENT: "Betterment",
  RECONCILIATION: "Reconciliation",
};

const createRuleGroups = (step) =>
  (step?.decisionAreas || []).map((area) => ({
    type: area.code,
    ruleIds: [],
  }));

function Allocation() {
  const [steps, setSteps] = useState([]);
  const [rules, setRules] = useState([]);
  const [allocationStep, setAllocationStep] = useState("STEP_0");
  const [ruleGroups, setRuleGroups] = useState([]);
  const [capRound, setCapRound] = useState(1);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const selectedStep = useMemo(
    () => steps.find((step) => step.code === allocationStep) || null,
    [steps, allocationStep]
  );

  const selectedRuleCount = useMemo(
    () => ruleGroups.reduce((count, group) => count + group.ruleIds.length, 0),
    [ruleGroups]
  );

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const [stepResponse, ruleResponse] = await Promise.all([
          allocationService.getSteps(),
          ruleConfigurationService.getRules(true),
        ]);

        const stepItems = getItems(stepResponse);
        const ruleItems = getItems(ruleResponse)
          .filter((rule) => rule.isActive)
          .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

        const firstAvailableStep =
          stepItems.find((step) => step.enabled) || stepItems[0];

        setSteps(stepItems);
        setRules(ruleItems);

        if (firstAvailableStep) {
          setAllocationStep(firstAvailableStep.code);
          setRuleGroups(createRuleGroups(firstAvailableStep));
        }
      } catch (e) {
        setError(e.message || "Unable to load allocation configuration.");
      }
    };

    load();
  }, []);

  const changeStep = (step) => {
    if (!step.enabled) return;

    setAllocationStep(step.code);
    setRuleGroups(createRuleGroups(step));
    setResult(null);
    setError("");
  };

  const toggleRule = (groupType, ruleId) => {
    setRuleGroups((current) =>
      current.map((group) => {
        if (group.type !== groupType) return group;

        const ruleIds = group.ruleIds.includes(ruleId)
          ? group.ruleIds.filter((id) => id !== ruleId)
          : [...group.ruleIds, ruleId];

        return { ...group, ruleIds };
      })
    );
    setResult(null);
  };

  const runAllocation = async () => {
    if (!selectedStep?.enabled) {
      setError("Select an available allocation step.");
      return;
    }

    if (!selectedRuleCount) {
      setError("Assign at least one configured rule to a decision area before running allocation.");
      return;
    }

    try {
      setRunning(true);
      setError("");

      const response = await allocationService.simulate({
        capRound: Number(capRound),
        allocationStep,
        ruleGroups: ruleGroups.filter((group) => group.ruleIds.length > 0),
        ...SAMPLE_DATA,
      });

      setResult(response?.data || response);
    } catch (e) {
      setError(e.message || "Unable to run allocation.");
    } finally {
      setRunning(false);
    }
  };

  const decisions = useMemo(() => result?.decisions || [], [result]);

  return (
    <div className="allocation-page">
      <div className="allocation-hero">
        <div>
          <span className="page-eyebrow">CET Allocation</span>
          <h1>Allocation Run</h1>
          <p>
            Select the allocation operation, then assign reusable rules to the
            decision areas that control that operation.
          </p>
        </div>
        <div className="allocation-hero-badge">
          <span>Current step</span>
          <strong>{selectedStep?.name || "Select a step"}</strong>
        </div>
      </div>

      {error && <div className="allocation-error">{error}</div>}

      <section className="allocation-section allocation-setup">
        <div className="allocation-section-heading">
          <div>
            <span>Run setup</span>
            <h2>Allocation Run</h2>
          </div>
        </div>

        <div className="allocation-form-grid">
          <label>
            CAP Round
            <select
              value={capRound}
              onChange={(e) => {
                setCapRound(e.target.value);
                setResult(null);
              }}
            >
              <option value="1">Round 1</option>
              <option value="2">Round 2</option>
              <option value="3">Round 3</option>
            </select>
          </label>
        </div>
      </section>

      <section className="allocation-section">
        <div className="allocation-section-heading">
          <div>
            <span>Allocation operation</span>
            <h2>Select Allocation Step</h2>
          </div>
          <span className="allocation-count">
            {steps.filter((step) => step.enabled).length} available
          </span>
        </div>

        <div className="allocation-step-selector">
          {steps.map((step) => (
            <button
              type="button"
              key={step.code}
              className={
                "allocation-step-card" +
                (allocationStep === step.code ? " selected" : "") +
                (!step.enabled ? " disabled" : "")
              }
              onClick={() => changeStep(step)}
              disabled={!step.enabled}
            >
              <span className="allocation-step-radio">
                {allocationStep === step.code && <FiCheck size={14} />}
              </span>
              <span className="allocation-step-copy">
                <strong>{step.name}</strong>
                <span>{step.description}</span>
              </span>
              <span
                className={
                  "allocation-step-status " +
                  (step.enabled ? "available" : "coming-soon")
                }
              >
                {step.enabled ? "Available" : "Coming Soon"}
              </span>
              {!step.enabled && (
                <FiLock className="allocation-step-lock" size={15} />
              )}
            </button>
          ))}
        </div>
      </section>

      {selectedStep && (
        <section className="allocation-section">
          <div className="allocation-section-heading">
            <div>
              <span>Rules from Rule Configuration</span>
              <h2>Decision Areas</h2>
            </div>
            <span className="allocation-count">
              {selectedRuleCount} assigned
            </span>
          </div>

          <div className="allocation-rule-note">
            <FiCheck size={15} />
            <span>
              Rules are reusable. Assign a rule explicitly to the decision
              area where it should be evaluated for this run. The backend will
              not infer a rule's purpose from its conditions.
            </span>
          </div>

          {!rules.length ? (
            <div className="allocation-empty">
              No active rules are configured. Create and activate rules in Rule
              Configuration before running allocation.
            </div>
          ) : (
            <div className="allocation-decision-areas">
              {selectedStep.decisionAreas.map((area) => {
                const group =
                  ruleGroups.find((item) => item.type === area.code) || {
                    type: area.code,
                    ruleIds: [],
                  };

                return (
                  <div className="allocation-decision-area" key={area.code}>
                    <div className="allocation-decision-heading">
                      <div>
                        <h3>{area.name}</h3>
                        <p>{area.description}</p>
                      </div>
                      <span>{group.ruleIds.length} selected</span>
                    </div>

                    <div className="allocation-rule-list">
                      {rules.map((rule) => {
                        const selected = group.ruleIds.includes(rule.ruleId);

                        return (
                          <button
                            type="button"
                            key={area.code + "-" + rule.ruleId}
                            className={
                              "allocation-rule-card" +
                              (selected ? " selected" : "")
                            }
                            onClick={() => toggleRule(area.code, rule.ruleId)}
                          >
                            <span className="allocation-rule-check">
                              {selected && <FiCheck size={14} />}
                            </span>
                            <span className="allocation-rule-content">
                              <strong>{rule.ruleName}</strong>
                              <span>
                                {rule.description ||
                                  (rule.conditionCount || 0) +
                                    " condition" +
                                    (rule.conditionCount === 1 ? "" : "s")}
                              </span>
                            </span>
                            <span className="allocation-rule-priority">
                              Priority {rule.priority}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="allocation-section allocation-execution">
        <div className="allocation-section-heading">
          <div>
            <span>Execution</span>
            <h2>Ready to Run</h2>
          </div>
          <span className="allocation-count">
            {selectedStep?.name || "No step selected"}
          </span>
        </div>

        <div className="allocation-execution-summary">
          <div>
            <span>CAP Round</span>
            <strong>{capRound}</strong>
          </div>
          <div>
            <span>Allocation Step</span>
            <strong>{selectedStep?.name || "—"}</strong>
          </div>
          <div>
            <span>Rules Assigned</span>
            <strong>{selectedRuleCount}</strong>
          </div>
        </div>

        <div className="allocation-run-action">
          <Button
            onClick={runAllocation}
            disabled={running || !rules.length || !selectedStep?.enabled}
          >
            <span>
              {running ? (
                <FiRefreshCw className="allocation-spin" size={16} />
              ) : (
                <FiPlay size={16} />
              )}
            </span>
            {running ? "Running Allocation..." : "Run Allocation"}
          </Button>
        </div>
      </section>

      {result && (
        <section className="allocation-section allocation-result-section">
          <div className="allocation-section-heading">
            <div>
              <span>Completed run</span>
              <h2>Allocation Result</h2>
            </div>
            <span className="allocation-status">
              {result.run?.status || "Completed"}
            </span>
          </div>

          <div className="allocation-result-step">
            <span>Allocation step executed</span>
            <strong>{selectedStep?.name || result.run?.allocationStep}</strong>
          </div>

          <div className="allocation-summary-grid">
            <div>
              <span>Candidates Processed</span>
              <strong>{SAMPLE_DATA.candidates.length}</strong>
            </div>
            <div>
              <span>Decisions Made</span>
              <strong>{decisions.length}</strong>
            </div>
            <div>
              <span>Not Allocated</span>
              <strong>
                {Math.max(0, SAMPLE_DATA.candidates.length - decisions.length)}
              </strong>
            </div>
          </div>

          <div className="allocation-stage-results">
            {(result.stages || []).map((stage) => (
              <div className="allocation-stage-result" key={stage.stageCode}>
                <div>
                  <strong>
                    {stageLabels[stage.stageCode] ||
                      stage.stageCode.replaceAll("_", " ")}
                  </strong>
                  <span>{stage.status}</span>
                </div>
                <strong>{stage.decisionsCreated || 0} decisions</strong>
              </div>
            ))}
          </div>

          {decisions.length > 0 ? (
            <div className="allocation-table-wrapper">
              <table className="allocation-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Decision Area</th>
                    <th>College</th>
                    <th>Preference</th>
                    <th>Category</th>
                    <th>Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((decision) => (
                    <tr key={decision.decisionId}>
                      <td>{decision.candidateId}</td>
                      <td>
                        {decision.decisionArea
                          ?.replaceAll("_", " ")
                          .toLowerCase()
                          .replace(/\b\w/g, (letter) => letter.toUpperCase()) ||
                          "—"}
                      </td>
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
            <div className="allocation-empty">
              No decisions were created in this run.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default Allocation;
