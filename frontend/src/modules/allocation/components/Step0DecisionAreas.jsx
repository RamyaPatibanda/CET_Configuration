import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiMenu, FiSearch, FiTrash2 } from "react-icons/fi";
import DecisionAreaRuleSelect from "./DecisionAreaRuleSelect";

const STEP_0_STAGES = [
  { code: "CANDIDATE_QUALIFICATION", name: "Candidate Eligibility", description: "Select the rules that determine which candidates enter Step 0." },
  { code: "STEP_0_SEAT_DISTRIBUTION", name: "Seat Distribution", description: "Rules are evaluated in order. When the normal seat vacancy is zero, the first matching reservation rule supplies the special vacancy and VacancyType." },
  { code: "STEP_0_ALLOCATION_TYPE_SEQUENCE", name: "Allocation Type & Sequence", description: "Rules are evaluated in the selected order. The first matching rule determines the allocation type and its position becomes the SeqId." },
];

function OrderedRuleSelect({ area, rules, group, openRuleGroup, setOpenRuleGroup, toggleRule, moveRule, disabled }) {
  const [search, setSearch] = useState("");
  const [draggedRuleId, setDraggedRuleId] = useState(null);
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

  const conditionText = (rule) =>
    rule.description ||
    ((rule.conditionCount || 0) + " condition" + (rule.conditionCount === 1 ? "" : "s"));

  useEffect(() => {
    if (!isOpen) return undefined;
    const outside = (event) => {
      if (selectRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpenRuleGroup(null);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [isOpen, setOpenRuleGroup]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const padding = 8;
      const gap = 6;
      const below = Math.max(0, window.innerHeight - rect.bottom - padding - gap);
      const above = Math.max(0, rect.top - padding - gap);
      const openUp = below < 120 && above > below;
      const space = openUp ? above : below;
      setMenuStyle({
        position: "fixed",
        zIndex: 100000,
        left: rect.left,
        width: rect.width,
        ...(openUp ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }),
        maxHeight: Math.max(120, Math.min(310, space)),
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, filteredRules.length, selectedRules.length]);

  const handleDrop = (targetRuleId) => {
    if (!draggedRuleId || Number(draggedRuleId) === Number(targetRuleId)) {
      setDraggedRuleId(null);
      return;
    }

    const fromIndex = group.ruleIds.findIndex((id) => Number(id) === Number(draggedRuleId));
    const targetIndex = group.ruleIds.findIndex((id) => Number(id) === Number(targetRuleId));
    if (fromIndex < 0 || targetIndex < 0) {
      setDraggedRuleId(null);
      return;
    }

    const direction = targetIndex > fromIndex ? 1 : -1;
    for (let i = 0; i < Math.abs(targetIndex - fromIndex); i += 1) {
      moveRule(area.code, Number(draggedRuleId), direction);
    }
    setDraggedRuleId(null);
  };

  return (
    <div className="allocation-decision-area allocation-sequence-area" ref={selectRef}>
      <div className="allocation-decision-heading">
        <div><h3>{area.name}</h3><p>{area.description}</p></div>
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
            const nextOpen = isOpen ? null : area.code;
            setOpenRuleGroup(nextOpen);
            if (nextOpen) setSearch("");
          }}
        >
          <span>{group.ruleIds.length ? `${group.ruleIds.length} rule${group.ruleIds.length === 1 ? "" : "s"} selected` : "Select rules from Rule Configuration"}</span>
          <FiChevronDown size={16} />
        </button>

        {isOpen && !disabled && createPortal(
          <div ref={menuRef} className="allocation-multiselect-menu allocation-sequence-menu allocation-portal-menu" style={menuStyle}>
            {selectedRules.length > 0 && (
              <div className="allocation-selected-sequence-menu">
                <div className="allocation-selected-sequence-label">Selected order · drag the handle to rearrange</div>
                {selectedRules.map((rule, index) => (
                  <div
                    className={"allocation-sequence-item" + (draggedRuleId === rule.ruleId ? " is-dragging" : "")}
                    key={area.code + "-selected-" + rule.ruleId}
                    draggable={!disabled}
                    onDragStart={() => setDraggedRuleId(rule.ruleId)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(rule.ruleId)}
                    onDragEnd={() => setDraggedRuleId(null)}
                  >
                    <span className="allocation-sequence-drag-handle" title="Drag to reorder"><FiMenu size={14} /></span>
                    <span className="allocation-sequence-number">{index + 1}</span>
                    <div className="allocation-sequence-rule">
                      <strong>{rule.ruleName}</strong>
                      <span>{conditionText(rule)}</span>
                    </div>
                    <button
                      type="button"
                      className="allocation-remove-rule"
                      disabled={disabled}
                      onClick={(event) => { event.stopPropagation(); toggleRule(area.code, Number(rule.ruleId)); }}
                      aria-label="Remove rule"
                      title="Remove"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

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
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

function Step0DecisionAreas({ rules, ruleGroups, openRuleGroup, setOpenRuleGroup, toggleRule, moveSequenceRule, disabled }) {
  const candidateGroup = ruleGroups.find((item) => item.type === "CANDIDATE_QUALIFICATION") || { type: "CANDIDATE_QUALIFICATION", ruleIds: [] };
  const seatDistributionGroup = ruleGroups.find((item) => item.type === "STEP_0_SEAT_DISTRIBUTION") || { type: "STEP_0_SEAT_DISTRIBUTION", ruleIds: [] };
  const allocationTypeSequenceGroup = ruleGroups.find((item) => item.type === "STEP_0_ALLOCATION_TYPE_SEQUENCE") || { type: "STEP_0_ALLOCATION_TYPE_SEQUENCE", ruleIds: [] };

  // Rules are reusable and no longer carry a Decision Area. Allocation stage
  // selection determines where a rule is used.
  const candidateRules = rules;
  const allNonCandidateRules = rules;

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
        group={allocationTypeSequenceGroup}
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
