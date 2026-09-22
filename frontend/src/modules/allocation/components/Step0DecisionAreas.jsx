import DecisionAreaRuleSelect from "./DecisionAreaRuleSelect";

const STEP_0_STAGES = [
  { code: "CANDIDATE_QUALIFICATION", name: "Candidate Eligibility", description: "Select the configured rules that determine which candidates enter Step 0." },
  { code: "SEQUENCE", name: "Sequence", description: "Select configured sequence rules. Their selected order becomes SeqId." },
];

function Step0DecisionAreas({ rules, ruleGroups, openRuleGroup, setOpenRuleGroup, toggleRule, moveSequenceRule, disabled }) {
  const candidateGroup = ruleGroups.find((item) => item.type === "CANDIDATE_QUALIFICATION") || { type: "CANDIDATE_QUALIFICATION", ruleIds: [] };
  const sequenceGroup = ruleGroups.find((item) => item.type === "SEQUENCE") || { type: "SEQUENCE", ruleIds: [] };
  const candidateRules = rules.filter((rule) => String(rule.decisionAreaCode || rule.DecisionAreaCode || "").toUpperCase() === "CANDIDATE_QUALIFICATION");
  const sequenceRules = rules.filter((rule) => String(rule.decisionAreaCode || rule.DecisionAreaCode || "").toUpperCase() === "SEAT_ALLOCATION");

  const candidateArea = { code: "CANDIDATE_QUALIFICATION", name: "Candidate Eligibility", description: STEP_0_STAGES[0].description };
  const sequenceArea = { code: "SEQUENCE", name: "Sequence", description: STEP_0_STAGES[1].description };

  return (
    <div className="allocation-stage-list">
      <DecisionAreaRuleSelect
        area={candidateArea}
        group={candidateGroup}
        rules={candidateRules}
        openRuleGroup={openRuleGroup}
        setOpenRuleGroup={setOpenRuleGroup}
        toggleRule={toggleRule}
        disabled={disabled}
      />

      <div className="allocation-sequence-panel">
        <div className="allocation-stage-header">
          <div>
            <strong>Sequence</strong>
            <p>{sequenceArea.description}</p>
          </div>
          <span className="allocation-count">{sequenceGroup.ruleIds.length} selected</span>
        </div>

        <div className="allocation-rule-note">
          <span>Rules are evaluated in the order shown below. The first matching rule gets the corresponding SeqId.</span>
        </div>

        {sequenceGroup.ruleIds.length === 0 ? (
          <div className="allocation-empty allocation-empty-inline">No sequence rules selected.</div>
        ) : (
          <div className="allocation-sequence-list">
            {sequenceGroup.ruleIds.map((ruleId, index) => {
              const rule = sequenceRules.find((item) => Number(item.ruleId) === Number(ruleId));
              if (!rule) return null;
              return (
                <div className="allocation-sequence-item" key={ruleId}>
                  <div className="allocation-sequence-number">{index + 1}</div>
                  <div className="allocation-sequence-rule">
                    <strong>{rule.ruleName}</strong>
                    <span>Configured rule</span>
                  </div>
                  <div className="allocation-sequence-actions">
                    <button type="button" disabled={disabled || index === 0} onClick={() => moveSequenceRule(ruleId, -1)} aria-label="Move rule up">↑</button>
                    <button type="button" disabled={disabled || index === sequenceGroup.ruleIds.length - 1} onClick={() => moveSequenceRule(ruleId, 1)} aria-label="Move rule down">↓</button>
                    <button type="button" disabled={disabled} onClick={() => toggleRule("SEQUENCE", ruleId)} aria-label="Remove rule">×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="allocation-sequence-add">
          <select disabled={disabled} value="" onChange={(event) => {
            const id = Number(event.target.value);
            if (id) toggleRule("SEQUENCE", id);
          }}>
            <option value="">+ Select sequence rule</option>
            {sequenceRules.filter((rule) => !sequenceGroup.ruleIds.includes(Number(rule.ruleId))).map((rule) => (
              <option key={rule.ruleId} value={rule.ruleId}>{rule.ruleName}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export { STEP_0_STAGES, STEP_0_STAGES as STEP_0_DECISION_AREAS };
export default Step0DecisionAreas;
