import { useMemo, useState } from "react";
import { FiCheck, FiChevronDown, FiSearch, FiMenu, FiTrash2 } from "react-icons/fi";

function DecisionAreaRuleSelect({ area, group, rules, openRuleGroup, setOpenRuleGroup, toggleRule, disabled, allocationDecisions = [], updateAllocationDecision, moveAllocationDecision }) {
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

  const selectedRules = group.ruleIds
    .map((id) => rules.find((rule) => rule.ruleId === id))
    .filter(Boolean);

  return (
    <div className={`allocation-decision-area${disabled ? " is-disabled" : ""}`}>
      <div className="allocation-decision-heading"><div><h3>{area.name}</h3><p>{area.description}</p></div><span>{group.ruleIds.length} selected</span></div>

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
          <span>{group.ruleIds.length
            ? group.ruleIds.length + " rule" + (group.ruleIds.length === 1 ? "" : "s") + " selected"
            : "Select rules from Rule Configuration"}</span>
          <FiChevronDown size={16} />
        </button>

        {group.ruleIds.length > 0 && (
          <div className="allocation-selected-rules" aria-label="Selected rules are evaluated using OR">
            {selectedRules.map((rule, index) => {
              const config = allocationDecisions.find((item) => item.ruleId === rule.ruleId) || { ruleId: rule.ruleId, allocatedType: "", vacancyType: "" };
              return (
                <div className="allocation-selected-rule" key={area.code + "-selected-" + rule.ruleId}
                  draggable={!disabled && area.code === "SEAT_ALLOCATION"}
                  onDragStart={(event) => { event.dataTransfer.setData("text/plain", String(index)); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); const from = Number(event.dataTransfer.getData("text/plain")); if (Number.isInteger(from) && from !== index) moveAllocationDecision?.(from, index); }}>
                  {index > 0 && <span className="allocation-rule-or">OR</span>}
                  {area.code === "SEAT_ALLOCATION" && <FiMenu className="allocation-drag-handle" size={15} />}
                  <span className="allocation-selected-rule-name">{rule.ruleName}</span>
                  {area.code === "SEAT_ALLOCATION" && (
                    <div className="allocation-result-controls">
                      <select value={config.allocatedType || ""} disabled={disabled} onChange={(e) => updateAllocationDecision?.(rule.ruleId, "allocatedType", e.target.value)}>
                        <option value="">Allocation result</option><option value="Fem">Fem</option><option value="Gen">Gen</option>
                      </select>
                      <select value={config.vacancyType || ""} disabled={disabled} onChange={(e) => updateAllocationDecision?.(rule.ruleId, "vacancyType", e.target.value)}>
                        <option value="">Vacancy type</option><option value="PH">PH</option><option value="Def">Def</option><option value="Orp">Orp</option>
                      </select>
                      <button type="button" className="allocation-remove-rule" disabled={disabled} onClick={() => toggleRule(area.code, rule.ruleId)} aria-label="Remove rule"><FiTrash2 size={14} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

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
