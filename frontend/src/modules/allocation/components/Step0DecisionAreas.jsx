import DecisionAreaRuleSelect from "./DecisionAreaRuleSelect";

const STEP_0_STAGES = [
  { code: "CANDIDATE_QUALIFICATION", name: "Candidate Eligibility", description: "Determine the candidates that enter the Step 0 processing pool." },
  { code: "SPECIAL_RESERVATION_ELIGIBILITY", name: "Reservation Eligibility", description: "Determine which special-reservation candidates and reservation types are eligible." },
  { code: "PREFERENCE_EVALUATION", name: "Preference Evaluation", description: "Determine how eligible preferences are considered." },
  { code: "SEAT_ELIGIBILITY", name: "Seat Eligibility", description: "Determine which seat and category combinations can be considered." },
  { code: "SEAT_ALLOCATION", name: "Seat Allocation", description: "Apply the allocation result carried by the selected rules." },
  { code: "BETTERMENT", name: "Betterment", description: "Determine whether an existing allocation can be replaced." },
];


function Step0DecisionAreas({ rules, ruleGroups, openRuleGroup, setOpenRuleGroup, toggleRule, disabled }) {
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
          />
        );
      })}
    </div>
  );
}

export { STEP_0_STAGES, STEP_0_STAGES as STEP_0_DECISION_AREAS };
export default Step0DecisionAreas;
