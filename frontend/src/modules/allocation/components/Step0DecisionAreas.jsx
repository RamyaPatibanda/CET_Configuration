import { useMemo, useState } from "react";
import { FiArrowDown, FiArrowUp, FiCheck, FiChevronDown, FiSearch, FiTrash2 } from "react-icons/fi";
import DecisionAreaRuleSelect from "./DecisionAreaRuleSelect";

const STEP_0_STAGES = [
  { code: "CANDIDATE_QUALIFICATION", name: "Candidate Eligibility", description: "Select the rules that determine which candidates enter Step 0." },
  { code: "STEP_0_SEAT_DISTRIBUTION", name: "Seat Distribution", description: "Rules are evaluated in order. When the normal seat vacancy is zero, the first matching reservation rule supplies the special vacancy and VacancyType." },
  { code: "STEP_0_ALLOCATION_TYPE", name: "Allocation Type", description: "Use the selected conditions with the calculated vacancy to determine the AllocatedType such as Fem or Gen." },
  { code: "STEP_0_SEQUENCE", name: "Sequence", description: "Rules are evaluated in the selected order. The first matching rule receives the SeqId equal to its selected position." },
];

function OrderedRuleSelect({ area, rules, group, openRuleGroup, setOpenRuleGroup, toggleRule, moveRule, disabled }) {
  const [search, setSearch] = useState("");
  const isOpen = openRuleGroup === area.code;
  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rules;
    return rules.filter((rule) =>
      [rule.ruleName, rule.description].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      )
    );
  }, [rules, search]);

  const selectedRules = group.ruleIds
    .map((id) => rules.find((rule) => Number(rule.ruleId) === Number(id)))
    .filter(Boolean);

  const conditionText = (rule) =>
    rule.description ||
    ((rule.conditionCount || 0) + " condition" + (rule.conditionCount === 1 ? "" : "s"));

  return (
    <div className="allocation-decision-area allocation-sequence-area">
      <div className="allocation-decision-heading">
        <div>
          <h3>{area.name}</h3>
          <p>{area.description}</p>
        </div>
        <span>{group.ruleIds.length} selected</span>
      </div>

      <div className="allocation-multiselect">
        <button
          type="button"
          disabled={disabled}
          className={"allocation-multiselect-trigger" + (group.ruleIds.length ? " has-selection" : "")}
          onClick={() => {
            if (disabled) return;
            const nextOpen = isOpen ? null : area.code;
            setOpenRuleGroup(nextOpen);
            if (nextOpen) setSearch("");
          }}
        >
          <span>{group.ruleIds.length ? "Add another rule" : "Select rules from Rule Configuration"}</span>
          <FiChevronDown size={16} />
        </button>

        {selectedRules.length > 0 && (
          <div className="allocation-sequence-list" aria-label={"Selected " + area.name + " rules"}>
            {selectedRules.map((rule, index) => (
              <div className="allocation-sequence-item" key={area.code + "-" + rule.ruleId}>
                <span className="allocation-sequence-number">{index + 1}</span>
                <div className="allocation-sequence-rule">
                  <strong>{rule.ruleName}</strong>
                  <span>{conditionText(rule)}</span>
                </div>
                <div className="allocation-sequence-actions">
                  <button type="button" disabled={disabled || index === 0} onClick={() => moveRule(area.code, rule.ruleId, -1)} aria-label="Move rule up" title="Move up"><FiArrowUp size={14} /></button>
                  <button type="button" disabled={disabled || index === selectedRules.length - 1} onClick={() => moveRule(area.code, rule.ruleId, 1)} aria-label="Move rule down" title="Move down"><FiArrowDown size={14} /></button>
                  <button type="button" disabled={disabled} onClick={() => toggleRule(area.code, Number(rule.ruleId))} aria-label="Remove rule" title="Remove"><FiTrash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {isOpen && !disabled && (
          <div className="allocation-multiselect-menu allocation-sequence-menu">
            <div className="allocation-rule-search">
              <FiSearch size={14} />
              <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={"Search " + area.name.toLowerCase() + " rules..."} aria-label={"Search " + area.name + " rules"} />
            </div>
            <div className="allocation-rule-options">
              {filteredRules.map((rule) => {
                const selected = group.ruleIds.includes(Number(rule.ruleId));
                return (
                  <button type="button" key={area.code + "-" + rule.ruleId} className={"allocation-multiselect-option" + (selected ? " selected" : "")} onClick={() => toggleRule(area.code, Number(rule.ruleId))}>
                    <span className="allocation-rule-check">{selected && <FiCheck size={13} />}</span>
                    <span className="allocation-rule-content">
                      <strong>{rule.ruleName}</strong>
                      <span>{conditionText(rule)}</span>
                    </span>
                  </button>
                );
              })}
              {!filteredRules.length && <div className="allocation-rule-no-results">No active rules configured.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step0DecisionAreas({ rules, ruleGroups, openRuleGroup, setOpenRuleGroup, toggleRule, moveSequenceRule, disabled }) {
  const candidateGroup = ruleGroups.find((item) => item.type === "CANDIDATE_QUALIFICATION") || { type: "CANDIDATE_QUALIFICATION", ruleIds: [] };
  const seatDistributionGroup = ruleGroups.find((item) => item.type === "STEP_0_SEAT_DISTRIBUTION") || { type: "STEP_0_SEAT_DISTRIBUTION", ruleIds: [] };
  const allocationTypeGroup = ruleGroups.find((item) => item.type === "STEP_0_ALLOCATION_TYPE") || { type: "STEP_0_ALLOCATION_TYPE", ruleIds: [] };
  const sequenceGroup = ruleGroups.find((item) => item.type === "STEP_0_SEQUENCE") || { type: "STEP_0_SEQUENCE", ruleIds: [] };

  const candidateRules = rules.filter((rule) =>
    String(rule.decisionAreaCode || rule.DecisionAreaCode || "").toUpperCase() === "CANDIDATE_QUALIFICATION"
  );

  const allNonCandidateRules = rules.filter((rule) =>
    String(rule.decisionAreaCode || rule.DecisionAreaCode || "").toUpperCase() !== "CANDIDATE_QUALIFICATION"
  );

  const candidateArea = {
    code: "CANDIDATE_QUALIFICATION",
    name: "Candidate Eligibility",
    description: STEP_0_STAGES[0].description
  };

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

      <OrderedRuleSelect
        area={STEP_0_STAGES[1]}
        rules={allNonCandidateRules}
        group={seatDistributionGroup}
        openRuleGroup={openRuleGroup}
        setOpenRuleGroup={setOpenRuleGroup}
        toggleRule={toggleRule}
        moveRule={moveSequenceRule}
        disabled={disabled}
      />

      <OrderedRuleSelect
        area={STEP_0_STAGES[2]}
        rules={allNonCandidateRules}
        group={allocationTypeGroup}
        openRuleGroup={openRuleGroup}
        setOpenRuleGroup={setOpenRuleGroup}
        toggleRule={toggleRule}
        moveRule={moveSequenceRule}
        disabled={disabled}
      />

      <OrderedRuleSelect
        area={STEP_0_STAGES[3]}
        rules={allNonCandidateRules}
        group={sequenceGroup}
        openRuleGroup={openRuleGroup}
        setOpenRuleGroup={setOpenRuleGroup}
        toggleRule={toggleRule}
        moveRule={moveSequenceRule}
        disabled={disabled}
      />
    </div>
  );
}

export { STEP_0_STAGES, STEP_0_STAGES as STEP_0_DECISION_AREAS };
export default Step0DecisionAreas;
