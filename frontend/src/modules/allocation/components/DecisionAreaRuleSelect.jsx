import { FiCheck, FiChevronDown } from "react-icons/fi";

function DecisionAreaRuleSelect({
  area,
  group,
  rules,
  openRuleGroup,
  setOpenRuleGroup,
  toggleRule,
}) {
  const selectedRuleNames = group.ruleIds
    .map((id) => rules.find((rule) => rule.ruleId === id)?.ruleName)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="allocation-decision-area">
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
          className={
            "allocation-multiselect-trigger" +
            (group.ruleIds.length ? " has-selection" : "")
          }
          onClick={() =>
            setOpenRuleGroup(
              openRuleGroup === area.code ? null : area.code
            )
          }
        >
          <span>
            {selectedRuleNames || "Select rules from Rule Configuration"}
          </span>
          <FiChevronDown size={16} />
        </button>

        {openRuleGroup === area.code && (
          <div className="allocation-multiselect-menu">
            {rules.map((rule) => {
              const selected = group.ruleIds.includes(rule.ruleId);

              return (
                <button
                  type="button"
                  key={area.code + "-" + rule.ruleId}
                  className={
                    "allocation-multiselect-option" +
                    (selected ? " selected" : "")
                  }
                  onClick={() => toggleRule(area.code, rule.ruleId)}
                >
                  <span className="allocation-rule-check">
                    {selected && <FiCheck size={13} />}
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
        )}
      </div>
    </div>
  );
}

export default DecisionAreaRuleSelect;
