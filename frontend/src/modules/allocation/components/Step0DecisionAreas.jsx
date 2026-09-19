import DecisionAreaRuleSelect from "./DecisionAreaRuleSelect";

const STEP_0_STAGES = [
  { code: "CANDIDATE_QUALIFICATION", name: "Candidate Eligibility", description: "Determine the candidates that enter the Step 0 processing pool." },
  { code: "SEAT_ALLOCATION", name: "Seat Allocation", description: "Evaluate allocation rules in the configured order and apply the selected result." },
];


function Step0DecisionAreas({ rules, ruleGroups, openRuleGroup, setOpenRuleGroup, toggleRule, disabled, allocationDecisions, updateAllocationDecision, moveAllocationDecision }) {
  return (
    <div className="allocation-stage-list">
      {STEP_0_STAGES.map((area) => {
        const group = ruleGroups.find((item) => item.type === area.code) || { type: area.code, ruleIds: [] };
        return (
          <DecisionAreaRuleSelect
            key={area.code}
            area={area}
            group={group}
            rules={rules}
            openRuleGroup={openRuleGroup}
            setOpenRuleGroup={setOpenRuleGroup}
            toggleRule={toggleRule}
            disabled={disabled}
            allocationDecisions={allocationDecisions}
            updateAllocationDecision={updateAllocationDecision}
            moveAllocationDecision={moveAllocationDecision}
          />
        );
      })}
    </div>
  );
}

export { STEP_0_STAGES, STEP_0_STAGES as STEP_0_DECISION_AREAS };
export default Step0DecisionAreas;
