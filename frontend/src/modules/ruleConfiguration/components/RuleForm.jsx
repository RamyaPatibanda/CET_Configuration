import { useEffect, useState } from "react";
import { FiMenu, FiPlus, FiTrash2 } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import Dialog from "../../../components/common/Dialog/Dialog";
import Select from "../../../components/common/Select/Select";
import TextBox from "../../../components/common/TextBox/TextBox";
import ruleConfigurationService from "../services/ruleConfigurationService";

const EMPTY_RULE = {
  ruleId: 0,
  ruleName: "",
  description: "",
  priority: 1,
  isActive: true,
  conditions: [],
};

const OPERATORS = {
  Text: [
    { value: "Equals", label: "Equals" },
    { value: "NotEquals", label: "Not Equals" },
    { value: "Contains", label: "Contains" },
    { value: "StartsWith", label: "Starts With" },
  ],
  Number: [
    { value: "Equals", label: "Equals" },
    { value: "NotEquals", label: "Not Equals" },
    { value: "GreaterThan", label: "Greater Than" },
    { value: "LessThan", label: "Less Than" },
    { value: "GreaterThanOrEqual", label: "Greater Than or Equal" },
    { value: "LessThanOrEqual", label: "Less Than or Equal" },
  ],
  Date: [
    { value: "Equals", label: "Equals" },
    { value: "Before", label: "Before" },
    { value: "After", label: "After" },
  ],
  Boolean: [{ value: "Equals", label: "Equals" }],
};

const LOGICAL_OPTIONS = [
  { value: "AND", label: "AND" },
  { value: "OR", label: "OR" },
];

function optionsForType(type) {
  return OPERATORS[type] || OPERATORS.Text;
}

function getResponseItems(response) {
  return Array.isArray(response) ? response : response?.data || [];
}

function createCondition() {
  return {
    fieldId: "",
    logicalOperator: "AND",
    operator: "Equals",
    value: "",
  };
}

function createGroup() {
  return {
    groupLogicalOperator: "AND",
    conditions: [createCondition()],
  };
}

function toGroups(conditions) {
  if (!conditions?.length) return [];

  const groups = new Map();

  [...conditions]
    .sort(
      (a, b) =>
        (a.groupOrder ?? 1) - (b.groupOrder ?? 1) ||
        (a.conditionOrder ?? 1) - (b.conditionOrder ?? 1)
    )
    .forEach((condition) => {
      const groupOrder = condition.groupOrder ?? 1;

      if (!groups.has(groupOrder)) {
        groups.set(groupOrder, {
          groupLogicalOperator: condition.groupLogicalOperator || "AND",
          conditions: [],
        });
      }

      groups.get(groupOrder).conditions.push({
        fieldId: condition.fieldId,
        logicalOperator: condition.logicalOperator || "AND",
        operator: condition.operator || "Equals",
        value: condition.value || "",
      });
    });

  return [...groups.values()];
}

