import { useEffect, useState } from "react";
import { FiArrowDown, FiArrowUp, FiLink, FiPlus, FiTrash2, FiLink2 } from "react-icons/fi";
import Button from "../../../components/common/Button/Button";
import Dialog from "../../../components/common/Dialog/Dialog";
import Select from "../../../components/common/Select/Select";
import SearchableSelect from "../../../components/common/SearchableSelect/SearchableSelect";
import TextBox from "../../../components/common/TextBox/TextBox";
import ruleConfigurationService from "../services/ruleConfigurationService";

const EMPTY_RULE = {
  ruleId: 0,
  ruleName: "",
  description: "",
  priority: 1,
  isActive: true,
  decisionAreaCode: "SEAT_ALLOCATION",
  outcome: { values: [] },
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

const getResponseItems = (response) => Array.isArray(response) ? response : response?.data || [];
const optionsForType = (type) => OPERATORS[type] || OPERATORS.Text;

const normalizeConditions = (conditions) => (Array.isArray(conditions) ? conditions : []).map((condition, index) => ({
  id: condition.id || `condition-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  fieldId: condition.fieldId ?? condition.FieldId ?? "",
  conditionLogicalOperator: condition.conditionLogicalOperator ?? condition.ConditionLogicalOperator ?? condition.logicalOperator ?? condition.LogicalOperator ?? "AND",
  operator: condition.operator ?? condition.Operator ?? "Equals",
  value: condition.value ?? condition.Value ?? "",
  conditionOrder: condition.conditionOrder ?? condition.ConditionOrder ?? index + 1,
  groupOrder: condition.groupOrder ?? condition.GroupOrder ?? 1,
}));

function RuleForm({ open, rule, nextRuleId, saving, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_RULE);
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState("");
  const [draggedConditionId, setDraggedConditionId] = useState(null);

  useEffect(() => {
    if (!open) return;

    setForm({
      ...EMPTY_RULE,
      ...(rule || {}),
      ruleId: rule?.ruleId ?? nextRuleId,
      decisionAreaCode: rule?.decisionAreaCode || "SEAT_ALLOCATION",
      conditions: normalizeConditionLayout(normalizeConditions(rule?.conditions)),
    });
    setError("");

    const loadConfiguration = async () => {
      try {
        setLoadingFields(true);
        const fieldsResponse = await ruleConfigurationService.getFields();
        setFields(getResponseItems(fieldsResponse));
      } catch (loadError) {
        setError(loadError.message || "Unable to load rule configuration options.");
      } finally {
        setLoadingFields(false);
      }
    };

    loadConfiguration();
  }, [open, rule, nextRuleId]);

  const updateForm = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));


  const addRootCondition = () => {
    setForm((current) => {
      const conditions = current.conditions || [];
      const lastGroupOrder = conditions.length
        ? Math.max(...conditions.map((condition) => Number(condition.groupOrder || 1)))
        : 1;
      return {
        ...current,
        conditions: [
          ...conditions,
          {
            id: `root-condition-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            fieldId: "",
            conditionLogicalOperator: "AND",
            operator: "Equals",
            value: "",
            conditionOrder: conditions.length + 1,
            groupOrder: lastGroupOrder,
          },
        ],
      };
    });
  };

  const updateRootCondition = (conditionId, name, value) => {
    setForm((current) => ({
      ...current,
      conditions: (current.conditions || []).map((condition) =>
        condition.id === conditionId ? { ...condition, [name]: value } : condition
      ),
    }));
  };

  const changeRootField = (conditionId, value) => {
    const field = fields.find((item) => String(item.fieldId) === String(value));
    const operators = optionsForType(field?.fieldType);
    updateRootCondition(conditionId, "fieldId", value);
    setForm((current) => ({
      ...current,
      conditions: (current.conditions || []).map((condition) =>
        condition.id === conditionId
          ? { ...condition, fieldId: value, operator: operators[0]?.value || "Equals", value: "" }
          : condition
      ),
    }));
  };

  const normalizeConditionLayout = (conditions) => {
    const source = Array.isArray(conditions) ? conditions : [];
    const groups = [];
    const groupMap = new Map();

    source.forEach((condition) => {
      const groupOrder = Number(condition.groupOrder || 1);
      if (!groupMap.has(groupOrder)) {
        const group = { groupOrder, conditions: [] };
        groupMap.set(groupOrder, group);
        groups.push(group);
      }
      groupMap.get(groupOrder).conditions.push(condition);
    });

    groups.sort((a, b) => a.groupOrder - b.groupOrder);

    return groups.flatMap((group, groupIndex) =>
      group.conditions.map((condition, conditionIndex) => ({
        ...condition,
        groupOrder: groupIndex + 1,
        conditionOrder: conditionIndex + 1,
        conditionLogicalOperator:
          conditionIndex === 0
            ? (groupIndex === 0 ? "AND" : (condition.conditionLogicalOperator || "AND").toUpperCase())
            : (condition.conditionLogicalOperator || "AND").toUpperCase(),
      }))
    );
  };

  const getGroups = (conditions) => {
    const groups = new Map();
    (conditions || []).forEach((condition) => {
      const groupOrder = Number(condition.groupOrder || 1);
      if (!groups.has(groupOrder)) groups.set(groupOrder, []);
      groups.get(groupOrder).push(condition);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  };

  const setConditions = (conditions) => {
    setForm((current) => ({
      ...current,
      conditions: normalizeConditionLayout(conditions),
    }));
  };

  const moveCondition = (conditionId, direction) => {
    setForm((current) => {
      const conditions = [...(current.conditions || [])];
      const index = conditions.findIndex((condition) => condition.id === conditionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= conditions.length) return current;

      [conditions[index], conditions[target]] = [conditions[target], conditions[index]];
      return { ...current, conditions: normalizeConditionLayout(conditions) };
    });
  };

  const groupWithPrevious = (conditionId) => {
    setForm((current) => {
      const conditions = [...(current.conditions || [])];
      const index = conditions.findIndex((condition) => condition.id === conditionId);
      if (index <= 0) return current;

      const previous = conditions[index - 1];
      conditions[index] = {
        ...conditions[index],
        groupOrder: previous.groupOrder,
      };
      return { ...current, conditions: normalizeConditionLayout(conditions) };
    });
  };

  const ungroupCondition = (conditionId) => {
    setForm((current) => {
      const conditions = [...(current.conditions || [])];
      const index = conditions.findIndex((condition) => condition.id === conditionId);
      if (index < 0) return current;

      const currentGroup = Number(conditions[index].groupOrder || 1);
      const groupMembers = conditions.filter(
        (condition) => Number(condition.groupOrder || 1) === currentGroup
      );
      if (groupMembers.length <= 1) return current;

      const nextGroup = Math.max(...conditions.map((condition) => Number(condition.groupOrder || 1))) + 1;
      conditions[index] = {
        ...conditions[index],
        groupOrder: nextGroup,
        conditionLogicalOperator: "AND",
      };
      return { ...current, conditions: normalizeConditionLayout(conditions) };
    });
  };

  const changeGroupLogic = (groupOrder, value) => {
    setForm((current) => ({
      ...current,
      conditions: (current.conditions || []).map((condition, index, conditions) => {
        if (Number(condition.groupOrder || 1) !== groupOrder) return condition;
        const firstInGroup = conditions.find((item) => Number(item.groupOrder || 1) === groupOrder);
        return condition.id === firstInGroup?.id
          ? { ...condition, conditionLogicalOperator: value }
          : condition;
      }),
    }));
  };

  const handleConditionDrop = (targetId) => {
    if (!draggedConditionId || draggedConditionId === targetId) return;
    setForm((current) => {
      const conditions = [...(current.conditions || [])];
      const sourceIndex = conditions.findIndex((condition) => condition.id === draggedConditionId);
      const targetIndex = conditions.findIndex((condition) => condition.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;

      const [moved] = conditions.splice(sourceIndex, 1);
      moved.groupOrder = conditions[targetIndex]?.groupOrder ?? moved.groupOrder;
      conditions.splice(targetIndex, 0, moved);
      return { ...current, conditions: normalizeConditionLayout(conditions) };
    });
    setDraggedConditionId(null);
  };

  const removeRootCondition = (conditionId) => {
    setForm((current) => ({
      ...current,
      conditions: normalizeConditionLayout(
        (current.conditions || []).filter((condition) => condition.id !== conditionId)
      ),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.ruleName.trim()) {
      setError("Rule name is required.");
      return;
    }

    const rootConditions = (form.conditions || []).map((condition, conditionIndex) => ({
      fieldId: Number(condition.fieldId),
      fieldName: fields.find((field) => String(field.fieldId) === String(condition.fieldId))?.fieldName
        || fields.find((field) => String(field.fieldId) === String(condition.fieldId))?.FieldName
        || "",
      conditionLogicalOperator: (condition.conditionLogicalOperator || "AND").toUpperCase(),
      operator: condition.operator,
      value: condition.value,
      conditionOrder: conditionIndex + 1,
      groupOrder: Number(condition.groupOrder || 1),
    }));

    if (rootConditions.some((condition) =>
      !condition.fieldId || !condition.operator || !String(condition.value).trim()
    )) {
      setError("Complete every condition in the Conditions section.");
      return;
    }

    try {
      setError("");
      await onSave({
        ...form,
        conditions: rootConditions,
        outcome: { values: [] },
        branches: [],
      });
    } catch (saveError) {
      setError(saveError.message || "Unable to save the rule.");
    }
  };

  return (
    <Dialog
      open={open}
      title={rule ? "Edit Rule" : "Create Rule"}
      className="rule-dialog"
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="rule-form" disabled={saving || loadingFields}>
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
            onChange={(event) => updateForm("ruleName", event.target.value)}
          />
          <TextBox
            name="description"
            label="Description"
            value={form.description}
            disabled={saving}
            onChange={(event) => updateForm("description", event.target.value)}
          />
        </div>

        <div className="conditions-header">
          <div className="conditions-header-copy">
            <span className="conditions-kicker">Rule logic</span>
            <h3>Rule Conditions</h3>
            <p>
              Define the conditions that determine when this rule matches. A rule contains conditions only; allocation order is selected when the rule is used.
            </p>
          </div>
        </div>


        <section className="rule-conditions-section">
          <div className="rule-section-heading">
            <div>
              <span className="conditions-kicker">Rule criteria</span>
              <h3>Conditions</h3>
              <p>Add one or more conditions. Use AND / OR to control how the conditions are evaluated.</p>
            </div>
            <Button type="button" variant="secondary" onClick={addRootCondition}>
              <FiPlus size={13} /> Add condition
            </Button>
          </div>

          {(form.conditions || []).length > 0 ? (
            <div className="conditions-list">
              {getGroups(form.conditions).map(([groupOrder, group], groupIndex) => (
                <div key={groupOrder}>
                  {groupIndex > 0 && (
                    <div className="group-connector">
                      <div>
                        <Select
                          value={group[0]?.conditionLogicalOperator || "AND"}
                          options={LOGICAL_OPTIONS}
                          onChange={(event) => changeGroupLogic(groupOrder, event.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <section className="condition-group">
                    <div className="condition-group-header">
                      <div className="condition-group-title">
                        <span className="group-eyebrow">Condition group</span>
                        <strong>
                          {group.length > 1
                            ? "Grouped conditions"
                            : "Single condition"}
                        </strong>
                        <span>
                          {group.length > 1
                            ? "Conditions inside this group are evaluated together."
                            : "Use Group to combine this condition with the previous one."}
                        </span>
                      </div>
                      <div className="condition-group-actions">
                        {group.length > 1 && (
                          <span className="group-eyebrow">{group.length} conditions</span>
                        )}
                      </div>
                    </div>

                    <div className="condition-table">
                      <div className="condition-table-header">
                        <span />
                        <span>Field</span>
                        <span>Operator</span>
                        <span>Value</span>
                        <span>Logic</span>
                        <span />
                      </div>

                      {group.map((condition, conditionIndex) => {
                        const field = fields.find((item) => String(item.fieldId) === String(condition.fieldId));
                        const operators = optionsForType(field?.fieldType);
                        const globalIndex = (form.conditions || []).findIndex((item) => item.id === condition.id);
                        const isFirst = globalIndex === 0;

                        return (
                          <div
                            key={condition.id}
                            className="condition-row"
                            draggable
                            onDragStart={() => setDraggedConditionId(condition.id)}
                            onDragEnd={() => setDraggedConditionId(null)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => handleConditionDrop(condition.id)}
                          >
                            <button
                              type="button"
                              className="condition-drag-handle"
                              title="Drag to rearrange"
                              onMouseDown={(event) => event.stopPropagation()}
                            >
                              ↕
                            </button>

                            <SearchableSelect
                              value={condition.fieldId}
                              options={fields.map((item) => ({
                                value: item.fieldId,
                                label: item.displayName ?? item.DisplayName ?? item.fieldName ?? item.FieldName,
                              }))}
                              placeholder={loadingFields ? "Loading fields..." : "Select field"}
                              disabled={loadingFields}
                              onChange={(value) => changeRootField(condition.id, value)}
                            />

                            <Select
                              value={condition.operator}
                              options={operators}
                              onChange={(event) => updateRootCondition(condition.id, "operator", event.target.value)}
                            />

                            <TextBox
                              value={condition.value}
                              placeholder="Enter value"
                              onChange={(event) => updateRootCondition(condition.id, "value", event.target.value)}
                            />

                            <div className="condition-logic-cell">
                              {isFirst ? (
                                <div className="condition-logic-end">Start</div>
                              ) : (
                                <Select
                                  value={condition.conditionLogicalOperator}
                                  options={LOGICAL_OPTIONS}
                                  onChange={(event) =>
                                    updateRootCondition(condition.id, "conditionLogicalOperator", event.target.value)
                                  }
                                />
                              )}
                            </div>

                            <div className="condition-row-actions">
                              <button
                                type="button"
                                className="condition-row-action"
                                title="Move up"
                                disabled={globalIndex === 0}
                                onClick={() => moveCondition(condition.id, -1)}
                              >
                                <FiArrowUp />
                              </button>
                              <button
                                type="button"
                                className="condition-row-action"
                                title="Move down"
                                disabled={globalIndex === (form.conditions || []).length - 1}
                                onClick={() => moveCondition(condition.id, 1)}
                              >
                                <FiArrowDown />
                              </button>
                              {conditionIndex === 0 && globalIndex > 0 && (
                                <button
                                  type="button"
                                  className="condition-row-action"
                                  title="Group with previous condition"
                                  onClick={() => groupWithPrevious(condition.id)}
                                >
                                  <FiLink />
                                </button>
                              )}
                              {group.length > 1 && (
                                <button
                                  type="button"
                                  className="condition-row-action"
                                  title="Ungroup this condition"
                                  onClick={() => ungroupCondition(condition.id)}
                                >
                                  <FiLink2 />
                                </button>
                              )}
                              <button
                                type="button"
                                className="condition-remove"
                                title="Delete condition"
                                onClick={() => removeRootCondition(condition.id)}
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              ))}
            </div>
          ) : (
            <div className="rule-conditions-empty">
              <span>No conditions added yet. Use the Add condition button above to start.</span>
            </div>
          )}
        </section>

      </form>
    </Dialog>
  );
}


export default RuleForm;
