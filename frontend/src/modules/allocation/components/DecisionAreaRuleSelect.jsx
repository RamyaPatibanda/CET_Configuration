import { useMemo, useState } from "react";
import { FiCheck, FiChevronDown, FiSearch } from "react-icons/fi";

function DecisionAreaRuleSelect({ area, group, rules, openRuleGroup, setOpenRuleGroup, toggleRule, disabled }) {
  const [search, setSearch] = useState("");
  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rules;
    return rules.filter((rule) =>
      [rule.ruleName, rule.description].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      )
    );
  }, [rules, search]);

  const selectedRuleNames = group.ruleIds
    .map((id) => rules.find((rule) => rule.ruleId === id)?.ruleName)
    .filter(Boolean)
    .join(", ");

  return (
    <div className={`allocation-stage-card${disabled ? " is-disabled" : ""}`}>
      <div className="allocation-stage-heading"><div className="allocation-stage-title"><span>Stage</span><h3>{area.name}</h3><p>{area.description}</p></div><span>{group.ruleIds.length} selected</span></div>

      <div className="allocation-multiselect">
        <button type="button"
          disabled={disabled}
          className={"allocation-multiselect-trigger" + (group.ruleIds.length ? " has-selection" : "")}
          onClick={() => {
            if (disabled) return;
            const nextOpen = openRuleGroup === area.code ? null : area.code;
            setOpenRuleGroup(nextOpen);
            if (nextOpen === area.code) setSearch("");
          }}>
          <span>{selectedRuleNames || "Select rules from Rule Configuration"}</span>
          <FiChevronDown size={16} />
        </button>

        {openRuleGroup === area.code && !disabled && (
          <div className="allocation-multiselect-menu">
            <div className="allocation-rule-search">
              <FiSearch size={14} />
              <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Search rules..." aria-label="Search rules"
                onClick={(event) => event.stopPropagation()} />
            </div>
            <div className="allocation-rule-options">
              {filteredRules.map((rule) => {
                const selected = group.ruleIds.includes(rule.ruleId);
                return (
                  <button type="button" key={area.code + "-" + rule.ruleId}
                    className={"allocation-multiselect-option" + (selected ? " selected" : "")}
                    onClick={() => toggleRule(area.code, rule.ruleId)}>
                    <span className="allocation-rule-check">{selected && <FiCheck size={13} />}</span>
                    <span className="allocation-rule-content">
                      <strong>{rule.ruleName}</strong>
                      <span>{rule.description || (rule.conditionCount || 0) + " condition" + (rule.conditionCount === 1 ? "" : "s")}</span>
                    </span>
                    <span className="allocation-rule-priority">Priority {rule.priority}</span>
                  </button>
                );
              })}
              {!filteredRules.length && <div className="allocation-rule-no-results">No matching rules</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DecisionAreaRuleSelect;
