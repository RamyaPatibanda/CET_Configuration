import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowDown, FiArrowUp, FiCheck, FiChevronDown, FiSearch, FiTrash2 } from "react-icons/fi";
import DecisionAreaRuleSelect from "./DecisionAreaRuleSelect";

const STEP_1_STAGES = [
  { code: "CANDIDATE_QUALIFICATION", name: "Candidate Qualification", description: "Determine which candidates enter the main allocation pool." },
  { code: "PREFERENCE_EVALUATION", name: "Preference Evaluation", description: "Determine which preferences can be considered and how preference traversal is evaluated." },
  { code: "SEAT_ELIGIBILITY", name: "Seat Eligibility", description: "Determine whether a candidate can use the current seat row, category, quota and minority seat." },
  { code: "STEP_1_ALLOCATION_TYPE_SEQUENCE", name: "Allocation Type & Sequence", description: "Evaluate allocation-type rules in order. The first matching rule determines the seat column and its position becomes SeqId." },
  { code: "BETTERMENT", name: "Betterment", description: "Determine whether an existing allocation may be replaced by a better preference or sequence." },
];

function OrderedRuleSelect({ area, rules, group, openRuleGroup, setOpenRuleGroup, toggleRule, moveRule, disabled }) {
  const [search, setSearch] = useState("");
  const isOpen = openRuleGroup === area.code;
  const selectRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});

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

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (
        selectRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpenRuleGroup(null);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen, setOpenRuleGroup]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportPadding = 8;
      const gap = 6;
      const minMenuHeight = 120;
      const preferredMenuHeight = 260;
      const availableBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding - gap);
      const availableAbove = Math.max(0, rect.top - viewportPadding - gap);
      const openUp = availableBelow < minMenuHeight && availableAbove > availableBelow;
      const availableSpace = openUp ? availableAbove : availableBelow;
      const maxHeight = Math.max(
        minMenuHeight,
        Math.min(preferredMenuHeight, availableSpace)
      );

      setMenuStyle({
        position: "fixed",
        zIndex: 100000,
        left: rect.left,
        width: rect.width,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, filteredRules.length]);

  return (
    <div className="allocation-decision-area allocation-sequence-area" ref={selectRef}>
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
          ref={triggerRef}
          className={"allocation-multiselect-trigger" + (group.ruleIds.length ? " has-selection" : "")}
          onClick={() => {
            if (disabled) return;
            const next = isOpen ? null : area.code;
            setOpenRuleGroup(next);
            if (next) setSearch("");
          }}
        >
          <span>{group.ruleIds.length ? `${group.ruleIds.length} rule${group.ruleIds.length === 1 ? "" : "s"} selected` : "Select rules from Rule Configuration"}</span>
          <FiChevronDown size={16} />
        </button>

        {isOpen && !disabled && createPortal(
          <div
            ref={menuRef}
            className="allocation-multiselect-menu allocation-sequence-menu allocation-portal-menu"
            style={menuStyle}
          >
            {selectedRules.length > 0 && (
              <div className="allocation-sequence-selected" aria-label="Selected rule sequence">
                {selectedRules.map((rule, index) => (
                  <div className="allocation-sequence-item" key={area.code + "-selected-" + rule.ruleId}>
                    <span className="allocation-sequence-number">{index + 1}</span>
                    <div className="allocation-sequence-rule">
                      <strong>{rule.ruleName}</strong>
                    </div>
                    <div className="allocation-sequence-actions">
                      <button type="button" disabled={disabled || index === 0} onClick={() => moveRule(area.code, rule.ruleId, -1)} title="Move up"><FiArrowUp size={13} /></button>
                      <button type="button" disabled={disabled || index === selectedRules.length - 1} onClick={() => moveRule(area.code, rule.ruleId, 1)} title="Move down"><FiArrowDown size={13} /></button>
                      <button type="button" disabled={disabled} onClick={() => toggleRule(area.code, Number(rule.ruleId))} title="Remove"><FiTrash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="allocation-rule-search">
              <FiSearch size={14} />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search rules..."
              />
            </div>
            <div className="allocation-rule-options">
              {filteredRules.map((rule) => {
                const selected = group.ruleIds.includes(Number(rule.ruleId));
                return (
                  <button
                    type="button"
                    key={area.code + "-" + rule.ruleId}
                    className={"allocation-multiselect-option" + (selected ? " selected" : "")}
                    onClick={() => toggleRule(area.code, Number(rule.ruleId))}
                  >
                    <span className="allocation-rule-check">{selected && <FiCheck size={13} />}</span>
                    <span className="allocation-rule-content">
                      <strong>{rule.ruleName}</strong>
                      <span>{rule.description || ((rule.conditionCount || 0) + " conditions")}</span>
                    </span>
                  </button>
                );
              })}
              {!filteredRules.length && <div className="allocation-rule-no-results">No active rules configured.</div>}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

function Step1DecisionAreas({ rules, ruleGroups, openRuleGroup, setOpenRuleGroup, toggleRule, moveSequenceRule, disabled }) {
  const orderedArea = STEP_1_STAGES.find((area) => area.code === "STEP_1_ALLOCATION_TYPE_SEQUENCE");

  return (
    <div className="allocation-stage-list">
      {STEP_1_STAGES.map((area) => {
        const group = ruleGroups.find((item) => item.type === area.code) || { type: area.code, ruleIds: [] };

        if (area.code === orderedArea.code) {
          return (
            <OrderedRuleSelect
              key={area.code}
              area={area}
              group={group}
              rules={rules}
              openRuleGroup={openRuleGroup}
              setOpenRuleGroup={setOpenRuleGroup}
              toggleRule={toggleRule}
              moveRule={moveSequenceRule}
              disabled={disabled}
            />
          );
        }

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

export { STEP_1_STAGES, STEP_1_STAGES as STEP_1_DECISION_AREAS };
export default Step1DecisionAreas;