function RuleForm({ open, rule, nextRuleId, saving, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_RULE);
  const [groups, setGroups] = useState([]);
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState("");
  const [draggedCondition, setDraggedCondition] = useState(null);

  useEffect(() => {
    if (!open) return;

    setForm(
      rule
        ? { ...EMPTY_RULE, ...rule }
        : { ...EMPTY_RULE, ruleId: nextRuleId }
    );
    setGroups(rule ? toGroups(rule.conditions) : []);
    setError("");

    const loadFields = async () => {
      try {
        setLoadingFields(true);
        const response = await ruleConfigurationService.getFields();
        setFields(getResponseItems(response));
      } catch (loadError) {
        setError(loadError.message || "Unable to load active fields.");
      } finally {
        setLoadingFields(false);
      }
    };

    loadFields();
  }, [open, rule, nextRuleId]);

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const addCondition = (groupIndex) => {
    setGroups((current) =>
      current.map((group, index) =>
        index === groupIndex
          ? { ...group, conditions: [...group.conditions, createCondition()] }
          : group
      )
    );
  };

  const addGroup = () => {
    setGroups((current) => [...current, createGroup()]);
  };

  const removeCondition = (groupIndex, conditionIndex) => {
    setGroups((current) =>
      current
        .map((group, index) =>
          index === groupIndex
            ? {
                ...group,
                conditions: group.conditions.filter(
                  (_, itemIndex) => itemIndex !== conditionIndex
                ),
              }
            : group
        )
        .filter((group) => group.conditions.length > 0)
    );
  };

  const removeGroup = (groupIndex) => {
    setGroups((current) => current.filter((_, index) => index !== groupIndex));
  };

  const updateGroup = (groupIndex, name, value) => {
    setGroups((current) =>
      current.map((group, index) =>
        index === groupIndex ? { ...group, [name]: value } : group
      )
    );
  };

  const updateCondition = (groupIndex, conditionIndex, name, value) => {
    setGroups((current) =>
      current.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              conditions: group.conditions.map((condition, itemIndex) =>
                itemIndex === conditionIndex
                  ? { ...condition, [name]: value }
                  : condition
              ),
            }
          : group
      )
    );
  };

  const changeField = (groupIndex, conditionIndex, value) => {
    const field = fields.find((item) => String(item.fieldId) === String(value));
    const firstOperator =
      optionsForType(field?.fieldType).at(0)?.value || "Equals";

    setGroups((current) =>
      current.map((group, currentGroupIndex) =>
        currentGroupIndex === groupIndex
          ? {
              ...group,
              conditions: group.conditions.map((condition, currentConditionIndex) =>
                currentConditionIndex === conditionIndex
                  ? {
                      ...condition,
                      fieldId: value,
                      operator: firstOperator,
                      value: "",
                    }
                  : condition
              ),
            }
          : group
      )
    );
  };

  const moveCondition = (targetGroupIndex, targetConditionIndex) => {
    if (!draggedCondition) return;

    const {
      groupIndex: sourceGroupIndex,
      conditionIndex: sourceConditionIndex,
    } = draggedCondition;

    setGroups((current) => {
      const next = current.map((group) => ({
        ...group,
        conditions: [...group.conditions],
      }));

      const sourceGroup = next[sourceGroupIndex];
      const targetGroup = next[targetGroupIndex];

      if (!sourceGroup || !targetGroup) {
        return next;
      }

      const [moved] = sourceGroup.conditions.splice(sourceConditionIndex, 1);

      if (!moved) {
        return next;
      }

      if (sourceGroupIndex === targetGroupIndex) {
        let targetIndex = targetConditionIndex;

        if (sourceConditionIndex < targetIndex) {
          targetIndex -= 1;
        }

        targetGroup.conditions.splice(targetIndex, 0, moved);
        return next;
      }

      targetGroup.conditions.splice(targetConditionIndex, 0, moved);
      return next.filter((group) => group.conditions.length > 0);
    });

    setDraggedCondition(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.ruleName.trim()) {
      setError("Rule name is required.");
      return;
    }

    if (!groups.length || !groups.some((group) => group.conditions.length)) {
      setError("Add at least one condition.");
      return;
    }

    const conditions = [];
    let conditionOrder = 1;

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];

      for (
        let conditionIndex = 0;
        conditionIndex < group.conditions.length;
        conditionIndex += 1
      ) {
        const condition = group.conditions[conditionIndex];

        if (
          !condition.fieldId ||
          !condition.operator ||
          !String(condition.value).trim()
        ) {
          setError("Complete every condition before saving.");
          return;
        }

        conditions.push({
          ...condition,
          fieldId: Number(condition.fieldId),
          conditionOrder,
          groupOrder: groupIndex + 1,
          groupLogicalOperator: group.groupLogicalOperator,
        });

        conditionOrder += 1;
      }
    }

    setError("");

    await onSave({
      ...form,
      priority: Number(form.priority || 1),
      conditions,
    });
  };

  return (
    <Dialog
      open={open}
      title={rule ? "Edit Rule" : "Create Rule"}
      className="rule-dialog"
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="rule-form"
            disabled={saving || loadingFields}
          >
            {saving ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
          </Button>
        </>
      }
    >
      <form id="rule-form" className="rule-form" onSubmit={handleSubmit}>
        {error && <div className="rule-form-error">{error}</div>}

        <div className="rule-form-grid">
          <TextBox
            name="ruleName"
            label="Rule Name"
            value={form.ruleName}
            required
            disabled={saving}
            onChange={(event) => update("ruleName", event.target.value)}
          />
          <TextBox
            name="description"
            label="Description"
            value={form.description}
            disabled={saving}
            onChange={(event) => update("description", event.target.value)}
          />
        </div>

        <div className="conditions-header">
          <div>
            <span className="conditions-kicker">Rule logic</span>
            <h3>Conditions</h3>
            <p>
              Build grouped criteria with a clean, ordered rule expression.
              Drag rows to rearrange them and use AND/OR to connect criteria.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={addGroup}>
            <FiPlus size={15} />
            Add Group
          </Button>
        </div>

        <div className="conditions-list">
          {groups.map((group, groupIndex) => (
            <div className="condition-group" key={`group-${groupIndex}`}>
              <div className="condition-group-header">
                <div className="condition-group-title">
                  <span className="group-eyebrow">Criteria group</span>
                  <strong>
                    {groupIndex === 0
                      ? "Primary criteria"
                      : "Additional criteria"}
                  </strong>
                </div>

                <div className="condition-group-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => addCondition(groupIndex)}
                  >
                    <FiPlus size={14} />
                    Add Condition
                  </Button>
                  {groups.length > 1 && (
                    <button
                      type="button"
                      className="condition-remove"
                      title="Delete group"
                      aria-label="Delete group"
                      onClick={() => removeGroup(groupIndex)}
                    >
                      <FiTrash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="condition-table">
                <div className="condition-table-header">
                  <span className="condition-table-drag" />
                  <span>Field</span>
                  <span>Operator</span>
                  <span>Value</span>
                  <span>Logic</span>
                  <span />
                </div>

                <div className="group-conditions">
                  {group.conditions.map((condition, conditionIndex) => {
                    const field = fields.find(
                      (item) => String(item.fieldId) === String(condition.fieldId)
                    );
                    const operators = optionsForType(field?.fieldType);

                    return (
                      <div
                        key={`condition-${groupIndex}-${conditionIndex}`}
                        className="condition-row"
                        draggable
                        onDragStart={() =>
                          setDraggedCondition({ groupIndex, conditionIndex })
                        }
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => moveCondition(groupIndex, conditionIndex)}
                        onDragEnd={() => setDraggedCondition(null)}
                      >
                        <div
                          className="condition-drag-handle"
                          title="Drag to rearrange condition"
                        >
                          <FiMenu size={16} />
                        </div>

                        <Select
                          label=""
                          value={condition.fieldId}
                          options={fields.map((item) => ({
                            value: item.fieldId,
                            label: item.displayName,
                          }))}
                          placeholder={
                            loadingFields ? "Loading fields..." : "Select field"
                          }
                          disabled={loadingFields || saving}
                          onChange={(event) =>
                            changeField(
                              groupIndex,
                              conditionIndex,
                              event.target.value
                            )
                          }
                        />

                        <Select
                          label=""
                          value={condition.operator}
                          options={operators}
                          placeholder="Select operator"
                          disabled={!field || saving}
                          onChange={(event) =>
                            updateCondition(
                              groupIndex,
                              conditionIndex,
                              "operator",
                              event.target.value
                            )
                          }
                        />

                        {field?.fieldType === "Boolean" ? (
                          <Select
                            label=""
                            value={condition.value}
                            options={[
                              { value: "Y", label: "Yes" },
                              { value: "N", label: "No" },
                            ]}
                            placeholder="Select value"
                            disabled={saving}
                            onChange={(event) =>
                              updateCondition(
                                groupIndex,
                                conditionIndex,
                                "value",
                                event.target.value
                              )
                            }
                          />
                        ) : (
                          <TextBox
                            label=""
                            value={condition.value}
                            type={
                              field?.fieldType === "Number"
                                ? "number"
                                : field?.fieldType === "Date"
                                  ? "date"
                                  : "text"
                            }
                            disabled={!field || saving}
                            placeholder={
                              field ? "Enter value" : "Select field first"
                            }
                            onChange={(event) =>
                              updateCondition(
                                groupIndex,
                                conditionIndex,
                                "value",
                                event.target.value
                              )
                            }
                          />
                        )}

                        <div className="condition-logic-cell">
                          {conditionIndex === group.conditions.length - 1 ? (
                            <span className="condition-logic-end">—</span>
                          ) : (
                            <Select
                              label=""
                              value={condition.logicalOperator}
                              options={LOGICAL_OPTIONS}
                              disabled={saving}
                              onChange={(event) =>
                                updateCondition(
                                  groupIndex,
                                  conditionIndex,
                                  "logicalOperator",
                                  event.target.value
                                )
                              }
                            />
                          )}
                        </div>

                        <button
                          type="button"
                          className="condition-remove"
                          title="Delete condition"
                          aria-label="Delete condition"
                          onClick={() =>
                            removeCondition(groupIndex, conditionIndex)
                          }
                        >
                          <FiTrash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {groupIndex < groups.length - 1 && (
                <div className="group-connector">
                  <span>Next group</span>
                  <Select
                    label=""
                    value={groups[groupIndex + 1].groupLogicalOperator}
                    options={LOGICAL_OPTIONS}
                    disabled={saving}
                    onChange={(event) =>
                      updateGroup(
                        groupIndex + 1,
                        "groupLogicalOperator",
                        event.target.value
                      )
                    }
                  />
                </div>
              )}
            </div>
          ))}

          {!groups.length && (
            <div className="conditions-empty">
              <div className="conditions-empty-icon">+</div>
              <strong>No conditions yet</strong>
              <span>
                Add a criteria group and build the rule using the fields
                configured in Field Configuration.
              </span>
              <Button type="button" variant="secondary" onClick={addGroup}>
                <FiPlus size={15} />
                Add Group
              </Button>
            </div>
          )}
        </div>
      </form>
    </Dialog>
  );
}

export default RuleForm;
