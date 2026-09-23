import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiChevronDown, FiSearch, FiTrash2 } from "react-icons/fi";

function DecisionAreaRuleSelect({
  area,
  group,
  rules,
  openRuleGroup,
  setOpenRuleGroup,
  toggleRule,
  disabled,
}) {
  const [search, setSearch] = useState("");
  const selectRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});

  useEffect(() => {
    if (openRuleGroup !== area.code) return undefined;

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
  }, [openRuleGroup, area.code, setOpenRuleGroup]);

  useEffect(() => {
    if (!openRuleGroup) return;
    setSearch("");
  }, [openRuleGroup]);

  useEffect(() => {
    if (openRuleGroup !== area.code) return undefined;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportPadding = 8;
      const gap = 6;
      const minMenuHeight = 120;
      const preferredMenuHeight = 260;
      const availableBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding - gap);
      const availableAbove = Math.max(0, rect.top - viewportPadding - gap);

      const openUp =
        availableBelow < minMenuHeight &&
        availableAbove > availableBelow;

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
  }, [openRuleGroup, area.code]);

  const areaRules = useMemo(
    () =>
      rules.filter(
        (rule) =>
          String(rule.decisionAreaCode || "").toUpperCase() ===
          String(area.code || "").toUpperCase()
      ),
    [rules, area.code]
  );

  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return areaRules;

    return areaRules.filter((rule) =>
      [rule.ruleName, rule.description].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      )
    );
  }, [areaRules, search]);

  const selectedRules = group.ruleIds
    .map((id) => rules.find((rule) => rule.ruleId === id))
    .filter(Boolean);

  return (
    <div className={`allocation-decision-area${disabled ? " is-disabled" : ""}`}>
      <div className="allocation-decision-heading">
        <div>
          <h3>{area.name}</h3>
          <p>{area.description}</p>
        </div>
        <span>{group.ruleIds.length} selected</span>
      </div>

      <div className="allocation-multiselect" ref={selectRef}>
        <button
          type="button"
          disabled={disabled}
          className={
            "allocation-multiselect-trigger" +
            (group.ruleIds.length ? " has-selection" : "")
          }
          ref={triggerRef}
          onClick={() => {
            if (disabled) return;
            const nextOpen = openRuleGroup === area.code ? null : area.code;
            setOpenRuleGroup(nextOpen);
          }}
        >
          <span>
            {group.ruleIds.length
              ? `${group.ruleIds.length} rule${group.ruleIds.length === 1 ? "" : "s"} selected`
              : "Select rules from Rule Configuration"}
          </span>
          <FiChevronDown size={16} />
        </button>

        {group.ruleIds.length > 0 && (
          <div className="allocation-selected-rules" aria-label="Selected rules">
            {selectedRules.map((rule, index) => (
              <div
                className="allocation-selected-rule"
                key={area.code + "-selected-" + rule.ruleId}
              >
                {index > 0 && <span className="allocation-rule-or">OR</span>}
                <span className="allocation-selected-rule-name">
                  {rule.ruleName}
                </span>
                <button
                  type="button"
                  className="allocation-remove-rule"
                  disabled={disabled}
                  onClick={() => toggleRule(area.code, rule.ruleId)}
                  aria-label="Remove rule"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {openRuleGroup === area.code &&
          !disabled &&
          createPortal(
            <div
              ref={menuRef}
              className="allocation-multiselect-menu allocation-portal-menu"
              style={menuStyle}
            >
              <div className="allocation-rule-search">
                <FiSearch size={14} />
                <input
                  autoFocus
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search rules..."
                  aria-label="Search rules"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>

              <div className="allocation-rule-options">
                {filteredRules.map((rule) => {
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

                {!filteredRules.length && (
                  <div className="allocation-rule-no-results">
                    No rules configured for this decision area.
                  </div>
                )}
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}

export default DecisionAreaRuleSelect;
