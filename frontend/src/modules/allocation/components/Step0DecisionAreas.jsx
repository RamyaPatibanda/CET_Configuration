import { useMemo, useState } from "react";
import { FiArrowDown, FiArrowUp, FiCheck, FiChevronDown, FiSearch, FiTrash2 } from "react-icons/fi";
import DecisionAreaRuleSelect from "./DecisionAreaRuleSelect";

const STEP_0_STAGES = [
  { code: "CANDIDATE_QUALIFICATION", name: "Candidate Eligibility", description: "Select the configured rules that determine which candidates enter Step 0." },
  { code: "SEQUENCE", name: "Sequence", description: "Select the rules in the exact order in which they should be evaluated." },
];

function Step0Sequence({ rules, group, openRuleGroup, setOpenRuleGroup, toggleRule, moveSequenceRule, disabled }) {
  const [search, setSearch] = useState("");
  const sequenceRules = useMemo(() => rules.filter((rule) =>
    String(rule.decisionAreaCode || rule.DecisionAreaCode || "").toUpperCase() === "SEAT_ALLOCATION"
  ), [rules]);
  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sequenceRules;
    return sequenceRules.filter((rule) => [rule.ruleName, rule.description].some((value) =>
      String(value ?? "").toLowerCase().includes(query)));
  }, [sequenceRules, search]);
  const selectedRules = group.ruleIds
    .map((id) => sequenceRules.find((rule) => Number(rule.ruleId) === Number(id)))
    .filter(Boolean);
  const isOpen = openRuleGroup === "SEQUENCE";
  const conditionText = (rule) => rule.description || ((rule.conditionCount || 0) + " condition" + (rule.conditionCount === 1 ? "" : "s"));

  return (
    <div className="allocation-decision-area allocation-sequence-area">
      <div className="allocation-decision-heading">
        <div><h3>Sequence</h3><p>Rules are evaluated from top to bottom. The position shown here becomes the SeqId for the first matching rule.</p></div>
        <span>{group.ruleIds.length} selected</span>
      </div>
      <div className="allocation-multiselect">
        <button type="button" disabled={disabled}
          className={"allocation-multiselect-trigger" + (group.ruleIds.length ? " has-selection" : "")}
          onClick={() => { if (disabled) return; const nextOpen = isOpen ? null : "SEQUENCE"; setOpenRuleGroup(nextOpen); if (nextOpen) setSearch(""); }}>
          <span>{group.ruleIds.length ? "Add another sequence rule" : "Select sequence rules"}</span>
          <FiChevronDown size={16} />
        </button>
        {selectedRules.length > 0 && (
          <div className="allocation-sequence-list" aria-label="Selected sequence rules">
            {selectedRules.map((rule, index) => (
              <div className="allocation-sequence-item" key={rule.ruleId}>
                <span className="allocation-sequence-number">{index + 1}</span>
                <div className="allocation-sequence-rule"><strong>{rule.ruleName}</strong><span>{conditionText(rule)}</span></div>
                <div className="allocation-sequence-actions">
                  <button type="button" disabled={disabled || index === 0} onClick={() => moveSequenceRule(rule.ruleId, -1)} aria-label="Move rule up" title="Move up"><FiArrowUp size={14} /></button>
                  <button type="button" disabled={disabled || index === selectedRules.length - 1} onClick={() => moveSequenceRule(rule.ruleId, 1)} aria-label="Move rule down" title="Move down"><FiArrowDown size={14} /></button>
                  <button type="button" disabled={disabled} onClick={() => toggleRule("SEQUENCE", rule.ruleId)} aria-label="Remove rule" title="Remove"><FiTrash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {isOpen && !disabled && (
          <div className="allocation-multiselect-menu allocation-sequence-menu">
            <div className="allocation-rule-search"><FiSearch size={14} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sequence rules..." aria-label="Search sequence rules" /></div>
            <div className="allocation-rule-options">
              {filteredRules.map((rule) => {
                const selected = group.ruleIds.includes(Number(rule.ruleId));
                return (
                  <button type="button" key={rule.ruleId} className={"allocation-multiselect-option" + (selected ? " selected" : "")} onClick={() => toggleRule("SEQUENCE", Number(rule.ruleId))}>
                    <span className="allocation-rule-check">{selected && <FiCheck size={13} />}</span>
                    <span className="allocation-rule-content"><strong>{rule.ruleName}</strong><span>{conditionText(rule)}</span></span>
                  </button>
                );
              })}
              {!filteredRules.length && <div className="allocation-rule-no-results">No sequence rules configured.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step0DecisionAreas({ rules, ruleGroups, openRuleGroup, setOpenRuleGroup, toggleRule, moveSequenceRule, disabled }) {
  const candidateGroup = ruleGroups.find((item) => item.type === "CANDIDATE_QUALIFICATION") || { type: "CANDIDATE_QUALIFICATION", ruleIds: [] };
  const sequenceGroup = ruleGroups.find((item) => item.type === "SEQUENCE") || { type: "SEQUENCE", ruleIds: [] };
  const candidateRules = rules.filter((rule) => String(rule.decisionAreaCode || rule.DecisionAreaCode || "").toUpperCase() === "CANDIDATE_QUALIFICATION");
  const candidateArea = { code: "CANDIDATE_QUALIFICATION", name: "Candidate Eligibility", description: STEP_0_STAGES[0].description };
  return (
    <div className="allocation-stage-list">
      <DecisionAreaRuleSelect area={candidateArea} group={candidateGroup} rules={candidateRules} openRuleGroup={openRuleGroup} setOpenRuleGroup={setOpenRuleGroup} toggleRule={toggleRule} disabled={disabled} />
      <Step0Sequence rules={rules} group={sequenceGroup} openRuleGroup={openRuleGroup} setOpenRuleGroup={setOpenRuleGroup} toggleRule={toggleRule} moveSequenceRule={moveSequenceRule} disabled={disabled} />
    </div>
  );
}

export { STEP_0_STAGES, STEP_0_STAGES as STEP_0_DECISION_AREAS };
export default Step0DecisionAreas;