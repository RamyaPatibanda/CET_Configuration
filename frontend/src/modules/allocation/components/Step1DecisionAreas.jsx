import DecisionAreaRuleSelect from "./DecisionAreaRuleSelect";

const STEP_1_STAGES = [
  { code: "CANDIDATE_QUALIFICATION", name: "Candidate Qualification", description: "Determine candidates eligible for main allocation." },
  { code: "PREFERENCE_EVALUATION", name: "Preference Evaluation", description: "Determine eligible preferences and preference traversal rules." },
  { code: "SEAT_ELIGIBILITY", name: "Seat Eligibility", description: "Determine which seats can be considered for the candidate." },
  { code: "BETTERMENT", name: "Betterment", description: "Determine whether an existing allocation can be replaced." },
];

function Step1DecisionAreas({ rules, ruleGroups, openRuleGroup, setOpenRuleGroup, toggleRule, disabled }) {
  return (
    <div className="allocation-stage-list">
      {STEP_1_STAGES.map((area) => {
        const group = ruleGroups.find((item) => item.type === area.code) || { type: area.code, ruleIds: [] };
        return <DecisionAreaRuleSelect key={area.code} area={area} group={group} rules={rules}
          openRuleGroup={openRuleGroup} setOpenRuleGroup={setOpenRuleGroup} toggleRule={toggleRule} disabled={disabled} />;
      })}
    </div>
  );
}

export { STEP_1_STAGES, STEP_1_STAGES as STEP_1_DECISION_AREAS };
export default Step1DecisionAreas;
