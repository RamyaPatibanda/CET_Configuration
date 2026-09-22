import { useEffect, useState } from "react";
import { FiMenu, FiPlus, FiTrash2, FiUsers } from "react-icons/fi";
import "./RuleConditionGrouping.css";
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
  const [selectedConditions, setSelectedConditions] = useState([]);

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

  const toggleConditionSelection = (conditionId) => {
    setSelectedConditions((current) =>
      current.includes(conditionId)
        ? current.filter((id) => id !== conditionId)
        : [...current, conditionId]
    );
  };

  const groupSelectedConditions = () => {
    if (selectedConditions.length < 2) return;

    setForm((current) => {
      const selected = new Set(selectedConditions);
      const conditions = [...(current.conditions || [])];
      const firstSelectedIndex = conditions.findIndex((condition) => selected.has(condition.id));
      const targetGroup = firstSelectedIndex >= 0
        ? Number(conditions[firstSelectedIndex].groupOrder || 1)
        : 1;

      return {
        ...current,
        conditions: normalizeConditionLayout(
          conditions.map((condition) =>
            selected.has(condition.id)
              ? { ...condition, groupOrder: targetGroup }
              : condition
          )
        ),
      };
    });
    setSelectedConditions([]);
  };

  const ungroupSelectedConditions = () => {
    if (!selectedConditions.length) return;

    setForm((current) => {
      const conditions = [...(current.conditions || [])];
      const maxGroup = conditions.length
        ? Math.max(...conditions.map((condition) => Number(condition.groupOrder || 1)))
        : 0;

      return {
        ...current,
        conditions: normalizeConditionLayout(
          conditions.map((condition, index) =>
            selectedConditions.includes(condition.id)
              ? { ...condition, groupOrder: maxGroup + index + 1 }
              : condition
          )
        ),
      };
    });
    setSelectedConditions([]);
  };

  const handleConditionDrop = (targetId) => {
    if (!draggedConditionId || draggedConditionId === targetId) return;

    setForm((current) => {
      const conditions = [...(current.conditions || [])];
      const sourceIndex = conditions.findIndex((condition) => condition.id === draggedConditionId);
      const targetIndex = conditions.findIndex((condition) => condition.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;

      const [moved] = conditions.splice(sourceIndex, 1);
      const insertIndex = Math.min(targetIndex, conditions.length);
      conditions.splice(insertIndex, 0, moved);

      return {
        ...current,
        conditions: normalizeConditionLayout(conditions),
      };
    });

    setDraggedConditionId(null);
  };

  const removeRootCondition = (conditionId) => {
    setSelectedConditions((current) => current.filter((id) => id !== conditionId));
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
              <p>Build the rule by adding conditions. Rearrange rows and group conditions when needed.</p>
            </div>
          </div>

          {(form.conditions || []).length > 0 ? (
            <>
              <div className="condition-toolbar-actions condition-toolbar-actions-right">
                <Button type="button" variant="secondary" className="condition-tool-button" onClick={groupSelectedConditions} disabled={selectedConditions.length < 2}>
                  <FiUsers size={13} /><span>Group</span>
                </Button>
                <Button type="button" variant="secondary" className="condition-tool-button" onClick={ungroupSelectedConditions} disabled={!selectedConditions.length}>
                  <FiMenu size={13} /><span>Ungroup</span>
                </Button>
                <Button type="button" variant="secondary" className="condition-tool-button condition-add-button" onClick={addRootCondition}>
                  <FiPlus size={13} /><span>Add condition</span>
                </Button>
              </div>

              <div className="condition-single-table-wrapper">
                <table className="condition-single-table">
                  <thead>
                    <tr>
                      <th className="condition-brace-column" />
                      <th className="condition-check-column" />
                      <th>Field</th>
                      <th>Operator</th>
                      <th>Value</th>
                      <th>Logic</th>
                      <th className="condition-action-column" />
                    </tr>
                  </thead>
                  <tbody>
                    {getGroups(form.conditions).flatMap(([groupOrder, groupConditions], groupIndex) =>
                      groupConditions.map((condition, conditionIndex) => {
                        const field = fields.find((item) => String(item.fieldId) === String(condition.fieldId));
                        const operators = optionsForType(field?.fieldType);
                        const showGroupBrace = groupConditions.length > 1 && conditionIndex === 0;
                        return (
                        <tr
                          key={condition.id}
                          draggable
                          onDragStart={() => setDraggedConditionId(condition.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleConditionDrop(condition.id)}
                          onDragEnd={() => setDraggedConditionId(null)}
                        >
                          <td
                            className="condition-brace-cell"
                            rowSpan={showGroupBrace ? groupConditions.length : undefined}
                            aria-label={showGroupBrace ? `Condition group ${groupOrder}` : undefined}
                          >
                            {showGroupBrace && (
                              <span className={`condition-group-brace ${["blue", "violet", "teal", "amber", "rose", "indigo"][groupIndex % 6]}`} aria-hidden="true">
                                {"{"}
                              </span>
                            )}
                          </td>
                          <td className="condition-check-cell">
                            <button type="button" className="condition-drag-handle" title="Drag to rearrange" aria-label="Drag to rearrange">
                              <FiMenu size={16} />
                            </button>
                            <input
                              type="checkbox"
                              checked={selectedConditions.includes(condition.id)}
                              onChange={() => toggleConditionSelection(condition.id)}
                              aria-label="Select condition"
                            />
                          </td>
                          <td>
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
                          </td>
                          <td>
                            <Select
                              value={condition.operator}
                              options={operators}
                              onChange={(event) => updateRootCondition(condition.id, "operator", event.target.value)}
                            />
                          </td>
                          <td>
                            <TextBox
                              value={condition.value}
                              placeholder="Enter value"
                              onChange={(event) => updateRootCondition(condition.id, "value", event.target.value)}
                            />
                          </td>
                          <td>
                            <Select
                              value={condition.conditionLogicalOperator}
                              options={LOGICAL_OPTIONS}
                              onChange={(event) => updateRootCondition(condition.id, "conditionLogicalOperator", event.target.value)}
                            />
                          </td>
                          <td className="condition-action-cell">
                            <button type="button" className="condition-remove" onClick={() => removeRootCondition(condition.id)} title="Delete condition">
                              <FiTrash2 />
                            </button>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rule-conditions-empty condition-empty-state">
              <div className="condition-empty-copy">
                <strong>No conditions configured</strong>
                <span>Add a condition to start defining when this rule should match.</span>
              </div>
              <Button type="button" variant="primary" className="condition-empty-add-button" onClick={addRootCondition}>
                <FiPlus size={14} />
                <span>Add your first condition</span>
              </Button>
            </div>
          )}
        </section>

      </form>
    </Dialog>
  );
}


export default RuleForm;
